import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import { connectToDatabase, isDbConnected, RestaurantStateModel } from "./src/db/mongodb";

dotenv.config();

const STATE_FILE = path.join(process.cwd(), "restaurant_data.json");
const STATE_KEY = "default_cafe_banani";
let cachedState: any = null;
let lastServerUpdate = 0;

// Try to load state from JSON backup on startup
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedState = parsed.data || null;
      lastServerUpdate = parsed.timestamp || Date.now();
    }
  }
} catch (e) {
  console.error("Error reading startup state from file:", e);
}

// Initialize MongoDB connection and synchronize state
async function initDatabase() {
  const connected = await connectToDatabase();
  if (connected) {
    try {
      const doc = await RestaurantStateModel.findOne({ stateKey: STATE_KEY });
      if (doc && doc.data) {
        cachedState = doc.data;
        lastServerUpdate = doc.timestamp || Date.now();
        console.log("📦 Loaded restaurant state from MongoDB successfully.");
      } else if (cachedState) {
        // Seed MongoDB from existing JSON backup
        await RestaurantStateModel.findOneAndUpdate(
          { stateKey: STATE_KEY },
          { stateKey: STATE_KEY, data: cachedState, timestamp: lastServerUpdate },
          { upsert: true, new: true }
        );
        console.log("🌱 Seeded initial restaurant state into MongoDB from local backup.");
      }
    } catch (err) {
      console.error("Error querying initial state from MongoDB:", err);
    }
  }
}

let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function startServer() {
  await initDatabase();

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: "50mb" })); // Support large restaurant dataset syncing

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      mongodbConnected: isDbConnected(),
      timestamp: new Date().toISOString()
    });
  });

  // DB status endpoint
  app.get("/api/db/status", (req, res) => {
    res.json({
      success: true,
      mongodbConnected: isDbConnected(),
      hasCachedState: !!cachedState,
      lastServerUpdate
    });
  });

  // Helper to discover all Windows installed printers
  async function getWindowsPrinters(): Promise<string[]> {
    return new Promise((resolve) => {
      exec(`powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"`, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const list = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        resolve(list);
      });
    });
  }

  // Resolve active thermal printer: Prioritizes 80 Printer (LAN 192.168.1.87) or Kot Printer (USB001)
  function resolveThermalPrinter(installedPrinters: string[], requestedName?: string): string {
    const printers = installedPrinters || [];

    // 1. If a specific printer name was requested:
    if (requestedName) {
      const trimmedReq = requestedName.trim();
      const exact = printers.find(p => p.toLowerCase() === trimmedReq.toLowerCase());
      if (exact) return exact;

      if (/80\s*printer/i.test(trimmedReq) || trimmedReq.includes('80')) {
        const match80 = printers.find(p => /80\s*printer/i.test(p));
        if (match80) return match80;
      }

      if (/kot/i.test(trimmedReq)) {
        const matchKot = printers.find(p => /kot/i.test(p));
        if (matchKot) return matchKot;
      }
    }

    // 2. Prioritize active 80 Printer (LAN 192.168.1.87)
    const lanPrinter = printers.find(p => /80\s*printer/i.test(p));
    if (lanPrinter) return lanPrinter;

    // 3. Fallback to Kot Printer (USB001)
    const kot = printers.find(p => /kot\s*printer/i.test(p)) || printers.find(p => /kot/i.test(p));
    if (kot) return kot;

    // 4. Fallback to any other thermal/receipt printer
    const thermal = printers.find(p => /pos|receipt|thermal/i.test(p));
    if (thermal) return thermal;

    return printers[0] || '80 Printer';
  }

  // Build ESC/POS binary buffer for a compact single-page KOT slip
  function buildKotEscPosBuffer(
    req: { tableName: string; tableZone?: string; waiter?: string; customer?: string; invoiceNo: string; dateTime?: string },
    slip: { station: string; category?: string; items: { name: string; qty: number; variation?: string; addons?: string[]; notes?: string }[] },
    index: number,
    total: number
  ): Buffer {
    const chunks: Buffer[] = [];
    const pushStr = (str: string) => chunks.push(Buffer.from(str, 'latin1'));
    const pushBytes = (arr: number[]) => chunks.push(Buffer.from(arr));

    // 1. ESC @ : Initialize printer
    pushBytes([0x1B, 0x40]);

    // 2. Hardware Thermal Calibration (Clean, Crisp, Normal Density)
    pushBytes([0x1B, 0x47, 0x00]); // ESC G 0: Double-strike OFF (prevents muddy/bleeding characters)
    pushBytes([0x1B, 0x45, 0x00]); // ESC E 0: Bold OFF by default
    pushBytes([0x1B, 0x21, 0x00]); // ESC ! 0: Uniform standard font A (12x24, 42 columns)

    // 3. Center Align: Station & KOT number
    pushBytes([0x1B, 0x61, 0x01]); // Center
    pushStr("------------------------------------------\n");
    pushBytes([0x1B, 0x45, 0x01]); // Bold ON
    const cleanStation = (!slip.station || slip.station === 'SPLIT_ALL' || slip.station === 'ALL') ? 'MAIN KITCHEN' : slip.station;
    pushStr(`STATION: ${cleanStation.toUpperCase()}\n`);
    pushStr(`KOT NO: ${req.invoiceNo}${total > 1 ? `-${index}` : ''}\n`);
    if (slip.category) {
      pushStr(`Category: ${slip.category}\n`);
    }
    pushBytes([0x1B, 0x45, 0x00]); // Bold OFF
    pushStr("------------------------------------------\n");

    // 4. Left Align: Table, Time, Waiter Info
    pushBytes([0x1B, 0x61, 0x00]); // Left align
    pushBytes([0x1B, 0x45, 0x01]); // Bold ON for Table
    pushStr(`TABLE   : ${req.tableName}${req.tableZone ? ` (${req.tableZone})` : ""}\n`);
    pushBytes([0x1B, 0x45, 0x00]); // Bold OFF

    const timeStr = req.dateTime || new Date().toLocaleString("en-US");
    pushStr(`TIME    : ${timeStr}\n`);
    pushStr(`WAITER  : ${req.waiter || "Staff"}\n`);
    if (req.customer && req.customer !== "Walk-in Customer") {
      pushStr(`CUSTOMER: ${req.customer}\n`);
    }
    pushStr("------------------------------------------\n");

    // 5. Items Header
    pushBytes([0x1B, 0x45, 0x01]); // Bold ON
    pushStr("ITEM NAME                              QTY\n");
    pushBytes([0x1B, 0x45, 0x00]); // Bold OFF
    pushStr("------------------------------------------\n");

    // 6. Food Items (Crisp, High Legibility)
    let totalQty = 0;
    for (const item of slip.items) {
      totalQty += item.qty;
      const name = item.name.length > 33 ? item.name.slice(0, 33) : item.name;
      const nameCol = name.padEnd(34, ' ');
      const qtyCol = `${item.qty}x`.padStart(6, ' ');

      pushBytes([0x1B, 0x45, 0x01]); // Bold ON
      pushStr(`${nameCol} ${qtyCol}\n`);
      pushBytes([0x1B, 0x45, 0x00]); // Bold OFF

      if (item.variation) {
        pushStr(`   - Cut: ${item.variation}\n`);
      }
      if (item.addons && item.addons.length > 0) {
        pushStr(`   - Extras: ${item.addons.join(", ")}\n`);
      }
      if (item.notes) {
        pushStr(`   - Note: ${item.notes}\n`);
      }
    }

    pushStr("------------------------------------------\n");

    // 7. Small feed to clear tear blade (only 3 newlines = ~2.5cm)
    pushStr("\n\n\n");

    // 8. ESC/POS Full Paper Cut Command (GS V 0)
    pushBytes([0x1D, 0x56, 0x00]);

    return Buffer.concat(chunks);
  }

  // Build ESC/POS binary buffer for a customer bill / cash memo
  function buildBillEscPosBuffer(
    bill: {
      restaurantName?: string;
      restaurantAddress?: string;
      restaurantHotline?: string;
      restaurantBin?: string;
      invoiceNo: string;
      dateTime?: string;
      tableName: string;
      tableZone?: string;
      channelOrAgent?: string;
      waiter?: string;
      orderTakenBy?: string;
      orderCreatedBy?: string;
      settleBillRole?: string;
      cashierRole?: string;
      customer?: string;
      items: { name: string; qty: number; price: number; variation?: string; addons?: string[]; notes?: string }[];
      subtotal: number;
      discountDeduction?: number;
      discountType?: string;
      discountVal?: number;
      netTotal: number;
      isSettled?: boolean;
    }
  ): Buffer {
    const chunks: Buffer[] = [];
    const pushStr = (str: string) => chunks.push(Buffer.from(str, 'latin1'));
    const pushBytes = (arr: number[]) => chunks.push(Buffer.from(arr));

    // Helper to format a 42-column dual aligned line (Label on left, Value on right)
    const line2Col = (left: string, right: string, width = 42) => {
      const l = left.trim();
      const r = right.trim();
      const maxL = Math.max(0, width - 1 - r.length);
      const safeL = l.length > maxL ? l.slice(0, maxL) : l;
      const spaces = Math.max(1, width - safeL.length - r.length);
      return safeL + ' '.repeat(spaces) + r + '\n';
    };

    // 1. ESC @ : Initialize printer
    pushBytes([0x1B, 0x40]);

    // 2. Hardware Thermal Calibration (Clean, Crisp, Normal Density)
    pushBytes([0x1B, 0x47, 0x00]); // ESC G 0: Double-strike OFF (prevents muddy/bleeding characters)
    pushBytes([0x1B, 0x45, 0x00]); // ESC E 0: Bold OFF by default
    pushBytes([0x1B, 0x21, 0x00]); // ESC ! 0: Uniform font A (12x24, 42 columns)

    // 3. Center Align: Restaurant Header
    pushBytes([0x1B, 0x61, 0x01]); // Center
    pushBytes([0x1B, 0x45, 0x01]); // Bold ON
    pushStr(`${bill.restaurantName || "BARCODE CAFE BANANI"}\n`);
    pushBytes([0x1B, 0x45, 0x00]); // Bold OFF

    const rawAddress = bill.restaurantAddress || "House #42, Road #11, Block D, Banani, Dhaka-1213";
    if (rawAddress) {
      if (rawAddress.includes(",")) {
        const parts = rawAddress.split(",").map(p => p.trim());
        let currentLine = "";
        for (const part of parts) {
          if (!currentLine) {
            currentLine = part;
          } else if ((currentLine + ", " + part).length <= 40) {
            currentLine += ", " + part;
          } else {
            pushStr(`${currentLine}\n`);
            currentLine = part;
          }
        }
        if (currentLine) {
          pushStr(`${currentLine}\n`);
        }
      } else {
        pushStr(`${rawAddress}\n`);
      }
    }

    const rawHotline = bill.restaurantHotline || "+880 1700-000000";
    if (rawHotline) {
      pushStr(`Hotline: ${rawHotline}\n`);
    }

    const rawBin = bill.restaurantBin || "0029381-01";
    if (rawBin) {
      pushStr(`BIN/VAT Reg: ${rawBin}\n`);
    }
    pushStr("------------------------------------------\n");
    pushBytes([0x1B, 0x45, 0x01]); // Bold ON
    pushStr(`${bill.isSettled ? "PAID CASH MEMO" : "INVOICE / GUEST BILL"}\n`);
    pushBytes([0x1B, 0x45, 0x00]); // Bold OFF
    pushStr("------------------------------------------\n");

    // 4. Left Align: Invoice metadata
    pushBytes([0x1B, 0x61, 0x00]); // Left
    pushStr(line2Col("Invoice No :", bill.invoiceNo || "INV-0000"));
    let dateStr = "";
    let timeStr = "";
    const rawDt = bill.dateTime || new Date().toLocaleString("en-US");
    if (rawDt.includes(",")) {
      const parts = rawDt.split(",");
      dateStr = parts[0].trim();
      timeStr = parts.slice(1).join(",").trim();
    } else {
      const parts = rawDt.trim().split(/\s+/);
      if (parts.length >= 2) {
        dateStr = parts[0];
        timeStr = parts.slice(1).join(" ");
      } else {
        dateStr = rawDt;
        timeStr = new Date().toLocaleTimeString("en-US");
      }
    }
    pushStr(line2Col(`Date :  ${dateStr}`, `Time: ${timeStr}`));
    pushStr(line2Col("Table & Z  :", `${bill.tableName || "Takeaway"}${bill.tableZone ? ` (${bill.tableZone})` : ""}`));
    if (bill.channelOrAgent) {
      pushStr(line2Col("Channel    :", bill.channelOrAgent));
    }
    pushStr(line2Col("Waiter     :", bill.waiter || "Staff"));
    const orderTaker = bill.orderTakenBy || bill.orderCreatedBy || bill.waiter || "Staff";
    if (orderTaker && orderTaker !== (bill.waiter || "Staff")) {
      pushStr(line2Col("Order Taken By :", orderTaker));
    }
    if (bill.isSettled) {
      const settleRole = bill.settleBillRole || bill.cashierRole || "Cashier";
      pushStr(line2Col("Bill Settled By :", settleRole));
    }
    if (bill.customer && bill.customer !== "Walk-in Customer") {
      pushStr(line2Col("Customer   :", bill.customer));
    }
    pushStr("------------------------------------------\n");

    // 5. Items Header (Exact 42 character columns)
    pushBytes([0x1B, 0x45, 0x01]); // Bold ON
    const colItemH = "ITEM".padEnd(19, ' ');
    const colQtyH = "QTY".padStart(3, ' ');
    const colPriceH = "PRICE".padStart(8, ' ');
    const colTotalH = "TOTAL".padStart(9, ' ');
    pushStr(`${colItemH} ${colQtyH} ${colPriceH} ${colTotalH}\n`);
    pushBytes([0x1B, 0x45, 0x00]); // Bold OFF
    pushStr("------------------------------------------\n");

    // 6. Food Items (Crisp & High Legibility)
    for (const item of bill.items) {
      let firstLineName = item.name.trim();
      let remainder = "";
      if (firstLineName.length > 19) {
        const lastSpace = firstLineName.lastIndexOf(" ", 19);
        if (lastSpace > 8) {
          remainder = firstLineName.slice(lastSpace + 1).trim();
          firstLineName = firstLineName.slice(0, lastSpace);
        } else {
          remainder = firstLineName.slice(19).trim();
          firstLineName = firstLineName.slice(0, 19);
        }
      }
      const colItem = firstLineName.padEnd(19, ' ');
      const colQty = String(item.qty).padStart(3, ' ');
      const colPrice = Number(item.price).toFixed(2).padStart(8, ' ');
      const colTotal = Number(item.price * item.qty).toFixed(2).padStart(9, ' ');

      pushStr(`${colItem} ${colQty} ${colPrice} ${colTotal}\n`);
      if (remainder) {
        pushStr(`  ${remainder}\n`);
      }
      if (item.variation) {
        pushStr(`  * Cut: ${item.variation}\n`);
      }
      if (item.addons && item.addons.length > 0) {
        pushStr(`  + Extras: ${item.addons.join(", ")}\n`);
      }
      if (item.notes) {
        pushStr(`  - Note: ${item.notes}\n`);
      }
    }

    pushStr("------------------------------------------\n");

    // 7. Financial Summary
    pushBytes([0x1B, 0x61, 0x00]); // Left align
    pushStr(line2Col("Subtotal:", Number(bill.subtotal || 0).toFixed(2)));
    if (bill.discountDeduction && bill.discountDeduction > 0) {
      const discLbl = bill.discountType === 'percent' && bill.discountVal 
        ? `Discount (${bill.discountVal}%):` 
        : "Discount:";
      pushStr(line2Col(discLbl, `-${Number(bill.discountDeduction).toFixed(2)}`));
    }
    pushStr("------------------------------------------\n");
    pushBytes([0x1B, 0x45, 0x01]); // Bold ON
    pushStr(line2Col("TOTAL PAYABLE:", Number(bill.netTotal || 0).toFixed(2)));
    pushBytes([0x1B, 0x45, 0x00]); // Bold OFF

    // Payment breakdown if settled
    const pb = (bill as any).paymentBreakdown;
    if (pb) {
      pushStr("------------------------------------------\n");
      if (pb.cash > 0) pushStr(line2Col("Cash Paid:", Number(pb.cash).toFixed(2)));
      if (pb.card > 0) pushStr(line2Col("Card Paid:", Number(pb.card).toFixed(2)));
      if (pb.bkash > 0) pushStr(line2Col("bKash Paid:", Number(pb.bkash).toFixed(2)));
      if (pb.nagad > 0) pushStr(line2Col("Nagad Paid:", Number(pb.nagad).toFixed(2)));
      if (pb.due > 0) pushStr(line2Col("Due / Credit:", Number(pb.due).toFixed(2)));
      if ((bill as any).changeReturn && (bill as any).changeReturn > 0) {
        pushStr(line2Col("Change Return:", Number((bill as any).changeReturn).toFixed(2)));
      }
    }
    pushStr("------------------------------------------\n");

    // 8. Center Align: Footer Note
    pushBytes([0x1B, 0x61, 0x01]); // Center
    if (bill.isSettled) {
      pushBytes([0x1B, 0x45, 0x01]); // Bold ON
      pushStr("*** PAID & SETTLED ***\n");
      pushBytes([0x1B, 0x45, 0x00]); // Bold OFF
    }
    pushStr("Thank you for dining with us!\n");
    pushStr("Please visit again\n");
    pushStr("------------------------------------------\n");

    // 9. Feed & Cut
    pushStr("\n\n\n");
    pushBytes([0x1D, 0x56, 0x00]);

    return Buffer.concat(chunks);
  }

  // Build ESC/POS binary buffer for a POS Shift End Z-Report
  function buildZReportEscPosBuffer(
    report: {
      restaurantName?: string;
      restaurantAddress?: string;
      restaurantHotline?: string;
      restaurantBin?: string;
      session: {
        id: string;
        date: string;
        openedBy: string;
        closedBy?: string;
        startTime: string;
        endTime?: string;
        orderCount: number;
        cashSales: number;
        cardSales: number;
        bkashSales: number;
        nagadSales: number;
        dueSales: number;
        totalSales: number;
        openingCash: number;
        expectedCash: number;
        actualClosingCash?: number;
        cashDifference?: number;
        shiftType?: string;
        notes?: string;
      }
    }
  ): Buffer {
    const chunks: Buffer[] = [];
    const pushStr = (str: string) => chunks.push(Buffer.from(str, 'latin1'));
    const pushBytes = (arr: number[]) => chunks.push(Buffer.from(arr));

    const line2Col = (left: string, right: string, width = 42) => {
      const l = left.trim();
      const r = right.trim();
      const maxL = Math.max(0, width - 1 - r.length);
      const safeL = l.length > maxL ? l.slice(0, maxL) : l;
      const spaces = Math.max(1, width - safeL.length - r.length);
      return safeL + ' '.repeat(spaces) + r + '\n';
    };

    const s = report.session;

    // 1. ESC @ : Initialize printer
    pushBytes([0x1B, 0x40]);

    // 2. Hardware Thermal Calibration (Clean, Crisp, Normal Density)
    pushBytes([0x1B, 0x47, 0x00]); // ESC G 0: Double-strike OFF
    pushBytes([0x1B, 0x45, 0x00]); // ESC E 0: Bold OFF by default
    pushBytes([0x1B, 0x21, 0x00]); // ESC ! 0: Uniform font A (42 columns)

    // 3. Center Align: Restaurant Header
    pushBytes([0x1B, 0x61, 0x01]); // Center
    pushStr(`${report.restaurantName || "BARCODE CAFE BANANI"}\n`);

    // Restaurant Address
    const rawAddress = report.restaurantAddress || "House #42, Road #11, Block D, Banani, Dhaka-1213";
    if (rawAddress) {
      if (rawAddress.includes(",")) {
        const parts = rawAddress.split(",").map(p => p.trim());
        let currentLine = "";
        for (const part of parts) {
          if (!currentLine) {
            currentLine = part;
          } else if ((currentLine + ", " + part).length <= 40) {
            currentLine += ", " + part;
          } else {
            pushStr(`${currentLine}\n`);
            currentLine = part;
          }
        }
        if (currentLine) {
          pushStr(`${currentLine}\n`);
        }
      } else {
        pushStr(`${rawAddress}\n`);
      }
    }

    const rawHotline = report.restaurantHotline || "+880 1700-000000";
    if (rawHotline) {
      pushStr(`Hotline: ${rawHotline}\n`);
    }

    const rawBin = report.restaurantBin || "0029381-01";
    if (rawBin) {
      pushStr(`BIN/VAT Reg: ${rawBin}\n`);
    }

    pushStr("------------------------------------------\n");
    pushStr("*** POS SHIFT Z-REPORT ***\n");
    pushStr("------------------------------------------\n");

    // 4. Session Meta Information (Left Align)
    pushBytes([0x1B, 0x61, 0x00]); // Left
    pushStr(line2Col("Session ID    :", s.id || "SES-ACTIVE"));
    pushStr(line2Col("Date          :", s.date || new Date().toISOString().split("T")[0]));
    pushStr(line2Col("Shift Name    :", s.shiftType || "Shift 1"));
    pushStr(line2Col("Shift Timing  :", `${s.startTime || "N/A"} - ${s.endTime || "Closed"}`));
    pushStr(line2Col("Opened By     :", s.openedBy || "Cashier"));
    if (s.closedBy) {
      pushStr(line2Col("Closed By     :", s.closedBy));
    }
    if ((s as any).handoverToCashier) {
      pushStr(line2Col("Handover To   :", (s as any).handoverToCashier));
    }
    pushStr(line2Col("Orders Settled:", `${s.orderCount || 0} Invoices`));
    pushStr("------------------------------------------\n");

    // 5. Sales Payment Breakdown
    pushStr("1. SALES PAYMENT BREAKDOWN\n");
    pushStr(line2Col("Cash Sales       :", Number(s.cashSales || 0).toFixed(2)));
    pushStr(line2Col("Credit/Debit Card:", Number(s.cardSales || 0).toFixed(2)));
    pushStr(line2Col("bKash Payment    :", Number(s.bkashSales || 0).toFixed(2)));
    pushStr(line2Col("Nagad Payment    :", Number(s.nagadSales || 0).toFixed(2)));
    if (s.dueSales && s.dueSales > 0) {
      pushStr(line2Col("Customer Due     :", Number(s.dueSales).toFixed(2)));
    }
    pushStr("------------------------------------------\n");
    pushStr(line2Col("GROSS SHIFT REVENUE:", Number(s.totalSales || 0).toFixed(2)));
    pushStr("------------------------------------------\n");

    // 2. Cash Collection (Staff / Cashier Breakdown)
    const cashiers = (s as any).cashierBreakdown;
    pushStr(`2. CASH COLLECTION (${(cashiers && Array.isArray(cashiers)) ? cashiers.length : 1} STAFF)\n`);

    if (cashiers && Array.isArray(cashiers) && cashiers.length > 0) {
      for (const c of cashiers) {
        const shName = c.shift || s.shiftType || "Shift 1";
        const cleanCashier = (c.cashier || '').replace(/\s*\([A-Z_]+\)\s*$/i, '').trim();
        const roleTag = c.role ? ` (${c.role})` : '';
        pushStr(line2Col(`* [${shName}] ${cleanCashier}${roleTag}:`, `Tk ${Number(c.totalCollected || 0).toFixed(2)}`));
        const due = c.dueAmount !== undefined ? c.dueAmount : Math.max(0, (c.totalCollected || 0) - (c.cashCollected || 0) - (c.digitalCollected || 0));
        const dueStr = due > 0 ? ` | Due: Tk ${Number(due).toFixed(0)}` : '';
        pushStr(`   (${c.orderCount || 0} inv) Cash: Tk ${Number(c.cashCollected || 0).toFixed(0)} | Dig: Tk ${Number(c.digitalCollected || 0).toFixed(0)}${dueStr}\n`);
      }
    } else {
      pushStr(line2Col(`* [${s.shiftType || 'Shift 1'}] ${s.openedBy}:`, `Tk ${Number(s.totalSales || 0).toFixed(2)}`));
      pushStr(`   (${s.orderCount || 0} inv) Cash: Tk ${Number(s.cashSales || 0).toFixed(0)} | Dig: Tk ${Number((s.cardSales || 0) + (s.bkashSales || 0) + (s.nagadSales || 0)).toFixed(0)}\n`);
    }
    pushStr("------------------------------------------\n");

    // 3. Role-Wise Sales Breakdown (Only active roles that sold)
    const rawRoles = (s as any).roleBreakdown;
    const roles = Array.isArray(rawRoles) ? rawRoles.filter((r: any) => (Number(r.orderCount) || 0) > 0 || (Number(r.totalCollected) || 0) > 0) : [];
    if (roles && roles.length > 0) {
      pushStr(`3. ROLE-WISE SALES (${roles.length} ROLES)\n`);
      for (const r of roles) {
        pushStr(line2Col(`* [${r.role}] (${r.orderCount} ord):`, `Tk ${Number(r.totalCollected || 0).toFixed(2)}`));
      }
      pushStr("------------------------------------------\n");
    }

    // 4. Waiter-wise Sales Breakdown
    const waiters = (s as any).waiterBreakdown;
    if (waiters && Array.isArray(waiters) && waiters.length > 0) {
      pushStr(`4. WAITER-WISE SALES (${waiters.length} WAITERS)\n`);
      for (const w of waiters) {
        const pct = s.totalSales > 0 ? Math.round(((w.totalSales || 0) / s.totalSales) * 100) : 0;
        pushStr(line2Col(`* ${w.waiter} (${w.orderCount} ord - ${pct}%):`, `Tk ${Number(w.totalSales || 0).toFixed(2)}`));
      }
      pushStr("------------------------------------------\n");
    }

    // 5. Cash Drawer Reconciliation
    pushStr("5. CASH DRAWER RECONCILIATION\n");
    pushStr(line2Col("(+) Opening Float     :", Number(s.openingCash || 0).toFixed(2)));
    pushStr(line2Col("(+) Cash Sales Total  :", Number(s.cashSales || 0).toFixed(2)));
    pushStr(line2Col("(=) Expected in Drawer:", Number(s.expectedCash || 0).toFixed(2)));
    pushStr(line2Col("Actual Counted Cash   :", Number(s.actualClosingCash ?? s.expectedCash ?? 0).toFixed(2)));
    pushStr("------------------------------------------\n");

    // Variance
    const diff = Number(s.cashDifference || 0);
    const varTxt = diff === 0 
      ? "0.00 (MATCH)" 
      : diff < 0 
        ? `-${Math.abs(diff).toFixed(2)} (SHORT)` 
        : `+${diff.toFixed(2)} (OVER)`;
    pushStr(line2Col("DRAWER VARIANCE:", varTxt));
    pushStr("------------------------------------------\n");

    // 5.1 Cash Handover & Settlement Allocation
    if ((s as any).nextShiftDrawerFloat !== undefined || (s as any).cashDropToVault !== undefined) {
      pushStr(">> CASH ALLOCATION:\n");
      if ((s as any).nextShiftDrawerFloat !== undefined) {
        pushStr(line2Col("1. Float Left in Drawer:", `Tk ${Number((s as any).nextShiftDrawerFloat || 0).toFixed(2)}`));
      }
      if ((s as any).cashDropToVault !== undefined) {
        pushStr(line2Col("2. Drop to Vault / Safe:", `Tk ${Number((s as any).cashDropToVault || 0).toFixed(2)}`));
      }
      pushStr("------------------------------------------\n");
    }

    // 6. Shift Notes (if any)
    if (s.notes) {
      pushStr(`Shift Notes:\n  ${s.notes}\n`);
      pushStr("------------------------------------------\n");
    }

    // 7. Signatures
    pushStr("\n");
    pushStr("Cashier Signature       Manager Signature \n");
    pushStr("_________________       _________________ \n\n");

    // 8. Center Align Footer
    pushBytes([0x1B, 0x61, 0x01]); // Center
    pushStr("*** END OF SHIFT Z-REPORT ***\n");
    pushStr(`Printed: ${new Date().toLocaleString("en-US")}\n`);
    pushStr("------------------------------------------\n");

    // Feed & Cut
    pushStr("\n\n\n");
    pushBytes([0x1D, 0x56, 0x00]);

    return Buffer.concat(chunks);
  }

  // Build ESC/POS binary buffer for Waiter Server Slip
  function buildWaiterSlipEscPosBuffer(data: {
    restaurantName?: string;
    restaurantAddress?: string;
    waiterName: string;
    date: string;
    time: string;
    totalOrders: number;
    totalSales: number;
    estimatedTips: number;
    serverCashFloat?: number;
    runningTables?: { name: string; zone: string; total: number }[];
  }): Buffer {
    const chunks: Buffer[] = [];
    const pushStr = (str: string) => chunks.push(Buffer.from(str, 'latin1'));
    const pushBytes = (arr: number[]) => chunks.push(Buffer.from(arr));

    const line2Col = (left: string, right: string, width = 42) => {
      const l = left.trim();
      const r = right.trim();
      const maxL = Math.max(0, width - 1 - r.length);
      const safeL = l.length > maxL ? l.slice(0, maxL) : l;
      const spaces = Math.max(1, width - safeL.length - r.length);
      return safeL + ' '.repeat(spaces) + r + '\n';
    };

    // 1. ESC @ : Initialize printer
    pushBytes([0x1B, 0x40]);

    // 2. Hardware Thermal Calibration (Clean, Crisp, Normal Density)
    pushBytes([0x1B, 0x47, 0x00]); // ESC G 0: Double-strike OFF
    pushBytes([0x1B, 0x45, 0x00]); // ESC E 0: Bold OFF by default
    pushBytes([0x1B, 0x21, 0x00]); // ESC ! 0: Uniform font A (42 columns)

    pushBytes([0x1B, 0x61, 0x01]);
    pushStr(`${data.restaurantName || "BARCODE CAFE BANANI"}\n`);
    pushStr(`${data.restaurantAddress || "Banani, Dhaka"}\n`);
    pushStr("------------------------------------------\n");
    pushStr("*** WAITER SERVER SUMMARY SLIP ***\n");
    pushStr("------------------------------------------\n");

    pushBytes([0x1B, 0x61, 0x00]);
    pushStr(line2Col("Waiter Name   :", data.waiterName || "Staff"));
    pushStr(line2Col("Date          :", data.date || "Today"));
    pushStr(line2Col("Time Printed  :", data.time || "N/A"));
    pushStr(line2Col("Orders Served :", `${data.totalOrders || 0} Orders`));
    pushStr("------------------------------------------\n");

    pushStr(line2Col("TOTAL SALES GENERATED:", Number(data.totalSales || 0).toFixed(2)));
    pushStr(line2Col("ESTIMATED TIPS (5%)  :", Number(data.estimatedTips || 0).toFixed(2)));
    pushStr("------------------------------------------\n");

    if (data.serverCashFloat && data.serverCashFloat > 0) {
      pushStr(line2Col("SERVER CASH FLOAT (POCKET):", Number(data.serverCashFloat || 0).toFixed(2)));
      pushStr(line2Col("FLOAT RETURN TO REGISTER  :", Number(data.serverCashFloat || 0).toFixed(2)));
      pushStr("------------------------------------------\n");
    }

    if (data.runningTables && data.runningTables.length > 0) {
      pushStr("RUNNING TABLES HANDED OVER:\n");
      for (const t of data.runningTables) {
        pushStr(line2Col(`* ${t.name} (${t.zone}):`, Number(t.total || 0).toFixed(2)));
      }
      pushStr("------------------------------------------\n");
    }

    pushStr("\n");
    pushStr("Waiter Signature        Manager Signature\n");
    pushStr("_________________       _________________\n\n");

    pushBytes([0x1B, 0x61, 0x01]);
    pushStr("*** END OF SERVER SLIP ***\n");
    pushStr("------------------------------------------\n");

    pushStr("\n\n\n");
    pushBytes([0x1D, 0x56, 0x00]);

    return Buffer.concat(chunks);
  }

  // Build ESC/POS binary buffer for Daily Consolidated Day-End Master Z-Report
  function buildDayEndEscPosBuffer(data: {
    restaurantName?: string;
    dayRecord: {
      id: string;
      date: string;
      totalDaySales: number;
      totalDayOrders: number;
      shiftCount: number;
      shiftIds: string[];
      totalCash: number;
      totalCard: number;
      totalBkash: number;
      totalNagad: number;
      totalDue: number;
      totalExpenses: number;
      netCashToVault: number;
      closedBy: string;
      closedAt: string;
      notes?: string;
    };
    daySessions?: any[];
  }): Buffer {
    const chunks: Buffer[] = [];
    const pushStr = (str: string) => chunks.push(Buffer.from(str, 'latin1'));
    const pushBytes = (arr: number[]) => chunks.push(Buffer.from(arr));

    const line2Col = (left: string, right: string, width = 42) => {
      const l = left.trim();
      const r = right.trim();
      const maxL = Math.max(0, width - 1 - r.length);
      const safeL = l.length > maxL ? l.slice(0, maxL) : l;
      const spaces = Math.max(1, width - safeL.length - r.length);
      return safeL + ' '.repeat(spaces) + r + '\n';
    };

    const r = data.dayRecord;

    // 1. ESC @ : Initialize printer
    pushBytes([0x1B, 0x40]);

    // 2. Hardware Thermal Calibration (Clean, Crisp, Normal Density)
    pushBytes([0x1B, 0x47, 0x00]); // ESC G 0: Double-strike OFF
    pushBytes([0x1B, 0x45, 0x00]); // ESC E 0: Bold OFF by default
    pushBytes([0x1B, 0x21, 0x00]); // ESC ! 0: Uniform font A (42 columns)

    pushBytes([0x1B, 0x61, 0x01]);
    pushStr(`${data.restaurantName || "BARCODE CAFE BANANI"}\n`);
    pushStr("House #42, Road #11, Block D, Banani, Dhaka\n");
    pushStr("------------------------------------------\n");
    pushStr("*** DAILY MASTER DAY-END Z-REPORT ***\n");
    pushStr("------------------------------------------\n");

    pushBytes([0x1B, 0x61, 0x00]);
    pushStr(line2Col("Day End ID    :", r.id));
    pushStr(line2Col("Business Date :", r.date));
    if ((r as any).openedBy) {
      pushStr(line2Col("Day Started By:", (r as any).openedBy));
    }
    if ((r as any).openedAt) {
      pushStr(line2Col("Start Time    :", (r as any).openedAt));
    }
    if ((r as any).openingCash !== undefined) {
      pushStr(line2Col("Opening Float :", `Tk ${Number((r as any).openingCash).toFixed(2)}`));
    }
    pushStr(line2Col("Day Closed By :", r.closedBy));
    pushStr(line2Col("Close Time    :", r.closedAt));
    if ((r as any).closingCash !== undefined) {
      pushStr(line2Col("Closing Cash  :", `Tk ${Number((r as any).closingCash).toFixed(2)}`));
    }
    pushStr(line2Col("Total Shifts  :", `${r.shiftCount} Shifts Consolidated`));
    pushStr(line2Col("Total Orders  :", `${r.totalDayOrders} Orders`));
    pushStr("------------------------------------------\n");

    // Shift 1, Shift 2... Summary
    if (data.daySessions && Array.isArray(data.daySessions) && data.daySessions.length > 0) {
      pushStr(">> SHIFT BREAKDOWN (SHIFT 1, 2...):\n");
      data.daySessions.forEach((s: any, idx: number) => {
        const shName = s.shiftType || `Shift ${idx + 1}`;
        pushStr(line2Col(`* [${shName}] ${s.openedBy}:`, `Tk ${Number(s.totalSales || 0).toFixed(2)}`));
        pushStr(`   Time : ${s.startTime || 'N/A'} - ${s.endTime || 'Active'} (${s.orderCount || 0} Invoices)\n`);
        pushStr(`   Float: Tk ${Number(s.openingCash || 0).toFixed(0)} | Cash: Tk ${Number(s.cashSales || 0).toFixed(0)} | Dig: Tk ${Number((s.cardSales || 0) + (s.bkashSales || 0) + (s.nagadSales || 0)).toFixed(0)}\n`);
        if (s.actualClosingCash !== undefined) {
          pushStr(`   Drawer Close: Tk ${Number(s.actualClosingCash).toFixed(0)}\n`);
        }
      });
      pushStr("------------------------------------------\n");
    }

    pushStr("1. CONSOLIDATED PAYMENT REVENUE\n");
    pushStr(line2Col("Cash Sales (Total) :", Number(r.totalCash || 0).toFixed(2)));
    pushStr(line2Col("Card Sales (Total) :", Number(r.totalCard || 0).toFixed(2)));
    pushStr(line2Col("bKash Sales (Total):", Number(r.totalBkash || 0).toFixed(2)));
    pushStr(line2Col("Nagad Sales (Total):", Number(r.totalNagad || 0).toFixed(2)));
    if (r.totalDue > 0) {
      pushStr(line2Col("Due / Credit Total :", Number(r.totalDue || 0).toFixed(2)));
    }
    pushStr("------------------------------------------\n");
    pushStr(line2Col("GROSS DAILY REVENUE:", Number(r.totalDaySales || 0).toFixed(2)));
    pushStr("------------------------------------------\n");

    pushStr("2. EXPENSES & VAULT DEPOSIT\n");
    pushStr(line2Col("(-) Daily Petty Exp:", Number(r.totalExpenses || 0).toFixed(2)));
    pushStr("------------------------------------------\n");
    pushStr(line2Col("NET CASH TO VAULT  :", Number(r.netCashToVault || 0).toFixed(2)));
    pushStr("------------------------------------------\n");

    pushStr("\n");
    pushStr("General Manager         Managing Director\n");
    pushStr("_________________       _________________\n\n");

    pushBytes([0x1B, 0x61, 0x01]);
    pushStr("*** END OF DAILY MASTER REPORT ***\n");
    pushStr("------------------------------------------\n");

    pushStr("\n\n\n");
    pushBytes([0x1D, 0x56, 0x00]);

    return Buffer.concat(chunks);
  }

  // Build ESC/POS binary buffer for Kitchen Chef Production & Handover Slip
  function buildChefSlipEscPosBuffer(data: {
    restaurantName?: string;
    restaurantAddress?: string;
    shift: {
      id: string;
      chefName: string;
      station: string;
      shiftType: string;
      date: string;
      startTime: string;
      endTime?: string;
      kotsPreparedCount: number;
      dishesCookedCount: number;
      notes?: string;
      handoverToChef?: string;
    };
  }): Buffer {
    const chunks: Buffer[] = [];
    const pushStr = (str: string) => chunks.push(Buffer.from(str, 'latin1'));
    const pushBytes = (arr: number[]) => chunks.push(Buffer.from(arr));

    const line2Col = (left: string, right: string, width = 42) => {
      const l = left.trim();
      const r = right.trim();
      const maxL = Math.max(0, width - 1 - r.length);
      const safeL = l.length > maxL ? l.slice(0, maxL) : l;
      const spaces = Math.max(1, width - safeL.length - r.length);
      return safeL + ' '.repeat(spaces) + r + '\n';
    };

    const s = data.shift;

    // 1. ESC @ : Initialize printer
    pushBytes([0x1B, 0x40]);

    // 2. Hardware Thermal Calibration (Clean, Crisp, Normal Density)
    pushBytes([0x1B, 0x47, 0x00]); // ESC G 0: Double-strike OFF
    pushBytes([0x1B, 0x45, 0x00]); // ESC E 0: Bold OFF by default
    pushBytes([0x1B, 0x21, 0x00]); // ESC ! 0: Uniform font A (42 columns)

    pushBytes([0x1B, 0x61, 0x01]);
    pushStr(`${data.restaurantName || "BARCODE CAFE BANANI"}\n`);
    pushStr(`${data.restaurantAddress || "Banani, Dhaka"}\n`);
    pushStr("------------------------------------------\n");
    pushStr("*** KITCHEN PRODUCTION & HANDOVER SLIP ***\n");
    pushStr("------------------------------------------\n");

    pushBytes([0x1B, 0x61, 0x00]);
    pushStr(line2Col("Shift ID      :", s.id || "KCS-ACTIVE"));
    pushStr(line2Col("Chef Name     :", s.chefName || "Head Chef"));
    pushStr(line2Col("Station       :", s.station || "Main Kitchen"));
    pushStr(line2Col("Shift Timing  :", s.shiftType || "Morning Shift"));
    pushStr(line2Col("Date          :", s.date || new Date().toISOString().split('T')[0]));
    pushStr(line2Col("Duty Hours    :", `${s.startTime} - ${s.endTime || "In Progress"}`));
    pushStr("------------------------------------------\n");

    pushStr("KITCHEN PRODUCTION STATS:\n");
    pushStr(line2Col("KOTs Processed    :", `${s.kotsPreparedCount || 0} Tickets`));
    pushStr(line2Col("Total Dishes Cooked:", `${s.dishesCookedCount || 0} Portions`));
    pushStr("------------------------------------------\n");

    if (s.handoverToChef) {
      pushStr(line2Col("HANDOVER TO CHEF  :", s.handoverToChef));
      pushStr("------------------------------------------\n");
    }

    if (s.notes) {
      pushStr(`Kitchen Notes:\n  ${s.notes}\n`);
      pushStr("------------------------------------------\n");
    }

    pushStr("\n");
    pushStr("Outgoing Chef           Incoming Chef\n");
    pushStr("_________________       _________________\n\n");

    pushBytes([0x1B, 0x61, 0x01]);
    pushStr("*** END OF KITCHEN SLIP ***\n");
    pushStr("------------------------------------------\n");

    pushStr("\n\n\n");
    pushBytes([0x1D, 0x56, 0x00]);

    return Buffer.concat(chunks);
  }

  // Print individual slip as an isolated RAW ESC/POS Windows print job
  async function printSlipWindows(printerName: string, rawBuffer: Buffer): Promise<boolean> {
    return new Promise((resolve) => {
      const tempFile = path.join(os.tmpdir(), `kot_slip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.bin`);
      fs.writeFileSync(tempFile, rawBuffer);

      const scriptPath = path.join(process.cwd(), "scripts", "print-raw.ps1");
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${printerName.replace(/"/g, '`"')}" -FilePath "${tempFile.replace(/"/g, '`"')}"`;

      exec(psCmd, (error) => {
        try { fs.unlinkSync(tempFile); } catch (e) {}
        if (error) {
          console.error(`Error printing raw slip to ${printerName}:`, error.message);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Cloud Print Bridge Job Queue (For Remote Thermal Printing via Local Agent)
  // ---------------------------------------------------------------------------
  interface CloudPrintJob {
    id: string;
    type: 'KOT' | 'BILL' | 'ZREPORT' | 'WAITER_SLIP' | 'CHEF_SLIP' | 'DAYEND';
    payload: any;
    createdAt: number;
    status: 'pending' | 'completed';
  }

  const cloudPrintJobs: CloudPrintJob[] = [];
  let lastAgentHeartbeat = 0;

  function enqueueCloudPrintJob(type: CloudPrintJob['type'], payload: any) {
    const job: CloudPrintJob = {
      id: 'pjob_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type,
      payload,
      createdAt: Date.now(),
      status: 'pending'
    };
    cloudPrintJobs.push(job);
    if (cloudPrintJobs.length > 60) {
      cloudPrintJobs.splice(0, cloudPrintJobs.length - 60);
    }
    console.log(`📥 [Print Queue] Enqueued ${type} job (${job.id}) for local print bridge.`);
    return job;
  }

  // REST endpoint: Discover connected Windows physical printers
  app.get("/api/hardware/printers", async (req, res) => {
    try {
      const printers = await getWindowsPrinters();
      const safePrinters = printers.filter(p => !/^80\s*printer$/i.test(p.trim()));
      const activePrinter = resolveThermalPrinter(printers);
      res.json({ success: true, printers: safePrinters, activePrinter });
    } catch (err: any) {
      res.json({ success: false, printers: [], error: err?.message });
    }
  });

  // REST endpoints for Local Print Bridge Agent
  app.get("/api/print-bridge/poll", (req, res) => {
    lastAgentHeartbeat = Date.now();
    const pending = cloudPrintJobs.filter(j => j.status === 'pending');
    res.json({
      success: true,
      jobs: pending,
      serverTime: Date.now()
    });
  });

  app.post("/api/print-bridge/complete", (req, res) => {
    lastAgentHeartbeat = Date.now();
    const { jobIds } = req.body || {};
    if (Array.isArray(jobIds)) {
      for (const j of cloudPrintJobs) {
        if (jobIds.includes(j.id)) {
          j.status = 'completed';
        }
      }
    }
    res.json({ success: true });
  });

  app.get("/api/print-bridge/status", (req, res) => {
    const isOnline = (Date.now() - lastAgentHeartbeat) < 30000;
    res.json({
      success: true,
      isAgentOnline: isOnline,
      lastHeartbeatAgoSeconds: Math.floor((Date.now() - lastAgentHeartbeat) / 1000),
      pendingCount: cloudPrintJobs.filter(j => j.status === 'pending').length
    });
  });

  // Download 1-Click Printer Agent Setup ZIP
  app.get("/api/download/printer-agent-zip", (req, res) => {
    const candidates = [
      path.join(process.cwd(), "public", "downloads", "CafeBananiPrinter-Setup.zip"),
      path.join(process.cwd(), "dist", "downloads", "CafeBananiPrinter-Setup.zip")
    ];
    for (const zipPath of candidates) {
      if (fs.existsSync(zipPath)) {
        res.setHeader('Content-Disposition', 'attachment; filename="CafeBananiPrinter-Setup.zip"');
        res.setHeader('Content-Type', 'application/zip');
        return res.sendFile(zipPath);
      }
    }
    return res.status(404).json({ success: false, error: "Setup package not found" });
  });

  // Download 1-Click Installer BAT directly
  app.get("/api/download/printer-installer-bat", (req, res) => {
    const batPath = path.join(process.cwd(), "scripts", "INSTALL-CAFE-BANANI-PRINTER.bat");
    if (fs.existsSync(batPath)) {
      res.setHeader('Content-Disposition', 'attachment; filename="INSTALL-CAFE-BANANI-PRINTER.bat"');
      res.setHeader('Content-Type', 'application/x-bat');
      return res.sendFile(batPath);
    }
    return res.status(404).json({ success: false, error: "Installer script not found" });
  });

  // REST endpoint: Direct hardware Bill / Cash Memo print with auto-cut
  app.post("/api/hardware/print-bill", async (req, res) => {
    try {
      const billData = req.body;
      if (!billData || !billData.items || billData.items.length === 0) {
        return res.status(400).json({ success: false, error: "No bill data provided" });
      }

      const isWindows = process.platform === 'win32';
      const isAgentOnline = (Date.now() - lastAgentHeartbeat) < 30000;

      if (isWindows) {
        const installedPrinters = await getWindowsPrinters();
        const targetPrinter = resolveThermalPrinter(installedPrinters);

        console.log(`🖨️ [Hardware Bill Print] Printing bill for ${billData.tableName} on "${targetPrinter}" (Kot Printer USB001)`);
        const rawBuffer = buildBillEscPosBuffer(billData);
        const ok = await printSlipWindows(targetPrinter, rawBuffer);
        return res.json({
          success: ok,
          printerUsed: targetPrinter,
          isLocalServer: true
        });
      }

      // Enqueue for cloud print agent on Linux/Cloud deployments
      enqueueCloudPrintJob('BILL', billData);

      console.log(`☁️ [Cloud Bill Queue] Enqueued bill for ${billData.tableName}. Agent online: ${isAgentOnline}`);
      res.json({
        success: isAgentOnline,
        queued: true,
        isAgentOnline,
        message: isAgentOnline
          ? "Bill queued and dispatched to active local printer agent"
          : "Bill queued in cloud. Run start-printer-agent.bat on cashier PC."
      });
    } catch (err: any) {
      console.error("Hardware bill print error:", err);
      res.status(500).json({ success: false, error: err?.message || "Hardware bill print failed" });
    }
  });

  // REST endpoint: Direct hardware POS Shift End Z-Report print with auto-cut
  app.post("/api/hardware/print-zreport", async (req, res) => {
    try {
      const reportData = req.body;
      if (!reportData || !reportData.session) {
        return res.status(400).json({ success: false, error: "No session report data provided" });
      }

      const isWindows = process.platform === 'win32';
      const isAgentOnline = (Date.now() - lastAgentHeartbeat) < 30000;

      if (isWindows) {
        const installedPrinters = await getWindowsPrinters();
        const targetPrinter = resolveThermalPrinter(installedPrinters);

        console.log(`🖨️ [Hardware Z-Report Print] Printing shift Z-Report for session ${reportData.session.id} on "${targetPrinter}" (Kot Printer USB001)`);
        const rawBuffer = buildZReportEscPosBuffer(reportData);
        const ok = await printSlipWindows(targetPrinter, rawBuffer);
        return res.json({
          success: ok,
          printerUsed: targetPrinter,
          isLocalServer: true
        });
      }

      enqueueCloudPrintJob('ZREPORT', reportData);

      res.json({
        success: isAgentOnline,
        queued: true,
        isAgentOnline
      });
    } catch (err: any) {
      console.error("Hardware Z-Report print error:", err);
      res.status(500).json({ success: false, error: err?.message || "Hardware Z-Report print failed" });
    }
  });

  // REST endpoint: Direct hardware Waiter Shift Summary Slip print
  app.post("/api/hardware/print-waiter-slip", async (req, res) => {
    try {
      const slipData = req.body;
      if (!slipData || !slipData.waiterName) {
        return res.status(400).json({ success: false, error: "No waiter slip data provided" });
      }

      const isWindows = process.platform === 'win32';
      const isAgentOnline = (Date.now() - lastAgentHeartbeat) < 30000;

      if (isWindows) {
        const installedPrinters = await getWindowsPrinters();
        const targetPrinter = resolveThermalPrinter(installedPrinters);

        console.log(`🖨️ [Hardware Waiter Slip Print] Printing slip for waiter ${slipData.waiterName} on "${targetPrinter}" (Kot Printer USB001)`);
        const rawBuffer = buildWaiterSlipEscPosBuffer(slipData);
        const ok = await printSlipWindows(targetPrinter, rawBuffer);
        return res.json({
          success: ok,
          printerUsed: targetPrinter,
          isLocalServer: true
        });
      }

      enqueueCloudPrintJob('WAITER_SLIP', slipData);

      res.json({
        success: isAgentOnline,
        queued: true,
        isAgentOnline
      });
    } catch (err: any) {
      console.error("Hardware Waiter Slip print error:", err);
      res.status(500).json({ success: false, error: err?.message || "Hardware Waiter Slip print failed" });
    }
  });

  // REST endpoint: Direct hardware Daily Consolidated Day-End Master Z-Report print
  app.post("/api/hardware/print-dayend", async (req, res) => {
    try {
      const dayData = req.body;
      if (!dayData || !dayData.dayRecord) {
        return res.status(400).json({ success: false, error: "No day-end report data provided" });
      }

      const isWindows = process.platform === 'win32';
      const isAgentOnline = (Date.now() - lastAgentHeartbeat) < 30000;

      if (isWindows) {
        const installedPrinters = await getWindowsPrinters();
        const targetPrinter = resolveThermalPrinter(installedPrinters);

        console.log(`🖨️ [Hardware Day-End Print] Printing master day-end for date ${dayData.dayRecord.date} on "${targetPrinter}" (Kot Printer USB001)`);
        const rawBuffer = buildDayEndEscPosBuffer(dayData);
        const ok = await printSlipWindows(targetPrinter, rawBuffer);
        return res.json({
          success: ok,
          printerUsed: targetPrinter,
          isLocalServer: true
        });
      }

      enqueueCloudPrintJob('DAYEND', dayData);

      res.json({
        success: isAgentOnline,
        queued: true,
        isAgentOnline
      });
    } catch (err: any) {
      console.error("Hardware Day-End print error:", err);
      res.status(500).json({ success: false, error: err?.message || "Hardware Day-End print failed" });
    }
  });

  // REST endpoint: Direct hardware Kitchen Chef Production & Handover Slip print
  app.post("/api/hardware/print-chef-slip", async (req, res) => {
    try {
      const shiftData = req.body;
      if (!shiftData || !shiftData.shift) {
        return res.status(400).json({ success: false, error: "No chef shift data provided" });
      }

      const isWindows = process.platform === 'win32';
      const isAgentOnline = (Date.now() - lastAgentHeartbeat) < 30000;

      if (isWindows) {
        const installedPrinters = await getWindowsPrinters();
        const targetPrinter = resolveThermalPrinter(installedPrinters);

        console.log(`🖨️ [Hardware Chef Slip Print] Printing production slip for chef ${shiftData.shift.chefName} on "${targetPrinter}" (Kot Printer USB001)`);
        const rawBuffer = buildChefSlipEscPosBuffer(shiftData);
        const ok = await printSlipWindows(targetPrinter, rawBuffer);
        return res.json({
          success: ok,
          printerUsed: targetPrinter,
          isLocalServer: true
        });
      }

      enqueueCloudPrintJob('CHEF_SLIP', shiftData);

      res.json({
        success: isAgentOnline,
        queued: true,
        isAgentOnline
      });
    } catch (err: any) {
      console.error("Hardware Chef Slip print error:", err);
      res.status(500).json({ success: false, error: err?.message || "Hardware Chef Slip print failed" });
    }
  });

  // REST endpoint: Direct hardware KOT print with automatic printer fallback and slip auto-cut
  app.post("/api/hardware/print-kot", async (req, res) => {
    try {
      const { tableName, tableZone, waiter, customer, invoiceNo, dateTime, slips } = req.body;
      if (!slips || !Array.isArray(slips) || slips.length === 0) {
        return res.status(400).json({ success: false, error: "No slips provided to print" });
      }

      const isWindows = process.platform === 'win32';
      const isAgentOnline = (Date.now() - lastAgentHeartbeat) < 30000;

      if (isWindows) {
        const installedPrinters = await getWindowsPrinters();
        const masterPrinter = resolveThermalPrinter(installedPrinters);

        console.log(`🖨️ [Hardware Print] Processing ${slips.length} KOT slips. Master fallback printer: "${masterPrinter}" (Kot Printer USB001)`);

        let printedCount = 0;
        for (let i = 0; i < slips.length; i++) {
          const slip = slips[i];
          const targetPrinter = resolveThermalPrinter(installedPrinters, slip.targetPrinterName);
          console.log(` ➔ Printing KOT Slip ${i + 1}/${slips.length} on "${targetPrinter}" (Kot Printer USB001)...`);

          const rawBuffer = buildKotEscPosBuffer(
            { tableName, tableZone, waiter, customer, invoiceNo, dateTime },
            slip,
            i + 1,
            slips.length
          );

          const ok = await printSlipWindows(targetPrinter, rawBuffer);
          if (ok) {
            printedCount++;
            console.log(`✅ [Hardware Print] Slip ${i + 1}/${slips.length} printed & cut on "${targetPrinter}"`);
          }

          if (i < slips.length - 1) {
            await new Promise(r => setTimeout(r, 800));
          }
        }

        return res.json({
          success: printedCount > 0,
          printedCount,
          totalSlips: slips.length,
          printerUsed: masterPrinter,
          isLocalServer: true
        });
      }

      // Enqueue for cloud print agent on Linux/Cloud deployments
      enqueueCloudPrintJob('KOT', req.body);

      console.log(`☁️ [Cloud KOT Queue] Enqueued ${slips.length} KOT slips for table ${tableName}. Agent online: ${isAgentOnline}`);
      res.json({
        success: isAgentOnline,
        queued: true,
        isAgentOnline,
        totalSlips: slips.length,
        message: isAgentOnline
          ? "KOT slips queued and dispatched to active local printer agent"
          : "KOT slips queued in cloud. Run start-printer-agent.bat on cashier PC."
      });
    } catch (err: any) {
      console.error("Hardware KOT print error:", err);
      res.status(500).json({ success: false, error: err?.message || "Hardware print failed" });
    }
  });

  // REST API endpoints for POS real-time cloud synchronization
  app.get("/api/restaurant/state", async (req, res) => {
    try {
      if (isDbConnected()) {
        const doc = await RestaurantStateModel.findOne({ stateKey: STATE_KEY }).lean() as any;
        if (doc && doc.data && (!cachedState || !lastServerUpdate || (doc.timestamp && doc.timestamp > lastServerUpdate))) {
          cachedState = doc.data;
          lastServerUpdate = doc.timestamp || lastServerUpdate;
        }
      }
      res.json({
        success: true,
        data: cachedState,
        timestamp: lastServerUpdate,
        storage: isDbConnected() ? "mongodb" : "json_file"
      });
    } catch (err: any) {
      res.json({
        success: true,
        data: cachedState,
        timestamp: lastServerUpdate,
        storage: "fallback_cache"
      });
    }
  });

  app.post("/api/restaurant/state", async (req, res) => {
    try {
      const { data: clientData, clientTimestamp } = req.body;
      
      const now = Date.now();
      const effectiveClientTs = clientTimestamp || now;
      if (clientData) {
        cachedState = clientData;
        lastServerUpdate = Math.max(now, effectiveClientTs);
        
        // Save to MongoDB if connected
        if (isDbConnected()) {
          try {
            await RestaurantStateModel.findOneAndUpdate(
              { stateKey: STATE_KEY },
              { stateKey: STATE_KEY, data: cachedState, timestamp: lastServerUpdate },
              { upsert: true, new: true }
            );
          } catch (err: any) {
            console.error("MongoDB async update error:", err);
          }
        }

        // Always write file backup to disk
        fs.writeFile(STATE_FILE, JSON.stringify({ data: cachedState, timestamp: lastServerUpdate }, null, 2), (err) => {
          if (err) console.error("Error writing restaurant state file:", err);
        });
      }
      
      res.json({
        success: true,
        timestamp: lastServerUpdate,
        data: cachedState,
        storage: isDbConnected() ? "mongodb" : "json_file"
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || "Failed to sync server state" });
    }
  });

  // AI Recipe & Menu Costing Assistant (Suggests raw ingredients, portions, cost estimation & pricing)
  app.post("/api/ai/recipe-advisor", async (req, res) => {
    try {
      const { dishName, department, category, targetSellingPrice, existingRawItems, language } = req.body;
      const client = getAIClient();

      if (!client) {
        // High quality fallback
        const fallback = {
          suggestedPrice: targetSellingPrice || 450,
          estimatedCost: 160,
          profitMarginPercent: 64.4,
          chefTips: "Use high-heat searing for locking in moisture, marinate for minimum 2 hours.",
          suggestedIngredients: [
            { rawName: "Chicken Boneless", qty: 0.35, uom: "Kg", estimatedRate: 320, cost: 112 },
            { rawName: "Soybean Oil", qty: 0.05, uom: "Ltr", estimatedRate: 190, cost: 9.5 },
            { rawName: "Special BBQ Sauce", qty: 0.08, uom: "Kg", estimatedRate: 450, cost: 36 }
          ]
        };
        return res.json({ success: true, data: fallback, source: "template" });
      }

      const prompt = `You are an executive restaurant chef and F&B food cost controller for 'Eatery Rooftop Lounge'.
Analyze this dish concept and generate a precise Bill of Materials (BOM) recipe with raw material quantities and costing advice in JSON.
Dish Name: ${dishName}
Department: ${department || "Main Kitchen"}
Category: ${category || "Main Course"}
Target Selling Price (BDT): ${targetSellingPrice || "Not specified"}
Existing Available Raw Materials in Inventory: ${JSON.stringify(existingRawItems || [])}
Language: English

Return ONLY a JSON object with this schema:
{
  "suggestedPrice": number,
  "estimatedCost": number,
  "profitMarginPercent": number,
  "chefTips": "string with cooking tips and portion control advice",
  "suggestedIngredients": [
    {
      "rawName": "string name of ingredient",
      "qty": number,
      "uom": "Kg / Ltr / Pcs / Gm / Ml",
      "estimatedRate": number,
      "cost": number
    }
  ]
}`;

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("Empty AI response");
      const parsed = JSON.parse(responseText);
      return res.json({ success: true, data: parsed, source: "gemini" });
    } catch (err: any) {
      console.error("Recipe AI error:", err);
      res.status(500).json({ success: false, error: err?.message || "Failed to analyze recipe" });
    }
  });

  // AI Product Listing Generator
  app.post("/api/ai/generate-product-content", async (req, res) => {
    try {
      const { title, category, keywords, price, targetAudience, language } = req.body;
      const client = getAIClient();

      if (!client) {
        // High quality fallback template generator if key is not present
        const generated = {
          title: title || "Premium Quality Product",
          shortDescription: `Crafted with premium materials, ${title || "this product"} combines elegance, durability, and top-tier functionality for an elevated experience.`,
          fullDescription: `Discover the perfect blend of quality and modern craftsmanship with the ${title || "all-new collection"}. Engineered to deliver outstanding performance and aesthetic appeal, this item exceeds expectations for daily use or thoughtful gifting.\n\nKey Highlights:\n• High-grade durable build with meticulous finishing\n• Contemporary ergonomic design suitable for versatile use\n• Rigorously inspected for optimal satisfaction\n• Fast and secure doorstep delivery`,
          features: [
            "Premium grade materials & sleek finish",
            "Highly durable & easy maintenance",
            "Cash on delivery & fast reliable shipping",
            "100% satisfaction and quality assurance"
          ],
          suggestedTags: [category, "BestSeller", "Trending", "SpecialOffer", "NewArrival"].filter(Boolean),
          seoKeywords: `${title}, ${category}, buy ${title} online, best price ${title}`
        };
        return res.json({ success: true, data: generated, source: "template" });
      }

      const prompt = `You are an expert e-commerce copywriter. Generate compelling, high-converting product marketing content in JSON format for an online store.
Product details:
- Product Title/Concept: ${title}
- Category: ${category || "General"}
- Key Features / Notes: ${keywords || "High quality, durable"}
- Price: ${price || "Competitive"}
- Target Audience: ${targetAudience || "Modern shoppers"}
- Language: English

Return ONLY a valid JSON object matching this exact schema:
{
  "title": "A catchy, polished product title",
  "shortDescription": "A concise 1-2 sentence hook for product cards",
  "fullDescription": "A detailed 2-3 paragraph product description with key selling points",
  "features": ["Bullet point 1", "Bullet point 2", "Bullet point 3", "Bullet point 4"],
  "suggestedTags": ["Tag1", "Tag2", "Tag3", "Tag4"],
  "seoKeywords": "comma separated SEO search keywords"
}`;

      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response from AI model");
      }

      const parsed = JSON.parse(responseText);
      return res.json({ success: true, data: parsed, source: "gemini" });
    } catch (error: any) {
      console.error("AI Generation error:", error);
      res.status(500).json({ 
        success: false, 
        error: error?.message || "Failed to generate AI product content" 
      });
    }
  });

  // Vite middleware in dev or static files in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/restaurant_data.json', '**/.env*'],
          usePolling: true,
          interval: 500
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`E-Commerce Platform Server running on http://localhost:${PORT}`);
  });
}

startServer();

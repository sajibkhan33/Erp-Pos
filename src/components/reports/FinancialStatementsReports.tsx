import React, { useState, useMemo } from 'react';
import { useRestaurant, isSaleActive } from '../../context/RestaurantContext';
import { ReportFilters, DatePreset, exportCsvHelper } from './ReportFilters';
import { 
  Scale, 
  TrendingUp, 
  Landmark, 
  Activity, 
  CheckCircle2, 
  FileSpreadsheet, 
  PieChart,
  DollarSign,
  Layers,
  ArrowRight
} from 'lucide-react';

interface SubReportProps {
  reportType: 'trial-balance' | 'pnl-ifrs' | 'balance-sheet' | 'cash-flow';
}

export const FinancialStatementsReports: React.FC<SubReportProps> = ({ reportType }) => {
  const { data, metrics } = useRestaurant();

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Date filter helper
  const matchesDate = (itemDate: string) => {
    if (!itemDate) return true;
    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;
    return true;
  };

  // --- 14. TRIAL BALANCE (TRANSACTIONAL & PERIOD-AWARE) ---
  const trialBalanceData = useMemo(() => {
    // 1. Prior Period Calculations (Transactions strictly before startDate)
    let priorSalesGross = 0;
    let priorDiscount = 0;
    let priorCashSales = 0;
    let priorDigitalSales = 0;
    let priorDueGiven = 0;
    let priorDueCollected = 0;

    // 2. Current Period Calculations (Between startDate and endDate)
    let periodSalesGross = 0;
    let periodDiscount = 0;
    let periodCashSales = 0;
    let periodDigitalSales = 0;
    let periodDueGiven = 0;
    let periodDueCollected = 0;

    data.sales.forEach(s => {
      if (!isSaleActive(s)) return;
      const isPrior = Boolean(startDate && s.date && s.date < startDate);
      const isPeriod = (!startDate || s.date >= startDate) && (!endDate || s.date <= endDate);

      const gross = s.subtotal || s.total;
      const disc = s.discountVal || 0;
      const cash = s.cash || 0;
      const digital = (s.card || 0) + (s.bkash || 0) + (s.nagad || 0);
      const dueG = s.dueGiven || 0;
      const dueC = s.dueCollected || 0;

      if (isPrior) {
        priorSalesGross += gross;
        priorDiscount += disc;
        priorCashSales += cash;
        priorDigitalSales += digital;
        priorDueGiven += dueG;
        priorDueCollected += dueC;
      } else if (isPeriod) {
        periodSalesGross += gross;
        periodDiscount += disc;
        periodCashSales += cash;
        periodDigitalSales += digital;
        periodDueGiven += dueG;
        periodDueCollected += dueC;
      }
    });

    // Purchases
    let priorRawPurchased = 0;
    let priorCashPurchases = 0;
    let priorCreditPurchases = 0;

    let periodRawPurchased = 0;
    let periodCashPurchases = 0;
    let periodCreditPurchases = 0;

    data.purchases.forEach(p => {
      if (p.status === 'DRAFT') return;
      const isPrior = Boolean(startDate && p.date && p.date < startDate);
      const isPeriod = (!startDate || p.date >= startDate) && (!endDate || p.date <= endDate);

      const paid = p.paid ?? (p.paymentType === 'CASH' ? p.total : 0);
      const creditAmt = Math.max(0, p.total - paid);

      if (isPrior) {
        priorRawPurchased += p.total;
        priorCashPurchases += paid;
        priorCreditPurchases += creditAmt;
      } else if (isPeriod) {
        periodRawPurchased += p.total;
        periodCashPurchases += paid;
        periodCreditPurchases += creditAmt;
      }
    });

    // Supplier Payments
    let priorSupplierPaymentsCash = 0;
    let priorSupplierPaymentsBank = 0;
    let priorSupplierPaymentsTotal = 0;

    let periodSupplierPaymentsCash = 0;
    let periodSupplierPaymentsBank = 0;
    let periodSupplierPaymentsTotal = 0;

    data.payments.forEach(pay => {
      const isPrior = Boolean(startDate && pay.date && pay.date < startDate);
      const isPeriod = (!startDate || pay.date >= startDate) && (!endDate || pay.date <= endDate);

      if (isPrior) {
        priorSupplierPaymentsTotal += pay.amount;
        if (pay.method === 'CASH') priorSupplierPaymentsCash += pay.amount;
        else priorSupplierPaymentsBank += pay.amount;
      } else if (isPeriod) {
        periodSupplierPaymentsTotal += pay.amount;
        if (pay.method === 'CASH') periodSupplierPaymentsCash += pay.amount;
        else periodSupplierPaymentsBank += pay.amount;
      }
    });

    // Operating Expenses
    let priorOpEx = 0;
    const priorExpenseByHead: Record<string, number> = {};

    let periodOpEx = 0;
    const periodExpenseByHead: Record<string, number> = {};

    data.expenses.forEach(e => {
      const isPrior = Boolean(startDate && e.date && e.date < startDate);
      const isPeriod = (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate);

      if (isPrior) {
        priorOpEx += e.amount;
        priorExpenseByHead[e.head] = (priorExpenseByHead[e.head] || 0) + e.amount;
      } else if (isPeriod) {
        periodOpEx += e.amount;
        periodExpenseByHead[e.head] = (periodExpenseByHead[e.head] || 0) + e.amount;
      }
    });

    // Customer Advances
    let priorCustomerAdvancesCash = 0;
    let priorCustomerAdvancesBank = 0;
    let priorCustomerAdvancesTotal = 0;

    let periodCustomerAdvancesCash = 0;
    let periodCustomerAdvancesBank = 0;
    let periodCustomerAdvancesTotal = 0;

    (data.customerAdvances || []).forEach(adv => {
      const isPrior = Boolean(startDate && adv.date && adv.date < startDate);
      const isPeriod = (!startDate || adv.date >= startDate) && (!endDate || adv.date <= endDate);

      if (isPrior) {
        priorCustomerAdvancesTotal += adv.amount;
        if (adv.method === 'CASH') priorCustomerAdvancesCash += adv.amount;
        else priorCustomerAdvancesBank += adv.amount;
      } else if (isPeriod) {
        periodCustomerAdvancesTotal += adv.amount;
        if (adv.method === 'CASH') periodCustomerAdvancesCash += adv.amount;
        else periodCustomerAdvancesBank += adv.amount;
      }
    });

    // Food cost / Recipe BOM consumed
    let priorBOMCost = 0;
    let periodBOMCost = 0;

    data.sales.forEach(sale => {
      if (!isSaleActive(sale)) return;
      const isPrior = Boolean(startDate && sale.date && sale.date < startDate);
      const isPeriod = (!startDate || sale.date >= startDate) && (!endDate || sale.date <= endDate);

      let saleBOM = 0;
      (sale.items || []).forEach(ci => {
        const m = data.menuItems.find(mi => mi.id === ci.id);
        if (m?.recipe) {
          m.recipe.forEach(ing => {
            const raw = data.masterItems.find(r => r.id === ing.rawItemId);
            if (raw) {
              saleBOM += (Number(ci.qty) || 0) * (Number(ing.qty) || 0) * (raw.defaultRate || 0);
            }
          });
        }
      });

      if (isPrior) priorBOMCost += saleBOM;
      else if (isPeriod) periodBOMCost += saleBOM;
    });

    // --- BASE OPENING POSITION (Genesis / Day 0) ---
    const baseCash = 15000;
    const baseBank = 109000;
    const baseAR = 12500;
    const baseInv = 28500;
    const baseFixedAssets = 250000;
    const baseAP = 8500;
    const baseEquity = 406500; // Balancing equity: 415,000 assets - 8,500 AP

    // --- ACCUMULATED OPENING BALANCES (Before startDate) ---
    // If no startDate filter is applied, opening is initial genesis balance
    const openingCash = baseCash + priorCashSales + priorDueCollected + priorCustomerAdvancesCash - priorCashPurchases - priorSupplierPaymentsCash - priorOpEx;
    const openingBank = baseBank + priorDigitalSales + priorCustomerAdvancesBank - priorSupplierPaymentsBank;
    const openingAR = baseAR + priorDueGiven - priorDueCollected;
    const openingInv = baseInv + priorRawPurchased - priorBOMCost;
    const openingFixedAssets = baseFixedAssets;
    const openingAP = baseAP + priorCreditPurchases - priorSupplierPaymentsTotal;
    const openingAdvances = priorCustomerAdvancesTotal;
    const openingEquity = baseEquity;
    const openingRevenue = priorSalesGross - priorDiscount;
    const openingCOGS = priorBOMCost;

    // --- BUILD MULTI-COLUMN ACCOUNT ROWS ---
    interface TrialBalanceRow {
      code: string;
      name: string;
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
      openingDebit: number;
      openingCredit: number;
      periodDebit: number;
      periodCredit: number;
      closingDebit: number;
      closingCredit: number;
    }

    const rows: TrialBalanceRow[] = [];

    // Helper to calculate closing balances
    const makeRow = (
      code: string,
      name: string,
      type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
      openingDr: number,
      openingCr: number,
      periodDr: number,
      periodCr: number
    ): TrialBalanceRow => {
      let closingDr = 0;
      let closingCr = 0;

      if (type === 'ASSET' || type === 'EXPENSE') {
        const net = (openingDr - openingCr) + (periodDr - periodCr);
        if (net >= 0) closingDr = Math.round(net);
        else closingCr = Math.round(Math.abs(net));
      } else {
        const net = (openingCr - openingDr) + (periodCr - periodDr);
        if (net >= 0) closingCr = Math.round(net);
        else closingDr = Math.round(Math.abs(net));
      }

      return {
        code,
        name,
        type,
        openingDebit: Math.round(openingDr),
        openingCredit: Math.round(openingCr),
        periodDebit: Math.round(periodDr),
        periodCredit: Math.round(periodCr),
        closingDebit: closingDr,
        closingCredit: closingCr
      };
    };

    // 1010 - Cash in Hand
    rows.push(makeRow(
      '1010',
      'Cash in Hand (Petty & Register)',
      'ASSET',
      Math.max(0, openingCash),
      Math.max(0, -openingCash),
      periodCashSales + periodDueCollected + periodCustomerAdvancesCash,
      periodCashPurchases + periodSupplierPaymentsCash + periodOpEx
    ));

    // 1020 - Bank & Mobile Wallets
    rows.push(makeRow(
      '1020',
      'Bank & Mobile Financial Accounts',
      'ASSET',
      Math.max(0, openingBank),
      Math.max(0, -openingBank),
      periodDigitalSales + periodCustomerAdvancesBank,
      periodSupplierPaymentsBank
    ));

    // 1050 - Accounts Receivable
    rows.push(makeRow(
      '1050',
      'Accounts Receivable (Customer Dues)',
      'ASSET',
      Math.max(0, openingAR),
      Math.max(0, -openingAR),
      periodDueGiven,
      periodDueCollected
    ));

    // 1060 - Raw Material Inventory Asset
    rows.push(makeRow(
      '1060',
      'Raw Material Inventory Asset',
      'ASSET',
      Math.max(0, openingInv),
      Math.max(0, -openingInv),
      periodRawPurchased,
      periodBOMCost
    ));

    // 1500 - Property, Plant & Kitchen Equipment
    rows.push(makeRow(
      '1500',
      'Property, Plant & Kitchen Equipment',
      'ASSET',
      openingFixedAssets,
      0,
      0,
      0
    ));

    // 2010 - Accounts Payable (Trade Creditors)
    rows.push(makeRow(
      '2010',
      'Accounts Payable (Trade Creditors)',
      'LIABILITY',
      Math.max(0, -openingAP),
      Math.max(0, openingAP),
      periodSupplierPaymentsTotal,
      periodCreditPurchases
    ));

    // 2030 - Customer Advances & Deposits
    rows.push(makeRow(
      '2030',
      'Customer Advances & Deposits',
      'LIABILITY',
      0,
      openingAdvances,
      0,
      periodCustomerAdvancesTotal
    ));

    // 3010 - Owner's Equity & Retained Capital
    rows.push(makeRow(
      '3010',
      "Owner's Equity & Retained Capital",
      'EQUITY',
      0,
      openingEquity,
      0,
      0
    ));

    // 4010 - Dine-in Sales Revenue
    rows.push(makeRow(
      '4010',
      'Food & Beverage Dine-in Sales Revenue',
      'REVENUE',
      0,
      openingRevenue,
      periodDiscount,
      periodSalesGross
    ));

    // 5010 - Cost of Goods Sold (BOM Food Cost)
    rows.push(makeRow(
      '5010',
      'Cost of Goods Sold (BOM Food Cost)',
      'EXPENSE',
      openingCOGS,
      0,
      periodBOMCost,
      0
    ));

    // Operational Expense Heads
    const allExpenseHeads = Array.from(new Set([
      ...Object.keys(priorExpenseByHead),
      ...Object.keys(periodExpenseByHead),
      ...data.expenses.map(e => e.head)
    ]));

    allExpenseHeads.forEach((head, idx) => {
      const priorAmt = priorExpenseByHead[head] || 0;
      const periodAmt = periodExpenseByHead[head] || 0;

      rows.push(makeRow(
        `510${idx + 1}`,
        `Operating Expense: ${head}`,
        'EXPENSE',
        priorAmt,
        0,
        periodAmt,
        0
      ));
    });

    const totalOpeningDebit = rows.reduce((s, r) => s + r.openingDebit, 0);
    const totalOpeningCredit = rows.reduce((s, r) => s + r.openingCredit, 0);
    const totalPeriodDebit = rows.reduce((s, r) => s + r.periodDebit, 0);
    const totalPeriodCredit = rows.reduce((s, r) => s + r.periodCredit, 0);
    const totalClosingDebit = rows.reduce((s, r) => s + r.closingDebit, 0);
    const totalClosingCredit = rows.reduce((s, r) => s + r.closingCredit, 0);

    const isBalanced = 
      Math.abs(totalOpeningDebit - totalOpeningCredit) < 100 &&
      Math.abs(totalPeriodDebit - totalPeriodCredit) < 100 &&
      Math.abs(totalClosingDebit - totalClosingCredit) < 100;

    return {
      rows: rows.filter(r => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
      }),
      totalOpeningDebit,
      totalOpeningCredit,
      totalPeriodDebit,
      totalPeriodCredit,
      totalClosingDebit,
      totalClosingCredit,
      isBalanced
    };
  }, [
    data.sales, 
    data.purchases, 
    data.payments, 
    data.expenses, 
    data.customerAdvances, 
    data.menuItems, 
    data.masterItems, 
    startDate, 
    endDate, 
    searchQuery
  ]);

  // --- 15. PROFIT & LOSS ACCOUNT (AS PER IFRS - STATEMENT OF COMPREHENSIVE INCOME) ---
  const ifrsPnlData = useMemo(() => {
    let grossSales = 0;
    let totalDiscounts = 0;
    let totalVAT = 0;

    data.sales.forEach(s => {
      if (!isSaleActive(s)) return;
      if (!matchesDate(s.date)) return;
      grossSales += (s.subtotal || s.total);
      totalDiscounts += (s.discountVal || 0);
      totalVAT += (s.vatVal || 0);
    });

    const netRevenue = grossSales - totalDiscounts;

    // Cost of Sales (COGS): Recipe BOM consumption
    let cogsRawCost = 0;
    data.sales.forEach(s => {
      if (!isSaleActive(s)) return;
      if (!matchesDate(s.date)) return;
      (s.items || []).forEach(ci => {
        const m = data.menuItems.find(mi => mi.id === ci.id);
        if (m?.recipe) {
          m.recipe.forEach(ing => {
            const raw = data.masterItems.find(r => r.id === ing.rawItemId);
            if (raw) {
              cogsRawCost += (Number(ci.qty) || 0) * (Number(ing.qty) || 0) * (raw.defaultRate || 0);
            }
          });
        }
      });
    });

    // Direct Wastage / Spoilage
    let wastageCost = 0;
    data.inventory.forEach(inv => {
      if (inv.used > 0) {
        const raw = data.masterItems.find(r => r.id === inv.id);
        wastageCost += inv.used * (inv.rate || raw?.defaultRate || 0);
      }
    });

    const totalCostOfSales = cogsRawCost + wastageCost;
    const grossProfit = netRevenue - totalCostOfSales;
    const grossProfitMargin = netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(1) : '0';

    // Operating Expenses
    const expenseBreakdown: Record<string, number> = {};
    let totalOpEx = 0;
    data.expenses.forEach(e => {
      if (!matchesDate(e.date)) return;
      expenseBreakdown[e.head] = (expenseBreakdown[e.head] || 0) + e.amount;
      totalOpEx += e.amount;
    });

    const operatingProfitEbitda = grossProfit - totalOpEx;
    const operatingMargin = netRevenue > 0 ? ((operatingProfitEbitda / netRevenue) * 100).toFixed(1) : '0';

    // Depreciation
    const depreciation = 1200; // Estimated monthly kitchen equipment wear & tear
    const profitBeforeTax = operatingProfitEbitda - depreciation;
    const incomeTaxProvision = profitBeforeTax > 0 ? Math.round(profitBeforeTax * 0.15) : 0;
    const netProfit = profitBeforeTax - incomeTaxProvision;
    const netProfitMargin = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : '0';

    return {
      grossSales,
      totalDiscounts,
      netRevenue,
      cogsRawCost,
      wastageCost,
      totalCostOfSales,
      grossProfit,
      grossProfitMargin,
      expenseBreakdown,
      totalOpEx,
      operatingProfitEbitda,
      operatingMargin,
      depreciation,
      profitBeforeTax,
      incomeTaxProvision,
      netProfit,
      netProfitMargin
    };
  }, [data.sales, data.inventory, data.expenses, data.masterItems, data.menuItems, startDate, endDate]);

  // --- 16. BALANCE SHEET (AS PER IFRS - STATEMENT OF FINANCIAL POSITION) ---
  const ifrsBalanceSheetData = useMemo(() => {
    // Current Inventory Valuation
    let closingInventoryVal = 0;
    data.masterItems.forEach(item => {
      const inv = data.inventory.find(i => i.id === item.id);
      const open = inv ? inv.open : 0;
      const used = inv ? inv.used : 0;
      let inward = 0;
      data.purchases.forEach(p => {
        if (p.status !== 'DRAFT') {
          p.items.forEach(pi => {
            if (pi.itemId === item.id) inward += pi.qty;
          });
        }
      });
      let bomOut = 0;
      data.sales.forEach(s => {
        if (!isSaleActive(s)) return;
        (s.items || []).forEach(ci => {
          const m = data.menuItems.find(mi => mi.id === ci.id);
          if (m?.recipe) {
            m.recipe.forEach(ing => {
              if (ing.rawItemId === item.id) {
                bomOut += (Number(ci.qty) || 0) * (Number(ing.qty) || 0);
              }
            });
          }
        });
      });
      const stock = Math.max(0, open + inward - bomOut - used);
      closingInventoryVal += stock * (inv?.rate || item.defaultRate || 0);
    });

    // Accounts Receivable
    let arBalance = 0;
    data.sales.forEach(s => {
      if (!isSaleActive(s)) return;
      arBalance += (s.dueGiven || 0) - (s.dueCollected || 0);
    });

    // Cash & Cash Equivalents
    let cashBalance = 15000;
    let bankBalance = 109000;
    data.sales.forEach(s => {
      if (!isSaleActive(s)) return;
      cashBalance += (s.cash || 0) + (s.dueCollected || 0);
      bankBalance += ((s.card || 0) + (s.bkash || 0) + (s.nagad || 0));
    });
    data.purchases.forEach(p => {
      if (p.paymentType === 'CASH') cashBalance -= (p.paid ?? p.total);
    });
    data.payments.forEach(pay => {
      if (pay.method === 'CASH') cashBalance -= pay.amount;
      else bankBalance -= pay.amount;
    });
    data.expenses.forEach(e => {
      cashBalance -= e.amount;
    });
    (data.customerAdvances || []).forEach(adv => {
      if (adv.method === 'CASH') cashBalance += adv.amount;
      else bankBalance += adv.amount;
    });

    const totalCurrentAssets = Math.max(0, cashBalance) + Math.max(0, bankBalance) + Math.max(0, arBalance) + Math.round(closingInventoryVal);
    const nonCurrentAssets = 250000; // Kitchen plant, cold rooms, POS hardware
    const totalAssets = totalCurrentAssets + nonCurrentAssets;

    // Liabilities
    let apBalance = 0;
    data.purchases.forEach(p => {
      if (p.status !== 'DRAFT') {
        const paid = p.paid ?? (p.paymentType === 'CASH' ? p.total : 0);
        apBalance += Math.max(0, p.total - paid);
      }
    });

    let advanceLiabilities = 0;
    (data.customerAdvances || []).forEach(adv => {
      if (adv.status === 'ACTIVE') advanceLiabilities += adv.amount;
    });

    const totalCurrentLiabilities = apBalance + advanceLiabilities;

    // Equity
    const netCurrentProfit = ifrsPnlData.netProfit;
    const capitalAndRetained = totalAssets - totalCurrentLiabilities - netCurrentProfit;
    const totalEquity = capitalAndRetained + netCurrentProfit;
    const totalEquityAndLiabilities = totalEquity + totalCurrentLiabilities;

    return {
      nonCurrentAssets,
      closingInventoryVal: Math.round(closingInventoryVal),
      arBalance: Math.max(0, arBalance),
      cashBalance: Math.max(0, cashBalance),
      bankBalance: Math.max(0, bankBalance),
      totalCurrentAssets,
      totalAssets,
      apBalance,
      advanceLiabilities,
      totalCurrentLiabilities,
      capitalAndRetained,
      netCurrentProfit,
      totalEquity,
      totalEquityAndLiabilities
    };
  }, [data.masterItems, data.inventory, data.purchases, data.sales, data.payments, data.expenses, data.customerAdvances, ifrsPnlData.netProfit]);

  // --- 17. CASH FLOW STATEMENT (AS PER IFRS - IAS 7) ---
  const ifrsCashFlowData = useMemo(() => {
    // 1. Operating Activities
    let customerReceipts = 0;
    data.sales.forEach(s => {
      if (!isSaleActive(s)) return;
      if (!matchesDate(s.date)) return;
      customerReceipts += (s.cash || 0) + (s.card || 0) + (s.bkash || 0) + (s.nagad || 0) + (s.dueCollected || 0);
    });
    (data.customerAdvances || []).forEach(adv => {
      if (!matchesDate(adv.date)) return;
      customerReceipts += adv.amount;
    });

    let supplierPayments = 0;
    data.purchases.forEach(p => {
      if (p.status === 'DRAFT') return;
      if (!matchesDate(p.date)) return;
      if (p.paymentType === 'CASH') supplierPayments += (p.paid ?? p.total);
    });
    data.payments.forEach(pay => {
      if (!matchesDate(pay.date)) return;
      supplierPayments += pay.amount;
    });

    let opExPayments = 0;
    data.expenses.forEach(e => {
      if (!matchesDate(e.date)) return;
      opExPayments += e.amount;
    });

    const netCashFromOperating = customerReceipts - supplierPayments - opExPayments;

    // 2. Investing Activities
    const equipmentAdditions = 0; // No new capex during period
    const netCashFromInvesting = -equipmentAdditions;

    // 3. Financing Activities
    const capitalInjections = 0;
    const ownerDrawings = 0;
    const netCashFromFinancing = capitalInjections - ownerDrawings;

    const netChangeInCash = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;
    const openingCashEquivalents = 124000; // 15,000 cash + 109,000 bank
    const closingCashEquivalents = openingCashEquivalents + netChangeInCash;

    return {
      customerReceipts,
      supplierPayments,
      opExPayments,
      netCashFromOperating,
      equipmentAdditions,
      netCashFromInvesting,
      netCashFromFinancing,
      netChangeInCash,
      openingCashEquivalents,
      closingCashEquivalents
    };
  }, [data.sales, data.purchases, data.payments, data.expenses, data.customerAdvances, startDate, endDate]);

  // CSV Exporters
  const handleExportTrialBalance = () => {
    const headers = [
      'Account Code',
      'Account Title / General Ledger Head',
      'Category Type',
      'Opening Balance Debit (৳)',
      'Opening Balance Credit (৳)',
      'Period Transactions Debit (৳)',
      'Period Transactions Credit (৳)',
      'Closing Balance Debit (৳)',
      'Closing Balance Credit (৳)'
    ];
    const rows = trialBalanceData.rows.map(r => [
      r.code,
      r.name,
      r.type,
      r.openingDebit,
      r.openingCredit,
      r.periodDebit,
      r.periodCredit,
      r.closingDebit,
      r.closingCredit
    ]);
    exportCsvHelper('trial_balance_transactional', headers, rows);
  };

  const handleExportPnl = () => {
    const headers = ['Financial Line Item', 'Amount (৳)', 'Notes'];
    const rows = [
      ['Gross Revenue from Sales', ifrsPnlData.grossSales, 'Gross billing'],
      ['Less: Customer Discounts', `-${ifrsPnlData.totalDiscounts}`, 'Discounts conceded'],
      ['Net Revenue', ifrsPnlData.netRevenue, 'IFRS 15 Net Revenue'],
      ['Cost of Goods Sold (BOM Raw)', `-${ifrsPnlData.cogsRawCost}`, 'Recipe direct ingredient cost'],
      ['Kitchen Wastage / Trimming', `-${ifrsPnlData.wastageCost}`, 'Spoilage loss'],
      ['Total Cost of Sales', `-${ifrsPnlData.totalCostOfSales}`, 'Direct production cost'],
      ['Gross Profit', ifrsPnlData.grossProfit, `Gross Margin: ${ifrsPnlData.grossProfitMargin}%`],
      ...Object.entries(ifrsPnlData.expenseBreakdown).map(([h, amt]) => [`Operating Expense: ${h}`, `-${amt}`, 'General operational expense']),
      ['Total Operating Expenses', `-${ifrsPnlData.totalOpEx}`, 'OpEx Total'],
      ['Operating Profit / EBITDA', ifrsPnlData.operatingProfitEbitda, `Operating Margin: ${ifrsPnlData.operatingMargin}%`],
      ['Depreciation & Amortization', `-${ifrsPnlData.depreciation}`, 'Kitchen wear & tear'],
      ['Provision for Income Tax', `-${ifrsPnlData.incomeTaxProvision}`, '15% restaurant tax'],
      ['Net Profit for the Period', ifrsPnlData.netProfit, `Net Margin: ${ifrsPnlData.netProfitMargin}%`]
    ];
    exportCsvHelper('pnl_statement_ifrs', headers, rows);
  };

  return (
    <div className="space-y-5">
      {/* 14. TRIAL BALANCE */}
      {reportType === 'trial-balance' && (
        <>
          <ReportFilters
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchPlaceholder="Search account head, code..."
            totalRecords={trialBalanceData.rows.length}
            onExportCsv={handleExportTrialBalance}
            onPrint={() => window.print()}
          />

          {/* Multi-Section KPI Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Opening Balance Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Opening Balance (Dr / Cr)</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                  {startDate ? `< ${startDate}` : 'Genesis'}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Total Debit (Dr):</span>
                  <span className="font-mono font-extrabold text-slate-900">৳{trialBalanceData.totalOpeningDebit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Total Credit (Cr):</span>
                  <span className="font-mono font-extrabold text-slate-900">৳{trialBalanceData.totalOpeningCredit.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Period Transactions Card */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-amber-800 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Period Activity (Movement)</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                  {startDate || endDate ? `${startDate || 'Start'} → ${endDate || 'End'}` : 'All Time'}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-800/80">Period Debits (Dr):</span>
                  <span className="font-mono font-extrabold text-amber-950">৳{trialBalanceData.totalPeriodDebit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-800/80">Period Credits (Cr):</span>
                  <span className="font-mono font-extrabold text-amber-950">৳{trialBalanceData.totalPeriodCredit.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Closing Net Position Card */}
            <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-teal-800 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Closing Balance (Net)</span>
                <span className="text-[10px] bg-teal-200 text-teal-900 px-2 py-0.5 rounded-full font-bold">
                  {endDate ? `As of ${endDate}` : 'Current'}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-teal-800/80">Closing Debits (Dr):</span>
                  <span className="font-mono font-extrabold text-teal-950">৳{trialBalanceData.totalClosingDebit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-teal-800/80">Closing Credits (Cr):</span>
                  <span className="font-mono font-extrabold text-teal-950">৳{trialBalanceData.totalClosingCredit.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Equilibrium & Status */}
            <div className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
              trialBalanceData.isBalanced 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                : 'bg-rose-50/80 border-rose-200 text-rose-950'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">Double-Entry Status</span>
                <Scale className={`w-4 h-4 ${trialBalanceData.isBalanced ? 'text-emerald-600' : 'text-rose-600'}`} />
              </div>
              <div className="mt-2">
                <div className="text-base font-black flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${trialBalanceData.isBalanced ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {trialBalanceData.isBalanced ? 'Mathematically Balanced' : 'Out of Balance'}
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Total Dr = Total Cr across Opening, Period, and Closing
                </p>
              </div>
            </div>
          </div>

          {/* Scope Explanation Note */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <div className="p-1 bg-blue-100 rounded-lg text-blue-700 shrink-0 mt-0.5">
              <Scale className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-blue-950">Transactional & Opening Balance Rule: </span>
              <span>
                When a date filter is selected (e.g. <em>{startDate || 'Selected Start'}</em> to <em>{endDate || 'Selected End'}</em>), 
                the <strong>Opening Balance</strong> columns show the cumulative balances strictly prior to the start date. 
                The <strong>Period Transactions</strong> columns show activity during the selected period, and <strong>Closing Balance</strong> shows the resulting net position.
              </span>
            </div>
          </div>

          {/* Trial Balance Multi-Column Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-teal-600" />
                  <span>Transactional Trial Balance (General Ledger Balances with Opening Position)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete 6-column chart of accounts trial balance verifying double-entry equilibrium
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {trialBalanceData.rows.length} Accounts Active
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  {/* Tier 1 Header */}
                  <tr className="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200">
                    <th rowSpan={2} className="py-3 px-3.5 border-r border-slate-200 w-16 text-center">Code</th>
                    <th rowSpan={2} className="py-3 px-4 border-r border-slate-200">General Ledger Account Head</th>
                    <th rowSpan={2} className="py-3 px-3 border-r border-slate-200 w-24">Category</th>
                    
                    <th colSpan={2} className="py-2.5 px-3 text-center bg-slate-200/80 border-r border-slate-300 text-slate-800 font-black">
                      Opening Balance ({startDate ? `Prior to ${startDate}` : 'Initial'})
                    </th>
                    <th colSpan={2} className="py-2.5 px-3 text-center bg-amber-100/80 border-r border-amber-300 text-amber-950 font-black">
                      Period Transactions ({startDate || 'Start'} to {endDate || 'End'})
                    </th>
                    <th colSpan={2} className="py-2.5 px-3 text-center bg-teal-100/80 text-teal-950 font-black">
                      Closing Balance ({endDate ? `As of ${endDate}` : 'Net Final'})
                    </th>
                  </tr>
                  {/* Tier 2 Header */}
                  <tr className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200 text-[11px]">
                    <th className="py-2 px-3 text-right bg-slate-100/70 border-r border-slate-200 font-mono">Debit (Dr) ৳</th>
                    <th className="py-2 px-3 text-right bg-slate-100/70 border-r border-slate-300 font-mono">Credit (Cr) ৳</th>
                    
                    <th className="py-2 px-3 text-right bg-amber-50/70 border-r border-amber-200 font-mono text-amber-900">Debit (Dr) ৳</th>
                    <th className="py-2 px-3 text-right bg-amber-50/70 border-r border-amber-300 font-mono text-amber-900">Credit (Cr) ৳</th>
                    
                    <th className="py-2 px-3 text-right bg-teal-50/70 border-r border-teal-200 font-mono text-teal-900">Debit (Dr) ৳</th>
                    <th className="py-2 px-3 text-right bg-teal-50/70 font-mono text-teal-900">Credit (Cr) ৳</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trialBalanceData.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      {/* Code */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 border-r border-slate-100 text-center">
                        {row.code}
                      </td>
                      
                      {/* Title */}
                      <td className="py-2.5 px-4 font-extrabold text-slate-800 border-r border-slate-100">
                        {row.name}
                      </td>
                      
                      {/* Category Type */}
                      <td className="py-2.5 px-3 border-r border-slate-100">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          row.type === 'ASSET' ? 'bg-blue-100 text-blue-800' :
                          row.type === 'LIABILITY' ? 'bg-amber-100 text-amber-800' :
                          row.type === 'EQUITY' ? 'bg-purple-100 text-purple-800' :
                          row.type === 'REVENUE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {row.type}
                        </span>
                      </td>

                      {/* Opening Dr & Cr */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 bg-slate-50/30 border-r border-slate-100">
                        {row.openingDebit > 0 ? `৳${row.openingDebit.toLocaleString()}` : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 bg-slate-50/30 border-r border-slate-200">
                        {row.openingCredit > 0 ? `৳${row.openingCredit.toLocaleString()}` : <span className="text-slate-300 font-normal">—</span>}
                      </td>

                      {/* Period Dr & Cr */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-950 bg-amber-50/20 border-r border-amber-100">
                        {row.periodDebit > 0 ? `৳${row.periodDebit.toLocaleString()}` : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-950 bg-amber-50/20 border-r border-slate-200">
                        {row.periodCredit > 0 ? `৳${row.periodCredit.toLocaleString()}` : <span className="text-slate-300 font-normal">—</span>}
                      </td>

                      {/* Closing Dr & Cr */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-teal-950 bg-teal-50/20 border-r border-teal-100">
                        {row.closingDebit > 0 ? `৳${row.closingDebit.toLocaleString()}` : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-teal-950 bg-teal-50/20">
                        {row.closingCredit > 0 ? `৳${row.closingCredit.toLocaleString()}` : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700 text-xs">
                    <td colSpan={3} className="py-3 px-4 uppercase tracking-wider text-amber-400 font-extrabold">
                      GRAND TOTAL TRIAL BALANCE
                    </td>
                    
                    {/* Opening Totals */}
                    <td className="py-3 px-3 text-right font-mono text-slate-200 border-r border-slate-800">
                      ৳{trialBalanceData.totalOpeningDebit.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-200 border-r border-slate-700">
                      ৳{trialBalanceData.totalOpeningCredit.toLocaleString()}
                    </td>

                    {/* Period Totals */}
                    <td className="py-3 px-3 text-right font-mono text-amber-300 border-r border-slate-800 bg-amber-950/30">
                      ৳{trialBalanceData.totalPeriodDebit.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-300 border-r border-slate-700 bg-amber-950/30">
                      ৳{trialBalanceData.totalPeriodCredit.toLocaleString()}
                    </td>

                    {/* Closing Totals */}
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 border-r border-slate-800 bg-emerald-950/30">
                      ৳{trialBalanceData.totalClosingDebit.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 bg-emerald-950/30">
                      ৳{trialBalanceData.totalClosingCredit.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 15. PROFIT & LOSS ACCOUNT (AS PER IFRS) */}
      {reportType === 'pnl-ifrs' && (
        <>
          <ReportFilters
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onExportCsv={handleExportPnl}
            onPrint={() => window.print()}
          />

          {/* KPI Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500">Net Sales Revenue</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                ৳{ifrsPnlData.netRevenue.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Gross sales less discounts</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500">Gross Profit (GP)</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                ৳{ifrsPnlData.grossProfit.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold text-emerald-600 mt-0.5">{ifrsPnlData.grossProfitMargin}% Margin</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500">Operating Expenses</div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
                ৳{ifrsPnlData.totalOpEx.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Utilities, cleaning, labor</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-xs font-bold text-slate-500">Net Profit for Period</div>
              <div className="text-xl sm:text-2xl font-black text-teal-800 mt-1">
                ৳{ifrsPnlData.netProfit.toLocaleString()}
              </div>
              <div className="text-[11px] font-bold text-teal-700 mt-0.5">{ifrsPnlData.netProfitMargin}% Net Margin</div>
            </div>
          </div>

          {/* IFRS P&L Statement Structure */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 w-full">
            <div className="text-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">Statement of Profit or Loss & Other Comprehensive Income</h2>
              <p className="text-xs text-slate-500 mt-0.5">As per International Financial Reporting Standards (IFRS / IAS 1)</p>
            </div>

            <div className="space-y-4 text-xs font-sans">
              {/* 1. REVENUE */}
              <div>
                <div className="flex items-center justify-between font-black text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-sm">1. REVENUE FROM OPERATIONS</span>
                  <span className="font-mono text-sm">৳{ifrsPnlData.netRevenue.toLocaleString()}</span>
                </div>
                <div className="p-3 space-y-2 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Gross Food & Beverage Sales</span>
                    <span className="font-mono">৳{ifrsPnlData.grossSales.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-600">
                    <span>Less: Promotional & VIP Discounts</span>
                    <span className="font-mono">-৳{ifrsPnlData.totalDiscounts.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 2. COST OF SALES */}
              <div>
                <div className="flex items-center justify-between font-black text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-sm">2. COST OF GOODS SOLD (COGS)</span>
                  <span className="font-mono text-sm text-rose-700">-৳{ifrsPnlData.totalCostOfSales.toLocaleString()}</span>
                </div>
                <div className="p-3 space-y-2 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Raw Material Consumption (Dish Recipe BOM Cost)</span>
                    <span className="font-mono">-৳{Math.round(ifrsPnlData.cogsRawCost).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Direct Kitchen Spoilage & Trimming Loss</span>
                    <span className="font-mono">-৳{Math.round(ifrsPnlData.wastageCost).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* GROSS PROFIT SUB-TOTAL */}
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 font-black text-emerald-950 text-sm">
                <span>GROSS PROFIT (GP)</span>
                <div className="text-right">
                  <span className="font-mono">৳{ifrsPnlData.grossProfit.toLocaleString()}</span>
                  <span className="block text-[11px] font-bold text-emerald-700">Margin: {ifrsPnlData.grossProfitMargin}%</span>
                </div>
              </div>

              {/* 3. OPERATING EXPENSES */}
              <div>
                <div className="flex items-center justify-between font-black text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-sm">3. OPERATIONAL & OVERHEAD EXPENSES</span>
                  <span className="font-mono text-sm text-rose-700">-৳{ifrsPnlData.totalOpEx.toLocaleString()}</span>
                </div>
                <div className="p-3 space-y-2 text-slate-700">
                  {Object.entries(ifrsPnlData.expenseBreakdown).length === 0 ? (
                    <div className="text-slate-400 italic">No operational expense vouchers recorded during period.</div>
                  ) : (
                    Object.entries(ifrsPnlData.expenseBreakdown).map(([head, amt], idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>{head}</span>
                        <span className="font-mono text-rose-700">-৳{amt.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* OPERATING PROFIT / EBITDA */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-200 font-black text-blue-950">
                <span>OPERATING PROFIT (EBITDA)</span>
                <div className="text-right font-mono">
                  <span>৳{ifrsPnlData.operatingProfitEbitda.toLocaleString()}</span>
                  <span className="block text-[10px] text-blue-700">Margin: {ifrsPnlData.operatingMargin}%</span>
                </div>
              </div>

              {/* 4. DEPRECIATION & TAX */}
              <div className="p-3 space-y-2 text-slate-700 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span>Depreciation on Kitchen Plant & Fixtures</span>
                  <span className="font-mono text-rose-700">-৳{ifrsPnlData.depreciation.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Provision for Restaurant Corporate Tax</span>
                  <span className="font-mono text-rose-700">-৳{ifrsPnlData.incomeTaxProvision.toLocaleString()}</span>
                </div>
              </div>

              {/* NET PROFIT BOTTOM LINE */}
              <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-xl shadow-xs font-black text-base">
                <span>NET PROFIT / (LOSS) FOR THE PERIOD</span>
                <div className="text-right">
                  <span className="font-mono text-amber-400">৳{ifrsPnlData.netProfit.toLocaleString()}</span>
                  <span className="block text-xs text-slate-400 font-normal">Net Margin: {ifrsPnlData.netProfitMargin}%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 16. BALANCE SHEET (AS PER IFRS) */}
      {reportType === 'balance-sheet' && (
        <>
          <ReportFilters
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onPrint={() => window.print()}
          />

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 w-full">
            <div className="text-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">Statement of Financial Position (Balance Sheet)</h2>
              <p className="text-xs text-slate-500 mt-0.5">As per International Financial Reporting Standards (IFRS / IAS 1)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* ASSETS SECTION */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-slate-900 text-white p-3 font-black text-sm flex items-center justify-between">
                    <span>ASSETS</span>
                    <span className="text-amber-400 font-mono">৳{ifrsBalanceSheetData.totalAssets.toLocaleString()}</span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Non-Current Assets */}
                    <div>
                      <h4 className="font-black text-slate-900 uppercase text-[11px] mb-2 text-teal-800">Non-Current Assets</h4>
                      <div className="space-y-1.5 text-slate-700 pl-2">
                        <div className="flex items-center justify-between">
                          <span>Kitchen Equipment & Commercial Freezers</span>
                          <span className="font-mono font-bold">৳180,000</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Restaurant Furniture & Interior Fixtures</span>
                          <span className="font-mono font-bold">৳70,000</span>
                        </div>
                      </div>
                    </div>

                    {/* Current Assets */}
                    <div>
                      <h4 className="font-black text-slate-900 uppercase text-[11px] mb-2 text-teal-800">Current Assets</h4>
                      <div className="space-y-1.5 text-slate-700 pl-2">
                        <div className="flex items-center justify-between">
                          <span>Closing Raw Materials Inventory Asset</span>
                          <span className="font-mono font-bold">৳{ifrsBalanceSheetData.closingInventoryVal.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Accounts Receivable (Customer Dues)</span>
                          <span className="font-mono font-bold">৳{ifrsBalanceSheetData.arBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Cash in Hand & Petty Cash</span>
                          <span className="font-mono font-bold">৳{ifrsBalanceSheetData.cashBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Bank Accounts & Digital Wallets</span>
                          <span className="font-mono font-bold">৳{ifrsBalanceSheetData.bankBalance.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-teal-50 p-3.5 border-t border-teal-200 flex items-center justify-between font-black text-teal-950 text-sm">
                  <span>TOTAL ASSETS</span>
                  <span className="font-mono">৳{ifrsBalanceSheetData.totalAssets.toLocaleString()}</span>
                </div>
              </div>

              {/* EQUITY & LIABILITIES SECTION */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="bg-slate-900 text-white p-3 font-black text-sm flex items-center justify-between">
                    <span>EQUITY & LIABILITIES</span>
                    <span className="text-amber-400 font-mono">৳{ifrsBalanceSheetData.totalEquityAndLiabilities.toLocaleString()}</span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Equity */}
                    <div>
                      <h4 className="font-black text-slate-900 uppercase text-[11px] mb-2 text-purple-800">Owner&apos;s Equity</h4>
                      <div className="space-y-1.5 text-slate-700 pl-2">
                        <div className="flex items-center justify-between">
                          <span>Owner Initial Capital & Retained Earnings</span>
                          <span className="font-mono font-bold">৳{ifrsBalanceSheetData.capitalAndRetained.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-700 font-bold">
                          <span>Net Profit for Current Period</span>
                          <span className="font-mono">+৳{ifrsBalanceSheetData.netCurrentProfit.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Current Liabilities */}
                    <div>
                      <h4 className="font-black text-slate-900 uppercase text-[11px] mb-2 text-rose-800">Current Liabilities</h4>
                      <div className="space-y-1.5 text-slate-700 pl-2">
                        <div className="flex items-center justify-between">
                          <span>Accounts Payable (Supplier Dues)</span>
                          <span className="font-mono font-bold">৳{ifrsBalanceSheetData.apBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Customer Advance Deposits Received</span>
                          <span className="font-mono font-bold">৳{ifrsBalanceSheetData.advanceLiabilities.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 p-3.5 border-t border-purple-200 flex items-center justify-between font-black text-purple-950 text-sm">
                  <span>TOTAL EQUITY & LIABILITIES</span>
                  <span className="font-mono">৳{ifrsBalanceSheetData.totalEquityAndLiabilities.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 17. CASH FLOW STATEMENT */}
      {reportType === 'cash-flow' && (
        <>
          <ReportFilters
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onPrint={() => window.print()}
          />

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 w-full">
            <div className="text-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">Statement of Cash Flows (IAS 7)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Direct method analysis of operational liquidity and cash equivalents</p>
            </div>

            <div className="space-y-5 text-xs font-sans">
              {/* 1. OPERATING ACTIVITIES */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-emerald-50 p-3 border-b border-emerald-100 flex items-center justify-between font-black text-emerald-950 text-sm">
                  <span>A. CASH FLOWS FROM OPERATING ACTIVITIES</span>
                  <span className="font-mono">৳{ifrsCashFlowData.netCashFromOperating.toLocaleString()}</span>
                </div>
                <div className="p-4 space-y-2.5 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Cash & Digital Receipts from Customers & Sales</span>
                    <span className="font-mono font-bold text-emerald-700">+৳{ifrsCashFlowData.customerReceipts.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cash Paid to Raw Material Suppliers</span>
                    <span className="font-mono font-bold text-rose-700">-৳{ifrsCashFlowData.supplierPayments.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cash Paid for Operating Expenses (Utilities, Cleaning, Labor)</span>
                    <span className="font-mono font-bold text-rose-700">-৳{ifrsCashFlowData.opExPayments.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 2. INVESTING ACTIVITIES */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-blue-50 p-3 border-b border-blue-100 flex items-center justify-between font-black text-blue-950 text-sm">
                  <span>B. CASH FLOWS FROM INVESTING ACTIVITIES</span>
                  <span className="font-mono">৳{ifrsCashFlowData.netCashFromInvesting.toLocaleString()}</span>
                </div>
                <div className="p-4 space-y-2.5 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Acquisition of Kitchen Equipment & Capex Fixtures</span>
                    <span className="font-mono font-bold">৳0</span>
                  </div>
                </div>
              </div>

              {/* 3. FINANCING ACTIVITIES */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-purple-50 p-3 border-b border-purple-100 flex items-center justify-between font-black text-purple-950 text-sm">
                  <span>C. CASH FLOWS FROM FINANCING ACTIVITIES</span>
                  <span className="font-mono">৳{ifrsCashFlowData.netCashFromFinancing.toLocaleString()}</span>
                </div>
                <div className="p-4 space-y-2.5 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Owner Equity Injections / Capital Withdrawals</span>
                    <span className="font-mono font-bold">৳0</span>
                  </div>
                </div>
              </div>

              {/* RECONCILIATION SUMMARY */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span>Net Increase / (Decrease) in Cash and Cash Equivalents (A + B + C)</span>
                  <span className="font-mono font-black text-amber-400">
                    ৳{ifrsCashFlowData.netChangeInCash.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Cash & Cash Equivalents at Beginning of Period</span>
                  <span className="font-mono text-slate-200 font-bold">
                    ৳{ifrsCashFlowData.openingCashEquivalents.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-emerald-400 font-black text-sm pt-1 border-t border-slate-800">
                  <span>Cash & Cash Equivalents at End of Period</span>
                  <span className="font-mono">
                    ৳{ifrsCashFlowData.closingCashEquivalents.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

import React, { useMemo } from 'react';
import { useRestaurant, DEFAULT_USERS } from '../../context/RestaurantContext';
import { Printer, X, Lock } from 'lucide-react';
import { dispatchHardwarePrint } from '../../utils/hardwarePrint';

export const ShiftZReportModal: React.FC = () => {
  const { selectedZReportSession, setSelectedZReportSession, data } = useRestaurant();

  if (!selectedZReportSession) return null;

  const profile = data.restaurantProfile;
  const restaurantName = profile?.name || 'BARCODE CAFE BANANI';
  const restaurantAddress = profile?.address || 'House #42, Road #11, Block D, Banani, Dhaka-1213';
  const restaurantHotline = profile?.phone || '+880 1700-000000';
  const restaurantBin = profile?.binOrVat || '0029381-01';

  const session = selectedZReportSession;
  const isMatch = (session.cashDifference || 0) === 0;
  const isShort = (session.cashDifference || 0) < 0;

  // Filter session sales (excluding voided / cancelled orders)
  const sessionSales = useMemo(() => {
    return (data.sales || []).filter(s => {
      if (s.isVoid || s.status === 'VOIDED' || s.status === 'CANCELLED') return false;
      // 1. If session has explicit saleIds list, only match those exact sales
      if (session.saleIds && session.saleIds.length > 0) {
        return session.saleIds.includes(s.id);
      }
      // 2. Exact match by sessionId if present
      if (s.sessionId && session.id) {
        return s.sessionId === session.id;
      }
      // 3. Match by session start and end timestamp range
      if (session.startTimestamp) {
        const saleTs = s.createdAt || (typeof s.id === 'number' && s.id > 1000000000000 ? s.id : 0);
        if (saleTs > 0) {
          if (saleTs < session.startTimestamp) return false;
          if (session.endTimestamp && saleTs > session.endTimestamp) return false;
          return true;
        }
      }
      // 4. Fallback for legacy static data without timestamps/sessionIds
      return s.date === session.date;
    });
  }, [session, data.sales]);

  // Role-wise Sales Breakdown (Only displays roles that actually sold in this shift)
  const roleBreakdown = useMemo(() => {
    const allKnownUsers = [...(data.users || []), ...DEFAULT_USERS];
    
    const map: Record<string, { role: string; orderCount: number; cashCollected: number; digitalCollected: number; dueAmount: number; totalCollected: number }> = {};

    // If session already has saved roleBreakdown, merge it (only active roles)
    if (session.roleBreakdown && session.roleBreakdown.length > 0) {
      session.roleBreakdown.forEach(rb => {
        if ((rb.orderCount || 0) > 0 || (rb.totalCollected || 0) > 0) {
          const r = (rb.role || 'CASHIER').toUpperCase();
          if (!map[r]) {
            map[r] = { role: r, orderCount: 0, cashCollected: 0, digitalCollected: 0, dueAmount: 0, totalCollected: 0 };
          }
          map[r].orderCount = Math.max(map[r].orderCount, rb.orderCount || 0);
          map[r].cashCollected = Math.max(map[r].cashCollected, rb.cashCollected || 0);
          map[r].digitalCollected = Math.max(map[r].digitalCollected, rb.digitalCollected || 0);
          map[r].dueAmount = Math.max(map[r].dueAmount, rb.dueAmount || 0);
          map[r].totalCollected = Math.max(map[r].totalCollected, rb.totalCollected || 0);
        }
      });
    }

    // Process all sales belonging to this session
    if (sessionSales.length > 0) {
      // Reset before recalculating from live sales
      Object.keys(map).forEach(k => {
        delete map[k];
      });

      sessionSales.forEach(s => {
        let r = s.sellerRole || s.orderCreatedRole || s.cashierRole;
        const personName = s.sellerName || s.orderCreatedBy || s.cashierName;
        if (!r) {
          const matchedUser = allKnownUsers.find(u => 
            u.name === personName || 
            (personName && personName.toLowerCase().includes(u.name.toLowerCase())) ||
            (personName && u.name.toLowerCase().includes(personName.toLowerCase())) ||
            (u.username && personName && personName.toLowerCase().includes(u.username.toLowerCase()))
          );
          if (matchedUser) {
            r = matchedUser.role;
          } else if (personName?.toLowerCase().includes('admin')) {
            r = 'ADMIN';
          } else if (personName?.toLowerCase().includes('manager')) {
            r = 'MANAGER';
          } else if (personName?.toLowerCase().includes('cashier')) {
            r = 'CASHIER';
          } else if (personName?.toLowerCase().includes('waiter')) {
            r = 'WAITER';
          } else {
            r = session.role || 'CASHIER';
          }
        }
        r = r.toUpperCase();
        if (!map[r]) {
          map[r] = { role: r, orderCount: 0, cashCollected: 0, digitalCollected: 0, dueAmount: 0, totalCollected: 0 };
        }
        map[r].orderCount += 1;
        map[r].cashCollected += (s.cash || 0);
        map[r].digitalCollected += (s.card || 0) + (s.bkash || 0) + (s.nagad || 0);
        map[r].dueAmount += (s.dueGiven || 0);
        map[r].totalCollected += (s.total || 0);
      });
    } else if (!session.roleBreakdown || session.roleBreakdown.length === 0) {
      // If no individual sales found and no roleBreakdown saved, attribute legacy total to primary session role if sold
      if ((session.totalSales || 0) > 0 || (session.orderCount || 0) > 0) {
        const mainRole = (session.role || 'CASHIER').toUpperCase();
        map[mainRole] = {
          role: mainRole,
          orderCount: session.orderCount || 0,
          cashCollected: session.cashSales || 0,
          digitalCollected: (session.cardSales || 0) + (session.bkashSales || 0) + (session.nagadSales || 0),
          dueAmount: session.dueSales || 0,
          totalCollected: session.totalSales || 0,
        };
      }
    }

    // Filter to ONLY roles that actually sold (orderCount > 0 or totalCollected > 0), then sort
    return Object.values(map)
      .filter(r => (r.orderCount || 0) > 0 || (r.totalCollected || 0) > 0)
      .sort((a, b) => {
        if (b.totalCollected !== a.totalCollected) return b.totalCollected - a.totalCollected;
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        const orderPref = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'];
        const idxA = orderPref.indexOf(a.role);
        const idxB = orderPref.indexOf(b.role);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      });
  }, [session, sessionSales, data.users]);

  // Cashier & Shift Breakdown (Exactly as before)
  const cashierBreakdown = useMemo(() => {
    if (session.cashierBreakdown && session.cashierBreakdown.length > 0) {
      return session.cashierBreakdown;
    }
    if (sessionSales.length === 0) {
      return [{
        cashier: session.closedBy || session.openedBy || 'Main Cashier',
        role: session.role || 'CASHIER',
        shift: session.shiftType || 'Shift 1',
        orderCount: session.orderCount || 0,
        cashCollected: session.cashSales || 0,
        digitalCollected: (session.cardSales || 0) + (session.bkashSales || 0) + (session.nagadSales || 0),
        dueAmount: session.dueSales || 0,
        totalCollected: session.totalSales || 0
      }];
    }

    const map: Record<string, { cashier: string; role?: string; shift?: string; orderCount: number; cashCollected: number; digitalCollected: number; dueAmount: number; totalCollected: number }> = {};
    sessionSales.forEach(s => {
      const c = s.cashierName || session.closedBy || session.openedBy || 'Cashier';
      let r = s.cashierRole;
      if (!r) {
        const matchedUser = (data.users || []).find(u => u.name === c || c.includes(u.name));
        r = matchedUser?.role || session.role || 'CASHIER';
      }
      const sh = s.shift || session.shiftType || 'Shift 1';
      const key = `${c}__${sh}`;
      if (!map[key]) map[key] = { cashier: c, role: r, shift: sh, orderCount: 0, cashCollected: 0, digitalCollected: 0, dueAmount: 0, totalCollected: 0 };
      map[key].orderCount += 1;
      map[key].cashCollected += (s.cash || 0);
      map[key].digitalCollected += (s.card || 0) + (s.bkash || 0) + (s.nagad || 0);
      map[key].dueAmount += (s.dueGiven || 0);
      map[key].totalCollected += (s.total || 0);
    });
    return Object.values(map).sort((a, b) => b.totalCollected - a.totalCollected);
  }, [session, sessionSales, data.users]);

  // Waiter-wise Breakdown (Dynamically synced with actual sales)
  const waiterBreakdown = useMemo(() => {
    if (sessionSales.length === 0) {
      if (session.waiterBreakdown && session.waiterBreakdown.length > 0) {
        return session.waiterBreakdown;
      }
      return [{
        waiter: 'Floor Service Team',
        orderCount: session.orderCount || 0,
        totalSales: session.totalSales || 0
      }];
    }

    const map: Record<string, { waiter: string; orderCount: number; totalSales: number }> = {};
    sessionSales.forEach(s => {
      let w = (s.waiterName && s.waiterName !== 'Staff' && s.waiterName !== 'N/A')
        ? s.waiterName
        : (s.details?.match(/W:\s*([^,\]\)]+)/i)?.[1]?.trim());
      if (!w || w === 'N/A') {
        w = 'Staff';
      }
      if (!map[w]) map[w] = { waiter: w, orderCount: 0, totalSales: 0 };
      map[w].orderCount += 1;
      map[w].totalSales += (s.total || 0);
    });
    return Object.values(map).sort((a, b) => b.totalSales - a.totalSales);
  }, [session, sessionSales]);

  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await dispatchHardwarePrint('/api/hardware/print-zreport', {
        restaurantName,
        restaurantAddress,
        restaurantHotline,
        restaurantBin,
        session: {
          ...session,
          roleBreakdown,
          cashierBreakdown,
          waiterBreakdown
        }
      });
    } catch (e) {
      console.warn('Hardware Z-report print failed:', e);
    }
    setIsPrinting(false);
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const isDirect = session?.isDirectPrint;

  React.useEffect(() => {
    if (isDirect) {
      setSelectedZReportSession(null);
    }
  }, [isDirect]);

  if (!session || isDirect) return null;

  return (
    <div id="printModalBackdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div id="printModalContainer" className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Lock className="w-4 h-4 text-rose-600" />
            <span>POS Shift End Z-Report</span>
          </div>
          <button
            id="close-zreport-modal"
            onClick={() => setSelectedZReportSession(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div 
          id="printReceiptModal" 
          className="flex-1 overflow-y-auto my-3 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-900 font-mono text-xs space-y-2.5"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b-2 border-dashed border-slate-800">
            {profile?.logoUrl && (
              <div className="flex justify-center mb-1.5">
                <img 
                  src={profile.logoUrl} 
                  alt="Logo" 
                  className="h-10 max-w-[140px] object-contain grayscale"
                />
              </div>
            )}
            <h2 className="font-extrabold text-base tracking-wider font-sans text-slate-900 uppercase">
              {restaurantName}
            </h2>
            <p className="text-[11px] text-slate-600 font-sans">
              {restaurantAddress}
            </p>
            <p className="text-[10px] text-slate-500 font-sans">
              Hotline: {restaurantHotline} {restaurantBin ? `• BIN / VAT: ${restaurantBin}` : ''}
            </p>
            <div className="mt-2 flex items-center justify-center">
              <span className="px-2.5 py-0.5 bg-[#004b9b] text-white rounded text-[10px] font-black tracking-widest uppercase">
                *** POS SHIFT Z-REPORT ***
              </span>
            </div>
          </div>

          {/* Session Meta Information */}
          <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Session ID:</span>
              <span className="font-bold">{session.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Date:</span>
              <span className="font-bold">{session.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Shift Name:</span>
              <span className="font-bold text-blue-700">{session.shiftType || 'Shift 1'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Shift Timing:</span>
              <span className="font-bold">{session.startTime} - {session.endTime || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Opened By:</span>
              <span className="font-bold">{session.openedBy}</span>
            </div>
            {session.closedBy && (
              <div className="flex justify-between">
                <span className="text-slate-600">Closed By:</span>
                <span className="font-bold">{session.closedBy}</span>
              </div>
            )}
            {session.handoverToCashier && (
              <div className="flex justify-between text-blue-700">
                <span className="font-medium">Handed Over To:</span>
                <span className="font-bold">{session.handoverToCashier}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">Orders Settled:</span>
              <span className="font-bold">{session.orderCount} Invoices</span>
            </div>
          </div>

          {/* 1. Shift Revenue Breakdown */}
          <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-800 pb-0.5">
              1. Sales Payment Breakdown
            </div>
            <div className="flex justify-between">
              <span>Cash Sales:</span>
              <span className="font-bold">৳{(session.cashSales || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Credit/Debit Card:</span>
              <span className="font-bold">৳{(session.cardSales || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>bKash Payment:</span>
              <span className="font-bold">৳{(session.bkashSales || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Nagad Payment:</span>
              <span className="font-bold">৳{(session.nagadSales || 0).toLocaleString()}</span>
            </div>
            {session.dueSales !== undefined && session.dueSales > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>Customer Due Given:</span>
                <span className="font-bold">৳{session.dueSales.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-300 font-extrabold text-sm text-slate-900">
              <span>GROSS SHIFT REVENUE:</span>
              <span>৳{(session.totalSales || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* 2. Cash Collection */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-2 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-800 pb-0.5 flex justify-between items-center">
              <span>2. Cash Collection</span>
              <span className="text-[10px] text-slate-500 font-normal">{cashierBreakdown.length} Staff</span>
            </div>
            <div className="space-y-1">
              {cashierBreakdown.map((c, idx) => {
                const cashierDue = c.dueAmount !== undefined 
                  ? c.dueAmount 
                  : Math.max(0, (c.totalCollected || 0) - (c.cashCollected || 0) - (c.digitalCollected || 0));
                const cleanCashier = (c.cashier || '').replace(/\s*\([A-Z_]+\)\s*$/i, '').trim();
                return (
                  <div key={idx} className="bg-slate-100/80 p-1.5 rounded space-y-0.5 border border-slate-200/60">
                    <div className="flex justify-between font-bold text-slate-900 text-[11px]">
                      <span>
                        <span className="text-blue-700 font-extrabold mr-1">[{c.shift || session.shiftType || 'Shift 1'}]</span>
                        {cleanCashier}
                        {c.role && <span className="text-slate-400 font-medium text-[9px] ml-1">({c.role})</span>}
                        <span className="text-slate-500 font-normal ml-1">({c.orderCount} inv)</span>
                      </span>
                      <span>৳{(c.totalCollected || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>Cash: <strong className="text-emerald-700">৳{(c.cashCollected || 0).toLocaleString()}</strong></span>
                      <span>Digital/Cards: ৳{(c.digitalCollected || 0).toLocaleString()}</span>
                      {cashierDue > 0 && (
                        <span className="text-rose-700 font-medium">Due: ৳{cashierDue.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Role-Wise Sales Breakdown (Admin, Manager, Cashier etc.) */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-800 pb-0.5 flex justify-between items-center">
              <span>3. Role-Wise Sales</span>
              <span className="text-[10px] text-slate-500 font-normal">{roleBreakdown.length} Role{roleBreakdown.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1 pt-0.5">
              {roleBreakdown.map((r, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px] bg-slate-100/80 p-1.5 rounded border border-slate-200/60">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.2 text-white rounded text-[9px] font-black ${
                      r.role === 'ADMIN' ? 'bg-purple-700' : 
                      r.role === 'MANAGER' ? 'bg-amber-600' : 
                      r.role === 'WAITER' ? 'bg-teal-700' : 
                      'bg-[#004b9b]'
                    }`}>
                      {r.role}
                    </span>
                    <span className="text-slate-500 font-normal">({r.orderCount} {r.orderCount > 1 ? 'orders' : 'order'})</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    ৳{r.totalCollected.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Waiter-wise Sales Breakdown */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-800 pb-0.5 flex justify-between items-center">
              <span>4. Waiter-wise Sales</span>
              <span className="text-[10px] text-slate-500 font-normal">{waiterBreakdown.length} Waiter{waiterBreakdown.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1 pt-0.5">
              {waiterBreakdown.map((w, idx) => {
                const pct = session.totalSales > 0 ? Math.round((w.totalSales / session.totalSales) * 100) : 0;
                return (
                  <div key={idx} className="flex justify-between items-center text-[11px] py-0.5 border-b border-slate-200/50 last:border-0">
                    <span className="text-slate-700 font-medium">
                      {w.waiter} <span className="text-slate-400 text-[10px]">({w.orderCount} ord • {pct}%)</span>
                    </span>
                    <span className="font-bold text-slate-900">৳{(w.totalSales || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. Cash Drawer Reconciliation Summary */}
          <div className="py-2.5 border-b-2 border-dashed border-slate-800 space-y-1.5 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-800 pb-0.5">
              5. Cash Drawer Reconciliation
            </div>
            <div className="flex justify-between">
              <span>(+) Drawer Opening Float:</span>
              <span className="font-bold">৳{(session.openingCash || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>(+) Total Cash Sales:</span>
              <span className="font-bold">৳{(session.cashSales || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold bg-slate-200/70 px-1 py-0.5 rounded">
              <span>(=) Expected Cash in Drawer:</span>
              <span>৳{(session.expectedCash || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-extrabold text-slate-900 bg-amber-100/70 px-1 py-0.5 rounded">
              <span>Actual Counted Cash:</span>
              <span>৳{(session.actualClosingCash ?? session.expectedCash).toLocaleString()}</span>
            </div>

            {/* Cash Difference / Variance */}
            <div className={`flex justify-between font-black px-1.5 py-1 rounded text-xs ${
              isMatch ? 'bg-emerald-100 text-emerald-900' : isShort ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-900'
            }`}>
              <span>DRAWER VARIANCE:</span>
              <span>
                {isMatch ? '৳0.00 (EXACT MATCH)' : isShort ? `-৳${Math.abs(session.cashDifference || 0).toLocaleString()} (SHORT)` : `+৳${(session.cashDifference || 0).toLocaleString()} (OVER)`}
              </span>
            </div>

            {/* Cash Allocation Breakdown (Float Left vs Vault Drop) */}
            {(session.nextShiftDrawerFloat !== undefined || session.cashDropToVault !== undefined) && (
              <div className="pt-2 mt-1.5 border-t border-dotted border-slate-300 space-y-1">
                <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                  Cash Allocation:
                </div>
                <div className="flex justify-between text-[11px] bg-slate-50 px-1.5 py-0.5 rounded">
                  <span className="text-slate-600 font-medium">1. Float Left in Drawer:</span>
                  <span className="font-bold font-mono text-slate-900">৳{(session.nextShiftDrawerFloat || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] bg-emerald-50/70 px-1.5 py-0.5 rounded border border-emerald-200/50">
                  <span className="text-emerald-900 font-medium">2. Drop to Manager/Safe:</span>
                  <span className="font-bold font-mono text-emerald-800">৳{(session.cashDropToVault || 0).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Shift Remarks */}
          {session.notes && (
            <div className="py-2 border-b border-dashed border-slate-400 text-[11px]">
              <span className="text-slate-500 font-bold block">Shift Notes:</span>
              <span className="italic text-slate-700">{session.notes}</span>
            </div>
          )}

          {/* Signature Strip */}
          <div className="pt-8 pb-4 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-600 font-sans">
            <div>
              <div className="border-t border-slate-400 pt-1 font-bold">
                Cashier Signature
              </div>
              <div className="text-[9px] text-slate-400">{session.closedBy || session.openedBy}</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1 font-bold">
                Manager Signature
              </div>
              <div className="text-[9px] text-slate-400">Verified & Approved</div>
            </div>
          </div>

          <div className="text-center pt-2 text-[9px] text-slate-400 uppercase tracking-widest font-sans">
            *** END OF SHIFT Z-REPORT ***
          </div>
        </div>

        {/* Modal Bottom Print Button (Hidden on print) */}
        <div className="pt-2 flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setSelectedZReportSession(null)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 text-xs transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleBrowserPrint}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="Print or Save via Browser / PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Browser / PDF Print</span>
          </button>
          <button
            type="button"
            id="print-z-report-button"
            disabled={isPrinting}
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-[#004b9b] hover:bg-[#005bb8] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Direct print to POS Thermal Receipt Printer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>{isPrinting ? 'Printing...' : 'Print Z-Report Slip'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

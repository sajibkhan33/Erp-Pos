import React, { useMemo } from 'react';
import { useRestaurant, DEFAULT_USERS } from '../../context/RestaurantContext';
import { Printer, X, Calendar, Clock, User, CheckCircle2, AlertTriangle, Wallet, Coins, Layers, ArrowRight, DollarSign, Trash2 } from 'lucide-react';
import { dispatchHardwarePrint } from '../../utils/hardwarePrint';

export const ConsolidatedDayZReportModal: React.FC = () => {
  const { selectedDayEndPreview, setSelectedDayEndPreview, data, deleteDayEndRecord } = useRestaurant();

  if (!selectedDayEndPreview) return null;

  const day = selectedDayEndPreview;
  const profile = data.restaurantProfile;
  const restaurantName = profile?.name || 'BARCODE CAFE BANANI';
  const restaurantAddress = profile?.address || 'House #42, Road #11, Block D, Banani, Dhaka-1213';
  const restaurantHotline = profile?.phone || '+880 1700-000000';
  const restaurantBin = profile?.binOrVat || '0029381-01';

  // All shifts logged for this date (including active live session if today)
  const daySessions = useMemo(() => {
    const list = (data.posSessions || []).filter(s => s.date === day.date);
    // If active session is running today and not yet closed in posSessions, add it
    if (data.session?.isActive && (data.session.startDate === day.date || new Date().toISOString().split('T')[0] === day.date)) {
      const exists = list.some(s => s.id === data.session?.id);
      if (!exists && data.session.id) {
        list.push({
          id: data.session.id,
          date: day.date,
          openedBy: data.session.openedBy || 'Active Cashier',
          shiftType: data.session.shiftType || (list.length === 0 ? 'Shift 1' : `Shift ${list.length + 1}`),
          startTime: data.session.startTime || 'Now',
          startTimestamp: data.session.startTimestamp || Date.now(),
          openingCash: data.session.openingCash || 0,
          cashSales: 0,
          cardSales: 0,
          bkashSales: 0,
          nagadSales: 0,
          dueSales: 0,
          totalSales: 0,
          orderCount: 0,
          expectedCash: data.session.openingCash || 0,
          actualClosingCash: undefined,
          cashDifference: 0,
          status: 'OPEN'
        });
      }
    }

    // Sort chronologically (Shift 1, Shift 2...)
    return [...list].sort((a, b) => {
      if (a.startTimestamp && b.startTimestamp) return a.startTimestamp - b.startTimestamp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
  }, [data.posSessions, data.session, day.date]);

  const firstSession = daySessions[0];
  const lastSession = daySessions[daySessions.length - 1];

  const openedBy = day.openedBy || day.dayRecord?.openedBy || firstSession?.openedBy || (data.businessDay?.date === day.date && data.businessDay.openedBy ? data.businessDay.openedBy : 'Cashier');
  const openedAt = day.openedAt || day.dayRecord?.openedAt || firstSession?.startTime || (data.businessDay?.date === day.date && data.businessDay.openedAt ? data.businessDay.openedAt : 'Start of Day');
  const openingCash = day.openingCash ?? day.dayRecord?.openingCash ?? firstSession?.openingCash ?? 0;

  const closedBy = day.closedBy || day.dayRecord?.closedBy || (lastSession?.closedBy || (day.isClosed ? 'Manager / Admin' : 'Pending Day-End'));
  const closedAt = day.closedAt || day.dayRecord?.closedAt || (lastSession?.endTime || (day.isClosed ? 'Closed' : 'Active In Progress'));
  const closingCash = day.closingCash ?? day.dayRecord?.closingCash ?? (lastSession?.actualClosingCash ?? lastSession?.expectedCash ?? day.totalCash);

  // Expenses logged for this date
  const dayExpensesList = useMemo(() => {
    return (data.expenses || []).filter(e => e.date === day.date);
  }, [data.expenses, day.date]);

  // Sales logged for this date (excluding voided)
  const daySalesList = useMemo(() => {
    return (data.sales || []).filter(s => s.date === day.date && !s.isVoid && s.status !== 'VOIDED' && s.status !== 'CANCELLED');
  }, [data.sales, day.date]);

  // Real-time consolidated sales metrics synchronized with all day sessions
  const consolidatedSales = useMemo(() => {
    if (daySessions.length > 0) {
      const cash = daySessions.reduce((sum, s) => sum + (s.cashSales || 0), 0);
      const card = daySessions.reduce((sum, s) => sum + (s.cardSales || 0), 0);
      const bkash = daySessions.reduce((sum, s) => sum + (s.bkashSales || 0), 0);
      const nagad = daySessions.reduce((sum, s) => sum + (s.nagadSales || 0), 0);
      const due = daySessions.reduce((sum, s) => sum + (s.dueSales || 0), 0);
      const total = daySessions.reduce((sum, s) => sum + (s.totalSales || 0), 0);
      const orders = daySessions.reduce((sum, s) => sum + (s.orderCount || 0), 0) || daySalesList.length || day.dayRecord?.totalDayOrders || 0;
      return { cash, card, bkash, nagad, due, total, orders };
    }
    return {
      cash: day.totalCash,
      card: day.totalCard,
      bkash: day.totalBkash,
      nagad: day.totalNagad,
      due: day.totalDue,
      total: day.totalSales,
      orders: day.dayRecord?.totalDayOrders || daySalesList.length || 0
    };
  }, [daySessions, day, daySalesList.length]);

  const totalOrdersCount = consolidatedSales.orders;

  // Role-wise collection breakdown for the entire day (Only roles that made sales)
  const roleBreakdown = useMemo(() => {
    const allKnownUsers = [...(data.users || []), ...DEFAULT_USERS];
    const map: Record<string, { role: string; orderCount: number; cashCollected: number; digitalCollected: number; dueAmount: number; totalCollected: number }> = {};

    if (daySalesList.length > 0) {
      daySalesList.forEach(s => {
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
            r = 'CASHIER';
          }
        }
        r = r.toUpperCase();
        if (!map[r]) map[r] = { role: r, orderCount: 0, cashCollected: 0, digitalCollected: 0, dueAmount: 0, totalCollected: 0 };
        map[r].orderCount += 1;
        map[r].cashCollected += (s.cash || 0);
        map[r].digitalCollected += (s.card || 0) + (s.bkash || 0) + (s.nagad || 0);
        map[r].dueAmount += (s.dueGiven || 0);
        map[r].totalCollected += (s.total || 0);
      });
    }

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
  }, [daySalesList, totalOrdersCount, data.users]);

  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await dispatchHardwarePrint('/api/hardware/print-dayend', {
        restaurantName,
        restaurantAddress,
        restaurantHotline,
        restaurantBin,
        dayRecord: day.dayRecord || {
          id: `DAY-${day.date.replace(/-/g, '')}`,
          date: day.date,
          totalDaySales: day.totalSales,
          totalDayOrders: totalOrdersCount,
          shiftCount: day.shiftCount,
          shiftIds: daySessions.map(s => s.id),
          totalCash: day.totalCash,
          totalCard: day.totalCard,
          totalBkash: day.totalBkash,
          totalNagad: day.totalNagad,
          totalDue: day.totalDue,
          totalExpenses: day.totalExpenses,
          netCashToVault: day.netCashToVault,
          openedBy,
          openedAt,
          openingCash,
          closingCash,
          closedBy,
          closedAt: closedAt || new Date().toLocaleString(),
          notes: 'Consolidated Master Day-End Z-Report'
        },
        daySessions
      });
    } catch (e) {
      console.warn('Hardware Day-End print failed:', e);
    }
    setIsPrinting(false);
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const isDirect = day?.isDirectPrint || day?.dayRecord?.isDirectPrint;

  React.useEffect(() => {
    if (isDirect) {
      setSelectedDayEndPreview(null);
    }
  }, [isDirect]);

  if (!day || isDirect) return null;

  return (
    <div 
      id="printModalBackdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
    >
      <div 
        id="printModalContainer" 
        className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]"
      >
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 no-print">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Daily Master Day-End Z-Report</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDayEndPreview(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Container */}
        <div 
          id="printReceiptModal" 
          className="flex-1 overflow-y-auto my-2 p-3 sm:p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-900 font-mono text-xs space-y-3"
        >
          {/* 1. Header */}
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
            <h2 className="font-black text-base tracking-wider font-sans text-slate-900 uppercase">
              {restaurantName}
            </h2>
            <p className="text-[11px] text-slate-600 font-sans">
              {restaurantAddress}
            </p>
            <p className="text-[10px] text-slate-500 font-sans">
              Hotline: {restaurantHotline} {restaurantBin ? `• BIN / VAT: ${restaurantBin}` : ''}
            </p>
            <div className="mt-2 flex flex-col items-center justify-center gap-1">
              <span className="px-3 py-0.5 bg-slate-900 text-white rounded text-[11px] font-black tracking-widest uppercase">
                *** DAILY MASTER DAY-END Z-REPORT ***
              </span>
              <span className="text-[10px] text-slate-600 font-sans font-bold">
                Consolidated Day-End Z-Report & Vault Settlement
              </span>
            </div>
          </div>

          {/* 2. DAY START & DAY END SUMMARY */}
          <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg space-y-2 text-[11px]">
            <div className="font-bold uppercase tracking-wider text-blue-950 flex justify-between items-center border-b border-blue-200/80 pb-1">
              <span>DAY START & CLOSE AUDIT</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                day.isClosed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-slate-950'
              }`}>
                {day.isClosed ? 'DAY CLOSED' : 'DAY ACTIVE / OPEN'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800">
              {/* Day Start Info */}
              <div className="bg-white/80 p-2 rounded border border-blue-100 space-y-1">
                <div className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>1. DAY START:</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Started By:</span>
                  <span className="font-bold text-slate-900">{openedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Start Time:</span>
                  <span className="font-bold text-slate-900">{openedAt}</span>
                </div>
                <div className="flex justify-between pt-0.5 border-t border-slate-100 text-emerald-900">
                  <span className="font-bold">Opening Float:</span>
                  <span className="font-black font-mono">৳{openingCash.toLocaleString()}</span>
                </div>
              </div>

              {/* Day End Info */}
              <div className="bg-white/80 p-2 rounded border border-blue-100 space-y-1">
                <div className="text-[10px] font-bold text-rose-800 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-rose-600" />
                  <span>2. DAY END:</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Closed By:</span>
                  <span className="font-bold text-slate-900">{closedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">End Time:</span>
                  <span className="font-bold text-slate-900">{closedAt}</span>
                </div>
                <div className="flex justify-between pt-0.5 border-t border-slate-100 text-rose-900">
                  <span className="font-bold">Closing Cash:</span>
                  <span className="font-black font-mono">৳{closingCash.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between text-[11px] pt-1 text-slate-700">
              <span>Business Date: <strong className="text-slate-900">{day.date}</strong></span>
              <span>Consolidated Shifts: <strong className="text-blue-900">{daySessions.length} Shifts Logged</strong></span>
            </div>
          </div>

          {/* 3. SHIFT 1, SHIFT 2 ... SHIFT SUMMARY */}
          <div className="py-2 border-b border-dashed border-slate-400 space-y-2 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-0.5 flex justify-between items-center">
              <span>3. SHIFT-WISE BREAKDOWN</span>
              <span className="text-[10px] text-blue-700 font-normal">{daySessions.length} Shifts Operated</span>
            </div>

            {daySessions.length > 0 ? (
              <div className="space-y-2">
                {daySessions.map((s, idx) => {
                  const shiftLabel = s.shiftType || `Shift ${idx + 1}`;
                  const isShiftMatch = (s.cashDifference || 0) === 0;
                  const isShiftShort = (s.cashDifference || 0) < 0;
                  const shiftDigital = (s.cardSales || 0) + (s.bkashSales || 0) + (s.nagadSales || 0);

                  return (
                    <div 
                      key={s.id || idx} 
                      className="bg-white p-2.5 rounded-lg border border-slate-300 shadow-2xs space-y-1.5"
                    >
                      {/* Shift Header */}
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[11px]">
                          <span className="px-2 py-0.5 bg-[#004b9b] text-white rounded text-[10px] font-black">
                            {shiftLabel.toUpperCase()}
                          </span>
                          <span>Operator: {s.openedBy}</span>
                          {s.closedBy && s.closedBy !== s.openedBy && (
                            <span className="text-slate-500 font-normal text-[10px]">
                              (Closed by {s.closedBy})
                            </span>
                          )}
                        </div>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                          s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                        }`}>
                          {s.status}
                        </span>
                      </div>

                      {/* Shift Time & Orders */}
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Timing: <strong>{s.startTime} - {s.endTime || 'In Progress'}</strong></span>
                        <span>Orders Settled: <strong>{s.orderCount} Invoices</strong></span>
                      </div>

                      {/* Cash Breakdown Grid for this shift */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-50 p-1.5 rounded text-[10px]">
                        <div>
                          <span className="text-slate-500 block">Opening Float:</span>
                          <span className="font-bold font-mono">৳{(s.openingCash || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Cash Sales:</span>
                          <span className="font-bold font-mono text-emerald-700">৳{(s.cashSales || 0).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Digital / Card:</span>
                          <span className="font-bold font-mono text-blue-700">৳{shiftDigital.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Total Shift Sales:</span>
                          <span className="font-black font-mono text-slate-900">৳{(s.totalSales || 0).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Shift Drawer & Variance */}
                      <div className="flex justify-between items-center text-[10px] pt-0.5 border-t border-dotted border-slate-200">
                        <span className="text-slate-600">
                          Drawer Closing: <strong className="font-mono">৳{(s.actualClosingCash ?? s.expectedCash).toLocaleString()}</strong>
                          {s.cashDropToVault ? ` • Vault Drop: ৳${s.cashDropToVault.toLocaleString()}` : ''}
                        </span>
                        <span className="font-bold font-mono">
                          Variance: {isShiftMatch ? (
                            <span className="text-emerald-700">৳0 (Match)</span>
                          ) : isShiftShort ? (
                            <span className="text-rose-700">-৳{Math.abs(s.cashDifference || 0).toLocaleString()} (Shortage)</span>
                          ) : (
                            <span className="text-amber-700">+৳{(s.cashDifference || 0).toLocaleString()} (Surplus)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic p-2 bg-slate-100 rounded">
                No shift session records found for this date.
              </div>
            )}
          </div>

          {/* 4. CONSOLIDATED SALES & PAYMENT BREAKDOWN */}
          <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-0.5 flex justify-between">
              <span>4. Consolidated Revenue Breakdown</span>
              <span>{consolidatedSales.orders} Total Invoices</span>
            </div>
            <div className="flex justify-between">
              <span>Cash Sales:</span>
              <span className="font-bold text-emerald-800">৳{consolidatedSales.cash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Card / Digital POS:</span>
              <span className="font-bold">৳{consolidatedSales.card.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>bKash Payment:</span>
              <span className="font-bold">৳{consolidatedSales.bkash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Nagad Payment:</span>
              <span className="font-bold">৳{consolidatedSales.nagad.toLocaleString()}</span>
            </div>
            {consolidatedSales.due > 0 && (
              <div className="flex justify-between text-rose-700">
                <span>Customer Due Given:</span>
                <span className="font-bold">৳{consolidatedSales.due.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-slate-300 font-black text-sm text-slate-900">
              <span>GROSS DAILY REVENUE:</span>
              <span>৳{consolidatedSales.total.toLocaleString()}</span>
            </div>
          </div>

          {/* 5. PETTY EXPENSES & DEDUCTIONS */}
          <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5 text-xs">
            <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-0.5 flex justify-between">
              <span>5. Daily Expenses Deducted</span>
              <span>{dayExpensesList.length} Items</span>
            </div>

            {dayExpensesList.length > 0 ? (
              <div className="space-y-1 my-1">
                {dayExpensesList.map((exp, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] bg-rose-50/70 p-1.5 rounded border border-rose-100">
                    <div>
                      <div className="font-bold text-slate-800">{exp.title || exp.category || 'Expense'}</div>
                      <div className="text-[10px] text-slate-500">{exp.notes || exp.paymentMethod || 'Petty Cash'}</div>
                    </div>
                    <div className="font-mono font-bold text-rose-700">
                      -৳{(exp.amount || 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic">No petty expenses recorded for this date.</div>
            )}

            <div className="flex justify-between pt-1 border-t border-slate-300 font-bold text-xs text-rose-700">
              <span>Total Daily Petty Expenses:</span>
              <span>-৳{day.totalExpenses.toLocaleString()}</span>
            </div>
          </div>

          {/* 6. VAULT DEPOSIT & NET CASH SETTLEMENT */}
          <div className="py-2.5 border-b-2 border-dashed border-slate-800 space-y-1.5 text-xs bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-300">
            <div className="font-bold text-[11px] uppercase tracking-wider text-emerald-950 flex justify-between items-center">
              <span>6. Vault Deposit & Cash Settlement</span>
              <Wallet className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Total Shift Cash In:</span>
              <span className="font-bold font-mono">৳{consolidatedSales.cash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-rose-700">
              <span>Less Daily Expenses:</span>
              <span className="font-bold font-mono">-৳{day.totalExpenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-emerald-300 font-black text-sm text-emerald-950">
              <span>NET CASH TO VAULT:</span>
              <span className="font-mono text-base">৳{Math.max(0, consolidatedSales.cash - day.totalExpenses).toLocaleString()}</span>
            </div>
          </div>

          {/* 7. ROLE-WISE SUMMARY */}
          {roleBreakdown.length > 0 && (
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-xs">
              <div className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-0.5">
                7. Role-wise Collection
              </div>
              <div className="space-y-1">
                {roleBreakdown.map((r, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] bg-slate-100/70 p-1.5 rounded">
                    <span className="font-bold text-slate-800">
                      {r.role} <span className="text-slate-500 font-normal">({r.orderCount} orders)</span>
                    </span>
                    <span className="font-mono font-bold">
                      ৳{(r.totalCollected || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. SIGNATURES */}
          <div className="pt-8 pb-4 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-800 font-sans">
            <div>
              <div className="border-t border-slate-400 pt-1 font-bold">
                Shift 1 Cashier
              </div>
              <div className="text-[9px] text-slate-500">{openedBy}</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1 font-bold">
                Shift 2 / Closing Cashier
              </div>
              <div className="text-[9px] text-slate-500">{closedBy}</div>
            </div>
            <div>
              <div className="border-t border-slate-400 pt-1 font-bold">
                Branch Manager / Auditor
              </div>
              <div className="text-[9px] text-slate-500">Verified & Approved</div>
            </div>
          </div>

          <div className="text-center pt-2 text-[9px] text-slate-400 uppercase tracking-widest font-sans">
            *** END OF DAILY MASTER Z-REPORT ***
          </div>
        </div>

        {/* Modal Bottom Buttons (Hidden on print) */}
        <div className="pt-2 flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => {
              const confirmDelete = window.confirm(
                `⚠️ Are you sure you want to delete the Consolidated Master Day-End report for ${day.date}?`
              );
              if (confirmDelete) {
                deleteDayEndRecord(day.date);
                setSelectedDayEndPreview(null);
              }
            }}
            className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            title="Delete Master Day-End Report"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedDayEndPreview(null)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 text-xs transition cursor-pointer"
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
            id="print-master-zreport-btn"
            disabled={isPrinting}
            onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Direct print to POS Thermal Receipt Printer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>{isPrinting ? 'Printing...' : 'Print Master Slip'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

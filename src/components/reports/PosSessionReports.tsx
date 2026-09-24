import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { ReportFilters, DatePreset, exportCsvHelper } from './ReportFilters';
import { 
  Lock, 
  Coins, 
  Receipt, 
  Printer, 
  Trash2, 
  User, 
  Eye, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Scale, 
  CreditCard, 
  Smartphone, 
  DollarSign,
  TrendingUp,
  Power,
  Play,
  FileSpreadsheet,
  Search
} from 'lucide-react';
import { PosSessionRecord, DayEndRecord } from '../../types';

export const PosSessionReports: React.FC = () => {
  const { 
    data, 
    activeSessionStats, 
    setSelectedZReportSession, 
    setSelectedDayEndPreview,
    setIsStartSessionModalOpen, 
    endSession, 
    deleteSessionRecord,
    deleteDayEndRecord,
    performDailyDayEndClose,
    currentUser,
    openTables
  } = useRestaurant();

  const [sessionViewMode, setSessionViewMode] = useState<'shifts' | 'dayend'>('shifts');
  const [dayEndSuccessMsg, setDayEndSuccessMsg] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cashierFilter, setCashierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MATCH' | 'SHORTAGE' | 'SURPLUS'>('ALL');

  // Combine closed sessions with active session (if any)
  const allSessions: PosSessionRecord[] = useMemo(() => {
    const list = [...(data.posSessions || [])];

    // If active session exists, synthesize live record
    if (data.session?.isActive) {
      const activeRecord: PosSessionRecord = {
        id: data.session.id || 'SES-ACTIVE-NOW',
        date: data.session.startDate || new Date().toISOString().split('T')[0],
        openedBy: data.session.openedBy || 'Active Cashier',
        startTime: data.session.startTime || 'Now',
        startTimestamp: data.session.startTimestamp || Date.now(),
        openingCash: data.session.openingCash || 0,
        cashSales: activeSessionStats.cashSales,
        cardSales: activeSessionStats.cardSales,
        bkashSales: activeSessionStats.bkashSales,
        nagadSales: activeSessionStats.nagadSales,
        dueSales: activeSessionStats.dueSales,
        totalSales: activeSessionStats.totalSales,
        orderCount: activeSessionStats.orderCount,
        expectedCash: activeSessionStats.expectedCash,
        actualClosingCash: undefined,
        cashDifference: 0,
        status: 'OPEN',
        notes: data.session.notes || 'Shift currently in progress',
        saleIds: activeSessionStats.saleIds
      };
      list.unshift(activeRecord);
    }

    return list;
  }, [data.posSessions, data.session, activeSessionStats]);

  // Unique cashier list
  const cashierOptions = useMemo(() => {
    const set = new Set<string>();
    allSessions.forEach(s => {
      if (s.openedBy) set.add(s.openedBy);
      if (s.closedBy) set.add(s.closedBy);
    });
    return Array.from(set);
  }, [allSessions]);

  // Filtered session records
  const filteredSessions = useMemo(() => {
    return allSessions.filter(s => {
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      if (cashierFilter !== 'ALL') {
        const matchesCashier = (s.openedBy && s.openedBy.includes(cashierFilter)) || 
                               (s.closedBy && s.closedBy.includes(cashierFilter));
        if (!matchesCashier) return false;
      }
      if (statusFilter === 'MATCH' && (s.cashDifference || 0) !== 0) return false;
      if (statusFilter === 'SHORTAGE' && (s.cashDifference || 0) >= 0) return false;
      if (statusFilter === 'SURPLUS' && (s.cashDifference || 0) <= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mId = s.id.toLowerCase().includes(q);
        const mOpen = (s.openedBy || '').toLowerCase().includes(q);
        const mClose = (s.closedBy || '').toLowerCase().includes(q);
        const mNote = (s.notes || '').toLowerCase().includes(q);
        if (!mId && !mOpen && !mClose && !mNote) return false;
      }

      return true;
    });
  }, [allSessions, startDate, endDate, cashierFilter, statusFilter, searchQuery]);

  // Aggregate Metrics
  const totalShiftRevenue = filteredSessions.reduce((sum, s) => sum + (s.totalSales || 0), 0);
  const totalCashCollected = filteredSessions.reduce((sum, s) => sum + (s.cashSales || 0), 0);
  const totalOrdersSettled = filteredSessions.reduce((sum, s) => sum + (s.orderCount || 0), 0);
  const totalVariance = filteredSessions
    .filter(s => s.status === 'CLOSED')
    .reduce((sum, s) => sum + (s.cashDifference || 0), 0);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Session ID',
      'Date',
      'Start Time',
      'End Time',
      'Opened By',
      'Closed By',
      'Status',
      'Opening Cash Float (৳)',
      'Cash Sales (৳)',
      'Card Sales (৳)',
      'bKash / Nagad (৳)',
      'Customer Due (৳)',
      'Gross Sales Total (৳)',
      'Orders Count',
      'Expected Cash (৳)',
      'Actual Cash (৳)',
      'Cash Difference (৳)',
      'Shift Notes'
    ];

    const rows = filteredSessions.map(s => [
      s.id,
      s.date,
      s.startTime,
      s.endTime || 'In Progress',
      s.openedBy,
      s.closedBy || 'N/A',
      s.status,
      s.openingCash,
      s.cashSales,
      s.cardSales,
      (s.bkashSales || 0) + (s.nagadSales || 0),
      s.dueSales || 0,
      s.totalSales,
      s.orderCount,
      s.expectedCash,
      s.actualClosingCash ?? s.expectedCash,
      s.cashDifference || 0,
      s.notes || ''
    ]);

    exportCsvHelper('pos_shift_sessions_report', headers, rows);
  };

  const consolidatedDays = useMemo(() => {
    const datesSet = new Set<string>();
    (data.dayEndRecords || []).forEach(r => datesSet.add(r.date));
    (data.posSessions || []).forEach(s => datesSet.add(s.date));
    (data.sales || []).forEach(s => datesSet.add(s.date));
    if (data.session?.isActive) {
      datesSet.add(new Date().toISOString().split('T')[0]);
    }

    const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
    
    return sortedDates.map(date => {
      const dayRecord = (data.dayEndRecords || []).find(r => r.date === date);
      const daySessions = allSessions.filter(s => s.date === date);
      const dayExpenses = (data.expenses || []).filter(e => e.date === date).reduce((sum, e) => sum + (e.amount || 0), 0);
      const daySales = (data.sales || []).filter(s => s.date === date && !s.isVoid && s.status !== 'VOIDED' && s.status !== 'CANCELLED');

      const sessionSales = daySessions.reduce((sum, s) => sum + (s.totalSales || 0), 0);
      const sessionCash = daySessions.reduce((sum, s) => sum + (s.cashSales || 0), 0);
      const sessionCard = daySessions.reduce((sum, s) => sum + (s.cardSales || 0), 0);
      const sessionBkash = daySessions.reduce((sum, s) => sum + (s.bkashSales || 0), 0);
      const sessionNagad = daySessions.reduce((sum, s) => sum + (s.nagadSales || 0), 0);
      const sessionDue = daySessions.reduce((sum, s) => sum + (s.dueSales || 0), 0);
      const sessionOrders = daySessions.reduce((sum, s) => sum + (s.orderCount || 0), 0);

      const totalSales = daySessions.length > 0 ? sessionSales : (dayRecord ? dayRecord.totalDaySales : daySales.reduce((sum, s) => sum + (s.total || 0), 0));
      const totalCash = daySessions.length > 0 ? sessionCash : (dayRecord ? dayRecord.totalCash : daySales.reduce((sum, s) => sum + (s.cash || 0), 0));
      const totalCard = daySessions.length > 0 ? sessionCard : (dayRecord ? dayRecord.totalCard : daySales.reduce((sum, s) => sum + (s.card || 0), 0));
      const totalBkash = daySessions.length > 0 ? sessionBkash : (dayRecord ? dayRecord.totalBkash : daySales.reduce((sum, s) => sum + (s.bkash || 0), 0));
      const totalNagad = daySessions.length > 0 ? sessionNagad : (dayRecord ? dayRecord.totalNagad : daySales.reduce((sum, s) => sum + (s.nagad || 0), 0));
      const totalDue = daySessions.length > 0 ? sessionDue : (dayRecord ? dayRecord.totalDue : daySales.reduce((sum, s) => sum + (s.dueGiven || 0), 0));
      const orderCount = daySessions.length > 0 ? (sessionOrders || daySales.length) : (dayRecord ? dayRecord.totalDayOrders : daySales.length);
      const netCash = Math.max(0, totalCash - dayExpenses);

      // Sort day sessions chronologically (Shift 1, Shift 2, etc.)
      const sortedDaySessions = [...daySessions].sort((a, b) => {
        if (a.startTimestamp && b.startTimestamp) return a.startTimestamp - b.startTimestamp;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
      const firstSession = sortedDaySessions[0];
      const lastSession = sortedDaySessions[sortedDaySessions.length - 1];

      const openedBy = dayRecord?.openedBy || firstSession?.openedBy || (data.businessDay?.date === date && data.businessDay.openedBy ? data.businessDay.openedBy : 'Cashier');
      const openedAt = dayRecord?.openedAt || firstSession?.startTime || (data.businessDay?.date === date && data.businessDay.openedAt ? data.businessDay.openedAt : null);
      const openingCash = dayRecord?.openingCash ?? firstSession?.openingCash ?? (data.session?.isActive && data.session.openingCash ? data.session.openingCash : 0);
      const closingCash = dayRecord?.closingCash ?? (lastSession?.actualClosingCash ?? lastSession?.expectedCash ?? totalCash);

      return {
        date,
        dayRecord,
        shiftCount: daySessions.length || (dayRecord ? dayRecord.shiftCount : 0),
        totalSales,
        totalCash,
        totalCard,
        totalBkash,
        totalNagad,
        totalDue,
        totalExpenses: dayExpenses,
        netCashToVault: dayRecord ? dayRecord.netCashToVault : netCash,
        openedBy,
        openedAt,
        openingCash,
        closingCash,
        isClosed: !!dayRecord,
        closedBy: dayRecord?.closedBy || (lastSession?.closedBy || 'Pending Day-End'),
        closedAt: dayRecord?.closedAt || null
      };
    });
  }, [allSessions, data.posSessions, data.dayEndRecords, data.sales, data.expenses, data.businessDay, data.session]);

  const handlePerformDayEnd = (date: string) => {
    if (openTables.length > 0) {
      const confirmProceed = window.confirm(
        `⚠️ Warning: There are still ${openTables.length} tables with active running orders! Are you sure you want to close Day-End for all shifts?`
      );
      if (!confirmProceed) return;
    }
    performDailyDayEndClose(date);
    setDayEndSuccessMsg(`✅ Consolidated Master Day-End Z-Report for ${date} successfully completed and locked!`);
    setTimeout(() => setDayEndSuccessMsg(null), 5000);
  };

  return (
    <div className="space-y-5">
      {/* Tab Switcher: Shifts vs Day-End */}
      <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSessionViewMode('shifts')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              sessionViewMode === 'shifts'
                ? 'bg-[#004b9b] text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Shift Sessions (Z-Reports)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${sessionViewMode === 'shifts' ? 'bg-black text-blue-300' : 'bg-slate-200 text-slate-700'}`}>
              {allSessions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSessionViewMode('dayend')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
              sessionViewMode === 'dayend'
                ? 'bg-black text-white shadow-md ring-2 ring-emerald-500'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Daily Day-End Master Reports</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${sessionViewMode === 'dayend' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {consolidatedDays.length}
            </span>
          </button>
        </div>

        {dayEndSuccessMsg && (
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-xl animate-in fade-in">
            {dayEndSuccessMsg}
          </div>
        )}
      </div>

      {sessionViewMode === 'dayend' ? (
        /* Consolidated Daily Day-End Master Reports View */
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white border-2 border-emerald-500/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider">
                  MASTER DAY-END AUDIT
                </span>
                <span className="text-xs text-slate-300 font-mono">Consolidated Multi-Shift Closing</span>
              </div>
              <h3 className="text-lg font-black text-white mt-1">
                Consolidated Z-Report & Vault Deposit for all daily shifts
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Combine morning, evening, and night shift sales, deduct daily expenses, and calculate net cash deposited to vault.
              </p>
            </div>

            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'CASHIER') && (
              <button
                type="button"
                onClick={() => handlePerformDayEnd(new Date().toISOString().split('T')[0])}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span>Complete Day-End Close</span>
              </button>
            )}
          </div>

          {/* Day End Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase text-[11px] font-black tracking-wider border-b border-slate-800">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Total Shifts</th>
                    <th className="py-3 px-3 text-right">Day Sales (৳)</th>
                    <th className="py-3 px-3 text-right">Cash In (৳)</th>
                    <th className="py-3 px-3 text-right">Digital / POS (৳)</th>
                    <th className="py-3 px-3 text-right">Petty Expenses (৳)</th>
                    <th className="py-3 px-3 text-right">Net to Vault (৳)</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consolidatedDays.map(day => (
                    <tr 
                      key={day.date} 
                      onClick={() => setSelectedDayEndPreview(day)}
                      className="hover:bg-blue-50/70 transition cursor-pointer group"
                      title="Click to view Consolidated Z-Report preview"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {day.date}
                        {day.date === new Date().toISOString().split('T')[0] && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-[#004b9b] text-[10px] font-black">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {day.shiftCount} Shifts Logged
                      </td>
                      <td className="py-3 px-3 text-right font-black font-mono text-slate-900 text-sm">
                        ৳{day.totalSales.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono text-emerald-700">
                        ৳{day.totalCash.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono text-blue-700">
                        ৳{(day.totalCard + day.totalBkash + day.totalNagad).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono text-rose-600">
                        -৳{day.totalExpenses.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-black font-mono text-emerald-800 text-sm">
                        ৳{day.netCashToVault.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {day.isClosed ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            CLOSED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {!day.isClosed && (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'CASHIER') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePerformDayEnd(day.date);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Perform Day-End Close"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Close Day</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedDayEndPreview(day)}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 group-hover:bg-[#004b9b] group-hover:text-white text-slate-800 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                            title="Preview & Print Consolidated Master Z-Report"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#004b9b] group-hover:text-white transition-colors" />
                            <span>Preview / Print</span>
                          </button>
                          <button
                            type="button"
                            title="Delete Master Day-End Report"
                            onClick={(e) => {
                              e.stopPropagation();
                              const confirmDelete = window.confirm(
                                `⚠️ Are you sure you want to delete the Consolidated Master Day-End report for ${day.date}?`
                              );
                              if (confirmDelete) {
                                deleteDayEndRecord(day.date);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer shadow-2xs flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Regular Shifts View */
        <>
      {/* Active Shift Real-Time Dashboard Card */}
      {data.session?.isActive ? (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-2 border-emerald-500/80 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold shrink-0">
                <Coins className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                    LIVE POS SHIFT ACTIVE
                  </span>
                  <span className="font-mono text-xs text-slate-300">ID: {data.session.id || 'SES-ACTIVE'}</span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  Shift Operator: {data.session.openedBy || 'Cashier'} &bull; Started at {data.session.startTime || 'Today'}
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  Opening Float: ৳{(data.session.openingCash || 0).toLocaleString()} &bull; Orders Logged: {activeSessionStats.orderCount}
                </p>
              </div>
            </div>

            {/* Quick KPIs & Close Shift Button */}
            <div className="flex items-center gap-4 flex-wrap w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 border-slate-800 pt-3 lg:pt-0">
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Live Sales</span>
                  <span className="font-black text-amber-400 font-mono text-base">৳{activeSessionStats.totalSales.toLocaleString()}</span>
                </div>
                <div className="text-right border-l border-slate-800 pl-4">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Expected Drawer Cash</span>
                  <span className="font-black text-emerald-400 font-mono text-base">৳{activeSessionStats.expectedCash.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="button"
                id="btn-report-close-session"
                onClick={endSession}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Power className="w-4 h-4" />
                <span>Close Shift & Z-Report</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-amber-900">No POS Shift Currently Active</h4>
              <p className="text-xs text-amber-800/80">Table ordering is paused until the next cashier shift is opened.</p>
            </div>
          </div>
          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'CASHIER') && (
            <button
              type="button"
              onClick={() => setIsStartSessionModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Open New Shift</span>
            </button>
          )}
        </div>
      )}

      {/* Report Filters */}
      <ReportFilters
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search session ID, cashier name, notes..."
        totalRecords={filteredSessions.length}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
      />

      {/* Extra Filters (Cashier, Variance Status) */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-600">Cashier Filter:</span>
          <select
            value={cashierFilter}
            onChange={e => setCashierFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Cashiers / Operators</option>
            {cashierOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-600">Variance Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="MATCH">Exact Match (৳0.00)</option>
            <option value="SHORTAGE">Shortage Detected (&lt; ৳0)</option>
            <option value="SURPLUS">Surplus Cash (&gt; ৳0)</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Total Shift Sales</span>
            <Receipt className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 mt-1">
            ৳{totalShiftRevenue.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Across {filteredSessions.length} shifts
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Total Cash Drawer Sales</span>
            <Coins className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-700 mt-1">
            ৳{totalCashCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Physical cash float & receipts
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Orders Settled</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 mt-1">
            {totalOrdersSettled}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Invoiced dining transactions
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Net Drawer Variance</span>
            <Scale className={`w-4 h-4 ${totalVariance === 0 ? 'text-emerald-600' : totalVariance < 0 ? 'text-rose-600' : 'text-amber-600'}`} />
          </div>
          <div className={`text-lg sm:text-2xl font-black mt-1 ${
            totalVariance === 0 ? 'text-emerald-700' : totalVariance < 0 ? 'text-rose-700' : 'text-amber-700'
          }`}>
            {totalVariance > 0 ? `+৳${totalVariance.toLocaleString()}` : totalVariance < 0 ? `-৳${Math.abs(totalVariance).toLocaleString()}` : '৳0.00'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {totalVariance === 0 ? 'Fully Reconciled' : totalVariance < 0 ? 'Net Drawer Shortage' : 'Net Cash Surplus'}
          </div>
        </div>
      </div>

      {/* POS Shifts Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600" />
              <span>POS Shift Session Ledger & Z-Report Register</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical shift open/close audit log, cash drawer reconciliations and variance tracking
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] sm:text-xs">
                <th className="py-2.5 px-2.5">Session & Time</th>
                <th className="py-2.5 px-2.5">Cashier</th>
                <th className="py-2.5 px-2 text-right">Float (৳)</th>
                <th className="py-2.5 px-2.5 text-right">Sales & Breakdown</th>
                <th className="py-2.5 px-2.5 text-right">Drawer Cash</th>
                <th className="py-2.5 px-2 text-right">Variance</th>
                <th className="py-2.5 px-2 text-center">Status</th>
                <th className="py-2.5 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No POS session records found matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSessions.map(session => {
                  const isClosed = session.status === 'CLOSED';
                  const isMatch = (session.cashDifference || 0) === 0;
                  const isShort = (session.cashDifference || 0) < 0;

                  return (
                    <tr 
                      key={session.id} 
                      onClick={() => setSelectedZReportSession(session)}
                      className="hover:bg-blue-50/60 transition border-b border-slate-100 last:border-0 cursor-pointer group"
                      title="Click to view Shift Z-Report preview"
                    >
                      {/* Session & Time */}
                      <td className="py-2.5 px-2.5">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {session.id}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {session.date} • {session.startTime} - {session.endTime || 'Active'}
                        </div>
                      </td>

                      {/* Cashier */}
                      <td className="py-2.5 px-2.5">
                        <div className="font-bold text-slate-800 text-xs">{session.openedBy}</div>
                        {session.closedBy && session.closedBy !== session.openedBy && (
                          <div className="text-[10px] text-slate-500">Closed: {session.closedBy}</div>
                        )}
                      </td>

                      {/* Opening Float */}
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-700 text-xs">
                        ৳{session.openingCash.toLocaleString()}
                      </td>

                      {/* Sales & Breakdown */}
                      <td className="py-2.5 px-2.5 text-right">
                        <div className="font-mono font-black text-amber-700 text-xs">
                          ৳{session.totalSales.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Cash: ৳{(session.cashSales || 0).toLocaleString()} • Dig: ৳{((session.cardSales || 0) + (session.bkashSales || 0) + (session.nagadSales || 0)).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {session.orderCount} orders
                        </div>
                      </td>

                      {/* Drawer Cash */}
                      <td className="py-2.5 px-2.5 text-right">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          Act: {isClosed ? `৳${(session.actualClosingCash ?? session.expectedCash).toLocaleString()}` : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Exp: ৳{session.expectedCash.toLocaleString()}
                        </div>
                      </td>

                      {/* Variance */}
                      <td className="py-2.5 px-2 text-right font-mono font-black text-xs">
                        {!isClosed ? (
                          <span className="text-slate-400">—</span>
                        ) : isMatch ? (
                          <span className="text-emerald-700 font-bold">৳0.00</span>
                        ) : isShort ? (
                          <span className="text-rose-700">-৳{Math.abs(session.cashDifference || 0).toLocaleString()}</span>
                        ) : (
                          <span className="text-amber-700">+৳{(session.cashDifference || 0).toLocaleString()}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                          session.status === 'OPEN'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isMatch
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : isShort
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {session.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-2 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="View / Print Z-Report Preview"
                            onClick={() => setSelectedZReportSession(session)}
                            className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 transition cursor-pointer shadow-2xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {isClosed && (
                            <button
                              type="button"
                              title="Delete Session Record"
                              onClick={() => {
                                deleteSessionRecord(session.id);
                              }}
                              className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSessions.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300 text-xs">
                  <td colSpan={2} className="py-2.5 px-2.5">
                    Grand Total ({filteredSessions.length} Shifts)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">
                    ৳{filteredSessions.reduce((s, r) => s + r.openingCash, 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2.5 text-right">
                    <div className="font-mono text-amber-800">
                      ৳{totalShiftRevenue.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono font-normal">
                      Cash: ৳{totalCashCollected.toLocaleString()} • Dig: ৳{filteredSessions.reduce((s, r) => s + (r.cardSales + r.bkashSales + r.nagadSales), 0).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-[11px]">
                    Act: ৳{filteredSessions.reduce((s, r) => s + (r.actualClosingCash ?? r.expectedCash), 0).toLocaleString()}
                  </td>
                  <td className={`py-2.5 px-2 text-right font-mono ${
                    totalVariance === 0 ? 'text-emerald-800' : totalVariance < 0 ? 'text-rose-800' : 'text-amber-800'
                  }`}>
                    {totalVariance > 0 ? `+৳${totalVariance.toLocaleString()}` : totalVariance < 0 ? `-৳${Math.abs(totalVariance).toLocaleString()}` : '৳0.00'}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

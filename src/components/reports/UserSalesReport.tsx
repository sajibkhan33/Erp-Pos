import React, { useState, useMemo } from 'react';
import { useRestaurant, isSaleActive } from '../../context/RestaurantContext';
import { ReportFilters, DatePreset, exportCsvHelper } from './ReportFilters';
import { 
  Users, 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Award, 
  CreditCard, 
  Smartphone, 
  Coins, 
  UserCheck, 
  Calendar, 
  ChevronRight, 
  Percent, 
  ArrowUpDown,
  Printer,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { SaleRecord } from '../../types';

export const UserSalesReport: React.FC = () => {
  const { data, openPrintBill, currentUser } = useRestaurant();

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'WAITER' | 'CASHIER'>('ALL');
  const [selectedUser, setSelectedUser] = useState<string>('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'revenue' | 'orders' | 'avgTicket'>('revenue');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeDrilldownUser, setActiveDrilldownUser] = useState<string | null>(null);

  // Helper to extract waiter name from sale
  const getSaleWaiter = (sale: SaleRecord): string => {
    if ((sale as any).waiter) return (sale as any).waiter;
    // Try regex from details: "W: Rahim" or "• Rahim •"
    const matchW = sale.details.match(/W:\s*([^,\]\)]+)/i);
    if (matchW && matchW[1]) return matchW[1].trim();

    const parts = sale.details.split('•').map(p => p.trim());
    if (parts.length >= 2) {
      const candidate = parts[1];
      if (candidate && !candidate.toLowerCase().includes('customer') && !candidate.toLowerCase().includes('table')) {
        return candidate;
      }
    }
    return 'Staff / Unassigned';
  };

  // Helper to extract cashier name from sale
  const getSaleCashier = (sale: SaleRecord): string => {
    if (sale.cashierName) return sale.cashierName;
    if ((sale as any).cashier) return (sale as any).cashier;
    return 'Main Cashier';
  };

  // Filter sales based on date range, shift session, and search (excluding voided)
  const filteredSales = useMemo(() => {
    return (data.sales || []).filter(sale => {
      if (!isSaleActive(sale)) return false;
      // Shift session filter
      if (selectedSessionId !== 'ALL') {
        if (selectedSessionId === 'ACTIVE') {
          if (data.session?.id && sale.sessionId) {
            if (sale.sessionId !== data.session.id) return false;
          } else if (data.session?.startTimestamp) {
            const saleTs = sale.createdAt || (typeof sale.id === 'number' && sale.id > 1000000000000 ? sale.id : 0);
            if (saleTs > 0 && saleTs < data.session.startTimestamp) return false;
          }
        } else {
          // Match against completed session
          const targetSession = (data.posSessions || []).find(s => s.id === selectedSessionId);
          if (sale.sessionId) {
            if (sale.sessionId !== selectedSessionId) return false;
          } else if (targetSession) {
            const saleTs = sale.createdAt || (typeof sale.id === 'number' && sale.id > 1000000000000 ? sale.id : 0);
            if (saleTs > 0) {
              if (targetSession.startTimestamp && saleTs < targetSession.startTimestamp) return false;
              if (targetSession.endTimestamp && saleTs > targetSession.endTimestamp) return false;
            }
          }
        }
      }

      if (startDate && sale.date < startDate) return false;
      if (endDate && sale.date > endDate) return false;

      const waiter = getSaleWaiter(sale);
      const cashier = getSaleCashier(sale);

      if (selectedUser !== 'ALL') {
        if (waiter !== selectedUser && cashier !== selectedUser) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInv = sale.invoiceNo.toLowerCase().includes(q);
        const matchDetails = sale.details.toLowerCase().includes(q);
        const matchW = waiter.toLowerCase().includes(q);
        const matchC = cashier.toLowerCase().includes(q);
        if (!matchInv && !matchDetails && !matchW && !matchC) return false;
      }

      return true;
    });
  }, [data.sales, data.session, data.posSessions, selectedSessionId, startDate, endDate, selectedUser, searchQuery]);

  // Aggregate stats by User (Waiter & Cashier)
  const userStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      role: 'WAITER' | 'CASHIER' | 'STAFF';
      orderCount: number;
      grossSales: number;
      netSales: number;
      discountAmount: number;
      cashCollected: number;
      cardCollected: number;
      mfsCollected: number;
      dueGiven: number;
      sales: SaleRecord[];
    }> = {};

    // Initialize all waiters from master list
    (data.waiters || []).forEach(w => {
      map[w] = {
        name: w,
        role: 'WAITER',
        orderCount: 0,
        grossSales: 0,
        netSales: 0,
        discountAmount: 0,
        cashCollected: 0,
        cardCollected: 0,
        mfsCollected: 0,
        dueGiven: 0,
        sales: []
      };
    });

    filteredSales.forEach(sale => {
      const waiter = getSaleWaiter(sale);
      if (!map[waiter]) {
        map[waiter] = {
          name: waiter,
          role: 'WAITER',
          orderCount: 0,
          grossSales: 0,
          netSales: 0,
          discountAmount: 0,
          cashCollected: 0,
          cardCollected: 0,
          mfsCollected: 0,
          dueGiven: 0,
          sales: []
        };
      }

      const gross = sale.subtotal || sale.total || 0;
      const net = sale.total || 0;
      const disc = Math.max(0, gross - net);

      map[waiter].orderCount += 1;
      map[waiter].grossSales += gross;
      map[waiter].netSales += net;
      map[waiter].discountAmount += disc;
      map[waiter].cashCollected += (sale.cash || 0);
      map[waiter].cardCollected += (sale.card || 0);
      map[waiter].mfsCollected += ((sale.bkash || 0) + (sale.nagad || 0));
      map[waiter].dueGiven += (sale.dueGiven || 0);
      map[waiter].sales.push(sale);
    });

    let list = Object.values(map);

    if (roleFilter !== 'ALL') {
      list = list.filter(u => u.role === roleFilter);
    }

    // Sort list
    list.sort((a, b) => {
      let valA = a.netSales;
      let valB = b.netSales;
      if (sortField === 'orders') {
        valA = a.orderCount;
        valB = b.orderCount;
      } else if (sortField === 'avgTicket') {
        valA = a.orderCount > 0 ? a.netSales / a.orderCount : 0;
        valB = b.orderCount > 0 ? b.netSales / b.orderCount : 0;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return list;
  }, [filteredSales, data.waiters, roleFilter, sortField, sortOrder]);

  // Overall metrics
  const totalGross = useMemo(() => userStats.reduce((sum, u) => sum + u.grossSales, 0), [userStats]);
  const totalNet = useMemo(() => userStats.reduce((sum, u) => sum + u.netSales, 0), [userStats]);
  const totalOrders = useMemo(() => userStats.reduce((sum, u) => sum + u.orderCount, 0), [userStats]);
  const totalCash = useMemo(() => userStats.reduce((sum, u) => sum + u.cashCollected, 0), [userStats]);
  const totalDigital = useMemo(() => userStats.reduce((sum, u) => sum + u.cardCollected + u.mfsCollected, 0), [userStats]);
  const totalDue = useMemo(() => userStats.reduce((sum, u) => sum + u.dueGiven, 0), [userStats]);
  const topPerformer = userStats.length > 0 && userStats[0].orderCount > 0 ? userStats[0] : null;

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Staff Name',
      'Role',
      'Orders Handled',
      'Gross Sales (BDT)',
      'Discount Given (BDT)',
      'Net Sales (BDT)',
      'Cash (BDT)',
      'Card/MFS (BDT)',
      'Due Given (BDT)',
      'Average Ticket (BDT)',
      'Contribution (%)'
    ];

    const rows = userStats.map(u => {
      const avg = u.orderCount > 0 ? Math.round(u.netSales / u.orderCount) : 0;
      const share = totalNet > 0 ? ((u.netSales / totalNet) * 100).toFixed(1) + '%' : '0%';
      return [
        u.name,
        u.role,
        u.orderCount,
        u.grossSales,
        u.discountAmount,
        u.netSales,
        u.cashCollected,
        u.cardCollected + u.mfsCollected,
        u.dueGiven,
        avg,
        share
      ];
    });

    exportCsvHelper('User_Wise_Sales_Report_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
  };

  const handlePrint = () => {
    window.print();
  };

  // Drilldown user object
  const drilldownData = useMemo(() => {
    if (!activeDrilldownUser) return null;
    return userStats.find(u => u.name === activeDrilldownUser) || null;
  }, [activeDrilldownUser, userStats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-black uppercase tracking-wider">
              POS Report #1
            </span>
            <h2 className="text-xl font-black text-slate-900">
              User & Waiter Wise Sales Report
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Individual sales volume, total bills served, cash vs digital collections, discounts, and performance ranking per staff member.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <ReportFilters
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search waiter, invoice #, customer name..."
        totalRecords={filteredSales.length}
        onExportCsv={handleExportCsv}
        onPrint={handlePrint}
        topRightControl={
          /* 1: Staff Filter (Dedicated Row 2 on the right, directly above 2: Shift) */
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-72">
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Staff:</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-transparent text-slate-800 text-xs font-bold focus:outline-none truncate cursor-pointer"
            >
              <option value="ALL">All Staff Members ({userStats.length})</option>
              {userStats.map(u => (
                <option key={u.name} value={u.name}>
                  {u.name} ({u.orderCount} orders • ৳{u.netSales.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        }
        bottomControl={
          /* 3: Sort Filter */
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-72">
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Sort By:</label>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="w-full bg-transparent text-slate-800 text-xs font-bold focus:outline-none truncate cursor-pointer"
            >
              <option value="revenue">Highest Net Revenue</option>
              <option value="orders">Most Orders Handled</option>
              <option value="avgTicket">Highest Average Ticket</option>
            </select>
          </div>
        }
      >
        {/* 2: Shift / Session Filter (Row 3 on the right, inline with From/To/Search) */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-72">
          <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Shift:</label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full bg-transparent text-slate-800 text-xs font-bold focus:outline-none truncate cursor-pointer"
          >
            <option value="ALL">All Shifts & Sessions</option>
            {data.session?.isActive && (
              <option value="ACTIVE">🟢 Current Active Shift ({data.session.openedBy || 'Active'})</option>
            )}
            {(data.posSessions || []).map(s => (
              <option key={s.id} value={s.id}>
                {s.date} ({s.startTime}-{s.endTime || 'End'}) • {s.openedBy}
              </option>
            ))}
          </select>
        </div>
      </ReportFilters>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Net Sales Revenue</span>
            <DollarSign className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            ৳{totalNet.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            From {totalOrders} completed guest orders
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Avg Order Value (AOV)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            ৳{totalOrders > 0 ? Math.round(totalNet / totalOrders).toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Average ticket size across staff
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Top Performing Waiter</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 truncate">
            {topPerformer ? topPerformer.name : 'N/A'}
          </div>
          <div className="text-[11px] text-amber-700 font-bold mt-0.5 truncate">
            {topPerformer ? `৳${topPerformer.netSales.toLocaleString()} (${topPerformer.orderCount} orders)` : 'No sales recorded'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Cash vs Digital Share</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-1">
            ৳{totalCash.toLocaleString()} <span className="text-xs text-slate-400 font-medium">/ ৳{totalDigital.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Cash: {totalNet > 0 ? Math.round((totalCash / totalNet) * 100) : 0}% • Digital: {totalNet > 0 ? Math.round((totalDigital / totalNet) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Staff Performance Ranking Visual Bar Strip */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            <span>Staff Sales Contribution & Share Matrix</span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {userStats.length} active staff profiles
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {userStats.slice(0, 6).map((u, idx) => {
            const share = totalNet > 0 ? (u.netSales / totalNet) * 100 : 0;
            return (
              <div key={u.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      idx === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="font-extrabold text-slate-800">{u.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 font-bold">
                      {u.orderCount} bills
                    </span>
                  </div>
                  <div className="font-black text-slate-900">
                    ৳{u.netSales.toLocaleString()} <span className="text-slate-400 text-[10px] font-normal">({share.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      idx === 0 ? 'bg-teal-600' : idx === 1 ? 'bg-amber-500' : idx === 2 ? 'bg-blue-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.max(2, share)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Staff Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900 text-base">
              Staff Sales Ledger & Collection Summary
            </h3>
            <p className="text-xs text-slate-500">
              Detailed breakdown of orders handled, gross bill, discounts, and payment collections by staff member.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            {userStats.length} Records
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-2.5 py-2.5">#</th>
                <th className="px-2.5 py-2.5">Staff / Waiter</th>
                <th className="px-2.5 py-2.5 text-center">Orders & Share</th>
                <th className="px-2.5 py-2.5 text-right">Sales (Net / Gross)</th>
                <th className="px-2.5 py-2.5 text-right">Collections (Cash / Dig / Due)</th>
                <th className="px-2.5 py-2.5 text-right">Avg Ticket</th>
                <th className="px-2.5 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userStats.map((u, index) => {
                const avgTicket = u.orderCount > 0 ? Math.round(u.netSales / u.orderCount) : 0;
                const share = totalNet > 0 ? ((u.netSales / totalNet) * 100).toFixed(1) : '0';

                return (
                  <tr key={u.name} className="hover:bg-slate-50/80 transition">
                    <td className="px-2.5 py-2.5 font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-2.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-black text-xs shrink-0 border border-teal-100">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 text-xs sm:text-sm">
                            {u.name}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {u.role === 'WAITER' ? 'Dining Steward' : 'Staff'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 text-center">
                      <div className="font-extrabold text-slate-900 text-xs">
                        {u.orderCount} orders
                      </div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 text-[10px] font-bold">
                        {share}% share
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 text-right">
                      <div className="font-black text-slate-900 text-xs sm:text-sm">
                        ৳{u.netSales.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Gross: ৳{u.grossSales.toLocaleString()} {u.discountAmount > 0 ? `(-৳${u.discountAmount})` : ''}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 text-right">
                      <div className="text-xs font-bold text-emerald-700 font-mono">
                        Cash: ৳{u.cashCollected.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Dig: ৳{(u.cardCollected + u.mfsCollected).toLocaleString()} {u.dueGiven > 0 ? `• Due: ৳${u.dueGiven}` : ''}
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-extrabold text-slate-800 text-xs">
                      ৳{avgTicket.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2.5 text-center">
                      <button
                        onClick={() => setActiveDrilldownUser(u.name)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 mx-auto"
                        title="View Bills Drilldown"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Invoices</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {userStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No sales records found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Total Footer Row */}
            <tfoot className="bg-slate-900 text-white font-extrabold text-xs">
              <tr>
                <td colSpan={2} className="px-2.5 py-3 uppercase tracking-wider text-amber-400">
                  Total Consolidated
                </td>
                <td className="px-2.5 py-3 text-center text-white">
                  {totalOrders} orders
                </td>
                <td className="px-2.5 py-3 text-right">
                  <div className="text-amber-400 text-xs sm:text-sm font-black">
                    ৳{totalNet.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-300 font-normal">
                    Gross: ৳{totalGross.toLocaleString()}
                  </div>
                </td>
                <td className="px-2.5 py-3 text-right font-mono text-[11px]">
                  <div className="text-emerald-300">Cash: ৳{totalCash.toLocaleString()}</div>
                  <div className="text-blue-300">Dig: ৳{totalDigital.toLocaleString()}</div>
                </td>
                <td className="px-2.5 py-3 text-right text-white">
                  ৳{totalOrders > 0 ? Math.round(totalNet / totalOrders).toLocaleString() : '0'}
                </td>
                <td className="px-2.5 py-3 text-center text-amber-400">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Invoice Drilldown Modal */}
      {drilldownData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-black">
                    Staff Invoices
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    {drilldownData.name} — Order Invoices
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total {drilldownData.orderCount} orders • Total Sales: ৳{drilldownData.netSales.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setActiveDrilldownUser(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 py-4 space-y-2.5">
              {drilldownData.sales.map(sale => (
                <div 
                  key={sale.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900">{sale.invoiceNo}</span>
                      <span className="text-[10px] text-slate-400">• {sale.date}</span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
                      {sale.details}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        ৳{sale.total.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Cash: ৳{sale.cash} • Card/MFS: ৳{(sale.card || 0) + (sale.bkash || 0) + (sale.nagad || 0)}
                      </div>
                    </div>
                    {currentUser?.role !== 'WAITER' && (
                      <button
                        onClick={() => openPrintBill(String(sale.id))}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title="Print Invoice"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {drilldownData.sales.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No invoice records found for this staff member in selected date range.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setActiveDrilldownUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

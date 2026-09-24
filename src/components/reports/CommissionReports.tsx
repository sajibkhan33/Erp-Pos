import React, { useState, useMemo } from 'react';
import { useRestaurant, isSaleActive } from '../../context/RestaurantContext';
import { ReportFilters, DatePreset, exportCsvHelper } from './ReportFilters';
import { 
  Percent, 
  Receipt, 
  Printer, 
  Download, 
  Calendar, 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Search,
  CheckCircle2,
  Sliders,
  Sparkles
} from 'lucide-react';

export const CommissionReports: React.FC = () => {
  const { data, setPrintableReceipt, language } = useRestaurant();

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all sales that have an associated commission agent / channel
  const commissionSales = useMemo(() => {
    return (data.sales || []).filter(sale => {
      if (!isSaleActive(sale)) return false;
      // Check date range
      if (startDate && sale.date < startDate) return false;
      if (endDate && sale.date > endDate) return false;

      // Filter by agent
      const agentName = sale.channel || (sale.commissionAgentId ? data.commissionAgents?.find(a => a.id === sale.commissionAgentId)?.name : null);
      if (selectedAgent !== 'ALL') {
        const matches = (agentName || '').toLowerCase().includes(selectedAgent.toLowerCase()) ||
                        (sale.commissionAgentId === selectedAgent);
        if (!matches) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInv = sale.invoiceNo.toLowerCase().includes(q);
        const matchDetails = sale.details.toLowerCase().includes(q);
        const matchAgent = (agentName || '').toLowerCase().includes(q);
        if (!matchInv && !matchDetails && !matchAgent) return false;
      }

      return true;
    });
  }, [data.sales, data.commissionAgents, startDate, endDate, selectedAgent, searchQuery]);

  // Aggregate stats
  const summaryStats = useMemo(() => {
    let grossTotal = 0;
    let totalCommission = 0;
    let netRestaurant = 0;
    let orderCount = 0;

    commissionSales.forEach(sale => {
      const gross = sale.grossAmount || sale.total || 0;
      const comm = sale.commissionAmount || (sale.discountAmount || 0);
      const net = sale.netAmount || (gross - comm);

      grossTotal += gross;
      totalCommission += comm;
      netRestaurant += net;
      orderCount += 1;
    });

    return {
      grossTotal,
      totalCommission,
      netRestaurant,
      orderCount,
      avgCommissionRate: grossTotal > 0 ? ((totalCommission / grossTotal) * 100).toFixed(1) : '0.0'
    };
  }, [commissionSales]);

  // Agent wise summary breakdown
  const agentBreakdown = useMemo(() => {
    const map: Record<string, { name: string; count: number; gross: number; commission: number; net: number; defaultRate: number }> = {};

    // Initialize with known commission agents
    (data.commissionAgents || []).forEach(agent => {
      map[agent.name] = {
        name: agent.name,
        count: 0,
        gross: 0,
        commission: 0,
        net: 0,
        defaultRate: agent.commissionPercent
      };
    });

    commissionSales.forEach(sale => {
      const agentName = sale.channel || (sale.commissionAgentId ? data.commissionAgents?.find(a => a.id === sale.commissionAgentId)?.name : 'Other Channel') || 'Direct';
      if (!map[agentName]) {
        map[agentName] = {
          name: agentName,
          count: 0,
          gross: 0,
          commission: 0,
          net: 0,
          defaultRate: 0
        };
      }

      const gross = sale.grossAmount || sale.total || 0;
      const comm = sale.commissionAmount || (sale.discountAmount || 0);
      const net = sale.netAmount || (gross - comm);

      map[agentName].count += 1;
      map[agentName].gross += gross;
      map[agentName].commission += comm;
      map[agentName].net += net;
    });

    return Object.values(map);
  }, [commissionSales, data.commissionAgents]);

  const handleExportCsv = () => {
    const headers = [
      'Date',
      'Invoice No',
      'Agent / Channel',
      'Gross Amount (BDT)',
      'Commission %',
      'Commission Deducted (BDT)',
      'Net Restaurant Revenue (BDT)',
      'Payment Method',
      'Items Details'
    ];

    const rows = commissionSales.map(s => {
      const agentName = s.channel || (s.commissionAgentId ? data.commissionAgents?.find(a => a.id === s.commissionAgentId)?.name : 'N/A') || 'Direct';
      const gross = s.grossAmount || s.total || 0;
      const comm = s.commissionAmount || (s.discountAmount || 0);
      const net = s.netAmount || (gross - comm);
      const commPct = s.commissionPercent || (gross > 0 ? ((comm / gross) * 100).toFixed(1) : '0');
      const payMethod = s.cash ? 'CASH' : s.card ? 'CARD' : s.bkash ? 'BKASH' : s.nagad ? 'NAGAD' : s.dueGiven ? 'DUE' : 'MIXED';

      return [
        s.date,
        s.invoiceNo,
        agentName,
        gross,
        `${commPct}%`,
        comm,
        net,
        payMethod,
        `"${(s.details || '').replace(/"/g, '""')}"`
      ];
    });

    exportCsvHelper(`commission-agents-report-${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <ReportFilters
        title="Commission Agents & Delivery Portals Report"
        subtitle="Separate breakdown of gross sales, agent commissions (Foodpanda, Pathao, Foodi), and net restaurant revenue"
        datePreset={datePreset}
        onPresetChange={setDatePreset}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onExportCsv={handleExportCsv}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
            <Percent className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
            >
              <option value="ALL">All Agents / Portals</option>
              {(data.commissionAgents || []).map(a => (
                <option key={a.id} value={a.name}>
                  {a.name} ({a.commissionPercent}%)
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search invoice or items..."
              className="pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </ReportFilters>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Gross Sales Value</span>
            <Receipt className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            ৳ {summaryStats.grossTotal.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Total customer bill across {summaryStats.orderCount} orders
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold mb-1">
            <span>Total Agent Commission</span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 font-mono">
            - ৳ {summaryStats.totalCommission.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-700/80 font-semibold mt-1">
            Avg. {summaryStats.avgCommissionRate}% portal commission cost
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold mb-1">
            <span>Net Restaurant Inflow</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 font-mono">
            ৳ {summaryStats.netRestaurant.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700/80 font-semibold mt-1">
            Realized cash/bank payout to restaurant
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Orders Completed</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {summaryStats.orderCount} Orders
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Processed through commission channels
          </div>
        </div>
      </div>

      {/* Agent-Wise Performance Summary Cards */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-amber-600" />
          <span>Commission Agent-Wise Revenue & Deductions Breakdown</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agentBreakdown.map((agent, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900">{agent.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                  {agent.defaultRate ? `${agent.defaultRate}% Rate` : 'Custom'}
                </span>
              </div>
              
              <div className="text-xs space-y-1 pt-1 border-t border-slate-200">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Orders Processed:</span>
                  <span className="font-bold text-slate-900">{agent.count}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Gross Sales:</span>
                  <span className="font-bold font-mono text-slate-900">৳ {agent.gross.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>Commission Deducted:</span>
                  <span className="font-mono">- ৳ {agent.commission.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-extrabold pt-1 border-t border-dashed border-slate-300">
                  <span>Net Payout:</span>
                  <span className="font-mono">৳ {agent.net.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-900 text-sm">Detailed Commission Order Transactions</h3>
            <p className="text-xs text-slate-500">Every order with separate Gross, Commission Amount, and Net figures</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Invoice No</th>
                <th className="py-3 px-3">Agent / Channel</th>
                <th className="py-3 px-3 max-w-xs">Ordered Items</th>
                <th className="py-3 px-3 text-right">Gross Total (৳)</th>
                <th className="py-3 px-3 text-center">Commission %</th>
                <th className="py-3 px-3 text-right text-amber-700">Commission (৳)</th>
                <th className="py-3 px-3 text-right text-emerald-700">Net Revenue (৳)</th>
                <th className="py-3 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {commissionSales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                    No transactions match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                commissionSales.map(sale => {
                  const agentName = sale.channel || (sale.commissionAgentId ? data.commissionAgents?.find(a => a.id === sale.commissionAgentId)?.name : 'Direct') || 'Direct';
                  const gross = sale.grossAmount || sale.total || 0;
                  const comm = sale.commissionAmount || (sale.discountAmount || 0);
                  const net = sale.netAmount || (gross - comm);
                  const commPct = sale.commissionPercent || (gross > 0 ? ((comm / gross) * 100).toFixed(1) : '0');

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">{sale.date}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {sale.invoiceNo}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-900 font-extrabold rounded-md text-[11px] border border-amber-200">
                          {agentName}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-slate-800">
                        {sale.details}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ৳ {gross.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-amber-700">
                        {commPct}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-amber-700">
                        - ৳ {comm.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-700">
                        ৳ {net.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setPrintableReceipt({
                              invoiceNo: sale.invoiceNo || 'INV-' + sale.id,
                              dateTime: sale.date,
                              tableName: sale.table || 'Online Delivery',
                              waiter: 'Online Dispatch',
                              orderTakenBy: 'Online Dispatch',
                              settleBillRole: 'Cashier',
                              customer: sale.channelOrAgent || 'Delivery Partner',
                              items: sale.items || [],
                              subtotal: gross,
                              discountDeduction: comm,
                              discountType: 'taka',
                              discountVal: comm,
                              netTotal: net,
                              isSettled: true,
                              receiptType: 'PAID_MEMO'
                            });
                          }}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Print Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

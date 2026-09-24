import React, { useState, useMemo } from 'react';
import { useRestaurant, isSaleActive } from '../../context/RestaurantContext';
import { ReportFilters, DatePreset, exportCsvHelper } from './ReportFilters';
import { 
  ChefHat, 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Award, 
  Flame, 
  UtensilsCrossed, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  Layers, 
  Eye, 
  X,
  PieChart,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { SaleRecord, MenuItem } from '../../types';

export const KitchenDepartmentSalesReport: React.FC = () => {
  const { data } = useRestaurant();

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'revenue' | 'qty' | 'itemCount'>('revenue');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [activeDepartmentDrilldown, setActiveDepartmentDrilldown] = useState<string | null>(null);

  // Filter sales by date (excluding voided)
  const filteredSales = useMemo(() => {
    return (data.sales || []).filter(sale => {
      if (!isSaleActive(sale)) return false;
      if (startDate && sale.date < startDate) return false;
      if (endDate && sale.date > endDate) return false;
      return true;
    });
  }, [data.sales, startDate, endDate]);

  // Aggregate stats per Kitchen Department
  const departmentStats = useMemo(() => {
    const map: Record<string, {
      department: string;
      itemCount: number;
      totalQtyDispatched: number;
      grossRevenue: number;
      orderTicketsCount: number;
      topDishName: string;
      topDishQty: number;
      topDishRevenue: number;
      dishesList: {
        id?: number;
        name: string;
        category: string;
        price: number;
        qtySold: number;
        revenue: number;
      }[];
    }> = {};

    // 1. Initialize from master departments
    const allDepts = new Set<string>();
    (data.departments || []).forEach(d => allDepts.add(d));
    (data.menuItems || []).forEach(m => {
      if (m.department) allDepts.add(m.department);
    });

    allDepts.forEach(dept => {
      map[dept] = {
        department: dept,
        itemCount: 0,
        totalQtyDispatched: 0,
        grossRevenue: 0,
        orderTicketsCount: 0,
        topDishName: 'N/A',
        topDishQty: 0,
        topDishRevenue: 0,
        dishesList: []
      };
    });

    // Populate catalog items
    (data.menuItems || []).forEach(m => {
      const dept = m.department || 'Main Kitchen';
      if (!map[dept]) {
        map[dept] = {
          department: dept,
          itemCount: 0,
          totalQtyDispatched: 0,
          grossRevenue: 0,
          orderTicketsCount: 0,
          topDishName: 'N/A',
          topDishQty: 0,
          topDishRevenue: 0,
          dishesList: []
        };
      }
      map[dept].itemCount += 1;
      map[dept].dishesList.push({
        id: m.id,
        name: m.name,
        category: m.category || 'General',
        price: m.price,
        qtySold: 0,
        revenue: 0
      });
    });

    // 2. Aggregate sales
    filteredSales.forEach(sale => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(cartItem => {
          const match = (data.menuItems || []).find(m => m.name.toLowerCase() === cartItem.name.toLowerCase() || m.id === cartItem.id);
          const dept = cartItem.department || match?.department || 'Main Kitchen';

          if (!map[dept]) {
            map[dept] = {
              department: dept,
              itemCount: 1,
              totalQtyDispatched: 0,
              grossRevenue: 0,
              orderTicketsCount: 0,
              topDishName: 'N/A',
              topDishQty: 0,
              topDishRevenue: 0,
              dishesList: []
            };
          }

          const qty = Number(cartItem.qty) || 1;
          const lineTotal = Number(cartItem.price) * qty;

          map[dept].totalQtyDispatched += qty;
          map[dept].grossRevenue += lineTotal;
          map[dept].orderTicketsCount += 1;

          let existing = map[dept].dishesList.find(d => d.name.toLowerCase() === cartItem.name.toLowerCase());
          if (!existing) {
            existing = {
              id: cartItem.id,
              name: cartItem.name,
              category: cartItem.category || match?.category || 'General',
              price: cartItem.price,
              qtySold: 0,
              revenue: 0
            };
            map[dept].dishesList.push(existing);
          }
          existing.qtySold += qty;
          existing.revenue += lineTotal;
        });
      } else if (sale.details) {
        // Fallback for mock/legacy sales
        (data.menuItems || []).forEach(m => {
          if (sale.details.toLowerCase().includes(m.name.toLowerCase())) {
            const dept = m.department || 'Main Kitchen';
            if (map[dept]) {
              const qtyMatch = sale.details.match(new RegExp(`${m.name}\\s*\\((\\d+)\\)`, 'i'));
              const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
              const lineTotal = m.price * qty;

              map[dept].totalQtyDispatched += qty;
              map[dept].grossRevenue += lineTotal;
              map[dept].orderTicketsCount += 1;

              const existing = map[dept].dishesList.find(d => d.name.toLowerCase() === m.name.toLowerCase());
              if (existing) {
                existing.qtySold += qty;
                existing.revenue += lineTotal;
              }
            }
          }
        });
      }
    });

    // Determine top dish per station
    Object.values(map).forEach(deptObj => {
      if (deptObj.dishesList.length > 0) {
        const sorted = [...deptObj.dishesList].sort((a, b) => b.qtySold - a.qtySold);
        if (sorted[0].qtySold > 0) {
          deptObj.topDishName = sorted[0].name;
          deptObj.topDishQty = sorted[0].qtySold;
          deptObj.topDishRevenue = sorted[0].revenue;
        }
      }
    });

    let list = Object.values(map);

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => 
        d.department.toLowerCase().includes(q) || 
        d.topDishName.toLowerCase().includes(q)
      );
    }

    // Sort list
    list.sort((a, b) => {
      let valA = a.grossRevenue;
      let valB = b.grossRevenue;
      if (sortField === 'qty') {
        valA = a.totalQtyDispatched;
        valB = b.totalQtyDispatched;
      } else if (sortField === 'itemCount') {
        valA = a.itemCount;
        valB = b.itemCount;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

    return list;
  }, [data.departments, data.menuItems, filteredSales, searchQuery, sortField, sortOrder]);

  // Overall totals
  const totalDepartmentRevenue = useMemo(() => departmentStats.reduce((s, d) => s + d.grossRevenue, 0), [departmentStats]);
  const totalDepartmentQty = useMemo(() => departmentStats.reduce((s, d) => s + d.totalQtyDispatched, 0), [departmentStats]);
  const activeDepartmentsCount = useMemo(() => departmentStats.filter(d => d.totalQtyDispatched > 0).length, [departmentStats]);
  const topRevenueDepartment = useMemo(() => {
    if (departmentStats.length === 0) return null;
    const sorted = [...departmentStats].sort((a, b) => b.grossRevenue - a.grossRevenue);
    return sorted[0].grossRevenue > 0 ? sorted[0] : null;
  }, [departmentStats]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Rank',
      'Kitchen Department / Station',
      'Catalog Items Assigned',
      'Dishes Prepared / Qty',
      'Gross Sales Revenue (BDT)',
      'Share of Production (%)',
      'Top Dispatched Dish',
      'Top Dish Volume'
    ];

    const rows = departmentStats.map((d, idx) => {
      const share = totalDepartmentRevenue > 0 ? ((d.grossRevenue / totalDepartmentRevenue) * 100).toFixed(1) + '%' : '0%';
      return [
        idx + 1,
        d.department,
        d.itemCount,
        d.totalQtyDispatched,
        d.grossRevenue,
        share,
        d.topDishName,
        d.topDishQty
      ];
    });

    exportCsvHelper('Kitchen_Department_Sales_Report_' + new Date().toISOString().split('T')[0] + '.csv', headers, rows);
  };

  const handlePrint = () => {
    window.print();
  };

  // Drilldown department
  const drilldownDept = useMemo(() => {
    if (!activeDepartmentDrilldown) return null;
    return departmentStats.find(d => d.department === activeDepartmentDrilldown) || null;
  }, [activeDepartmentDrilldown, departmentStats]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-black uppercase tracking-wider">
              POS Report #4
            </span>
            <h2 className="text-xl font-black text-slate-900">
              Kitchen Department Wise Sales Report
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Production workload, KOT preparation stations, revenue generated per station, and top prepared dishes.
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
        searchPlaceholder="Search kitchen department, dish..."
        totalRecords={departmentStats.length}
        onExportCsv={handleExportCsv}
        onPrint={handlePrint}
      >
        {/* Sort */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
          <label className="text-xs font-bold text-slate-500 whitespace-nowrap">Sort By:</label>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="bg-transparent text-slate-800 text-xs font-bold focus:outline-none cursor-pointer"
          >
            <option value="revenue">Highest Revenue</option>
            <option value="qty">Highest Food Volume Prepared</option>
            <option value="itemCount">Most Assigned Items</option>
          </select>
        </div>
      </ReportFilters>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Active Kitchen Stations</span>
            <ChefHat className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {activeDepartmentsCount} <span className="text-xs text-slate-400 font-medium">/ {departmentStats.length} stations</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Handling live kitchen orders
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Total Kitchen Output</span>
            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
            {totalDepartmentQty.toLocaleString()} <span className="text-xs text-slate-400 font-medium">dishes prepared</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Total production: ৳{totalDepartmentRevenue.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Highest Output Station</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 mt-1 truncate">
            {topRevenueDepartment ? topRevenueDepartment.department : 'N/A'}
          </div>
          <div className="text-[11px] text-amber-700 font-bold mt-0.5 truncate">
            {topRevenueDepartment ? `৳${topRevenueDepartment.grossRevenue.toLocaleString()} (${topRevenueDepartment.totalQtyDispatched} items)` : 'No orders recorded'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>Avg Station Production</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            ৳{activeDepartmentsCount > 0 ? Math.round(totalDepartmentRevenue / activeDepartmentsCount).toLocaleString() : '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Average revenue per kitchen section
          </div>
        </div>
      </div>

      {/* Kitchen Station Production Progress Bars */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            <span>Kitchen Section Workload & Output Allocation</span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Section-wise production share
          </span>
        </div>

        <div className="space-y-3">
          {departmentStats.filter(d => d.grossRevenue > 0).map((d, idx) => {
            const share = totalDepartmentRevenue > 0 ? (d.grossRevenue / totalDepartmentRevenue) * 100 : 0;
            const barColors = ['bg-teal-600', 'bg-amber-500', 'bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-purple-600', 'bg-rose-500'];
            const colorClass = barColors[idx % barColors.length];

            return (
              <div key={d.department} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">{d.department}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({d.totalQtyDispatched} items prepared)</span>
                  </div>
                  <div className="font-black text-slate-900">
                    ৳{d.grossRevenue.toLocaleString()} <span className="text-slate-400 font-medium text-[10px]">({share.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${colorClass}`}
                    style={{ width: `${Math.max(2, share)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Kitchen Department Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900 text-base">
              Kitchen Department Performance Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Kitchen prep stations, total dishes dispatched, total sales generated, and star dish.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            {departmentStats.length} Stations
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-2.5 py-2.5">#</th>
                <th className="px-2.5 py-2.5">Kitchen Department / Section</th>
                <th className="px-2.5 py-2.5 text-center">Assigned Items</th>
                <th className="px-2.5 py-2.5 text-center">Dishes Prepared</th>
                <th className="px-2.5 py-2.5 text-right">Production Sales (BDT)</th>
                <th className="px-2.5 py-2.5">Top Dispatched Dish</th>
                <th className="px-2.5 py-2.5 text-center">Output Share</th>
                <th className="px-2.5 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentStats.map((d, index) => {
                const share = totalDepartmentRevenue > 0 ? ((d.grossRevenue / totalDepartmentRevenue) * 100).toFixed(1) : '0';

                return (
                  <tr key={d.department} className="hover:bg-slate-50/80 transition">
                    <td className="px-2.5 py-2.5 font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-2.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                          <ChefHat className="w-3.5 h-3.5 text-teal-700" />
                        </div>
                        <div className="font-black text-slate-900 text-xs sm:text-sm">
                          {d.department}
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-extrabold text-xs">
                        {d.itemCount} items
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 text-center font-black text-slate-900">
                      {d.totalQtyDispatched}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-black text-slate-900 text-xs sm:text-sm">
                      ৳{d.grossRevenue.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2.5">
                      {d.topDishName !== 'N/A' ? (
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {d.topDishName}
                          </div>
                          <div className="text-[10px] text-teal-700 font-medium">
                            {d.topDishQty} prepared (৳{d.topDishRevenue.toLocaleString()})
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 text-center font-bold text-teal-800">
                      <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 text-[11px] font-black">
                        {share}%
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 text-center">
                      <button
                        onClick={() => setActiveDepartmentDrilldown(d.department)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 font-bold text-[11px] transition cursor-pointer flex items-center gap-1 mx-auto"
                        title="View Station Dishes"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Dishes</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {departmentStats.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No kitchen department records found.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Total Footer */}
            <tfoot className="bg-slate-900 text-white font-extrabold text-xs">
              <tr>
                <td colSpan={2} className="px-4 py-3.5 uppercase tracking-wider text-amber-400">
                  Total Kitchen Output
                </td>
                <td className="px-4 py-3.5 text-center text-slate-300">
                  {departmentStats.reduce((s, d) => s + d.itemCount, 0)} items
                </td>
                <td className="px-4 py-3.5 text-center text-amber-400">
                  {totalDepartmentQty} dishes
                </td>
                <td className="px-4 py-3.5 text-right text-amber-400 text-sm">
                  ৳{totalDepartmentRevenue.toLocaleString()}
                </td>
                <td className="px-4 py-3.5"></td>
                <td className="px-4 py-3.5 text-center text-amber-400">
                  100%
                </td>
                <td className="px-4 py-3.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Department Drilldown Modal */}
      {drilldownDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-xs font-black">
                    Station Menu Items
                  </span>
                  <h3 className="text-lg font-black text-slate-900">
                    {drilldownDept.department}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Total {drilldownDept.dishesList.length} items • Production Sales: ৳{drilldownDept.grossRevenue.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setActiveDepartmentDrilldown(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 py-4 space-y-2">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Dish Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-center">Prepared Qty</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drilldownDept.dishesList.map(dish => (
                    <tr key={dish.name} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-extrabold text-slate-900">
                        {dish.name}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {dish.category}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-700">
                        ৳{dish.price}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-slate-900">
                        {dish.qtySold}
                      </td>
                      <td className="px-3 py-2.5 text-right font-black text-emerald-700">
                        ৳{dish.revenue.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setActiveDepartmentDrilldown(null)}
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

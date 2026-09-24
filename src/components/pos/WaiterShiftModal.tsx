import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { dispatchHardwarePrint } from '../../utils/hardwarePrint';
import { 
  X, 
  UserCheck, 
  Utensils, 
  Printer, 
  ArrowRightLeft, 
  CheckCircle2, 
  Clock, 
  Receipt, 
  LogOut,
  Play
} from 'lucide-react';

const SHIFT_TYPES: ('Morning Shift' | 'Evening Shift' | 'Night Shift')[] = [
  'Morning Shift',
  'Evening Shift',
  'Night Shift'
];

export const WaiterShiftModal: React.FC = () => {
  const { 
    isWaiterShiftModalOpen, 
    setIsWaiterShiftModalOpen, 
    selectedWaiterForShiftModal,
    setSelectedWaiterForShiftModal,
    transferWaiterTables,
    startWaiterShift,
    endWaiterShift,
    data,
    currentUser,
    logout,
    language
  } = useRestaurant();

  const activeWaiter = selectedWaiterForShiftModal || (currentUser?.role === 'WAITER' ? currentUser.name : data.waiters[0] || 'Staff');
  
  // Active shift for selected waiter
  const activeWaiterShift = (data.activeWaiterShift && data.activeWaiterShift.waiterName.toLowerCase() === activeWaiter.toLowerCase()) 
    ? data.activeWaiterShift 
    : null;

  // Shift Open Form States
  const [selectedZone, setSelectedZone] = useState<string>('All Zones (Entire Floor)');
  const [selectedShiftType, setSelectedShiftType] = useState<'Morning Shift' | 'Evening Shift' | 'Night Shift'>('Morning Shift');
  const [openingNotes, setOpeningNotes] = useState<string>('');
  const [checklistHygiene, setChecklistHygiene] = useState<boolean>(true);
  const [checklistDevice, setChecklistDevice] = useState<boolean>(true);

  // Shift Close / Handover States
  const [targetWaiter, setTargetWaiter] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [isPrintingSlip, setIsPrintingSlip] = useState<boolean>(false);

  // Available zones
  const availableZones = useMemo(() => {
    const defaultZones = ['All Zones (Entire Floor)', 'Floor 1', 'Floor 2', 'Rooftop Lounge', 'VIP Section'];
    const dynamicZones = (data.tableZones && data.tableZones.length > 0) ? data.tableZones : [];
    return Array.from(new Set(['All Zones (Entire Floor)', ...dynamicZones, ...defaultZones]));
  }, [data.tableZones]);

  // Filter running tables assigned to this waiter
  const waiterRunningTables = useMemo(() => {
    return (data.tables || []).filter(t => 
      t.status !== 'free' && 
      (t.waiter || '').toLowerCase().trim() === activeWaiter.toLowerCase().trim()
    );
  }, [data.tables, activeWaiter]);

  // Compute today's sales served by this waiter
  const today = new Date().toISOString().split('T')[0];
  const waiterSales = useMemo(() => {
    return (data.sales || []).filter(s => {
      if (s.isVoid || s.status === 'VOIDED' || s.status === 'CANCELLED') return false;
      if (s.date !== today) return false;
      const details = (s.details || '').toLowerCase();
      const wName = activeWaiter.toLowerCase();
      return details.includes(wName);
    });
  }, [data.sales, today, activeWaiter]);

  const totalWaiterSalesAmount = waiterSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalOrdersCount = waiterSales.length;
  // Estimated tip / commission (5% convention)
  const estimatedTips = Math.round(totalWaiterSalesAmount * 0.05);

  if (!isWaiterShiftModalOpen) return null;

  const handleStartShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startWaiterShift(
      activeWaiter,
      selectedZone,
      selectedShiftType,
      openingNotes.trim()
    );
  };

  const handleTransfer = () => {
    if (!targetWaiter || targetWaiter === activeWaiter) return;
    transferWaiterTables(activeWaiter, targetWaiter);
    setTransferSuccess(`✅ All running tables reassigned to ${targetWaiter}!`);
    setTimeout(() => setTransferSuccess(null), 4000);
  };

  const handlePrintServerSlip = async () => {
    setIsPrintingSlip(true);
    const slipPayload = {
      restaurantName: data.restaurantProfile?.name || 'BARCODE CAFE BANANI',
      restaurantAddress: data.restaurantProfile?.address || 'Banani, Dhaka',
      waiterName: activeWaiter,
      date: today,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      totalOrders: totalOrdersCount,
      totalSales: totalWaiterSalesAmount,
      estimatedTips,
      runningTables: waiterRunningTables.map(t => ({
        name: t.name,
        zone: t.zone || 'Floor 1',
        total: t.cart.reduce((s, i) => s + (i.price * i.qty), 0)
      }))
    };

    try {
      await dispatchHardwarePrint('/api/hardware/print-waiter-slip', slipPayload);
    } catch {
      // ignore
    } finally {
      setIsPrintingSlip(false);
    }
  };

  const handleShiftOutAndLogout = async () => {
    if (waiterRunningTables.length > 0 && !targetWaiter) {
      alert(
        language === 'bn'
          ? '⚠️ You still have running tables! Please reassign tables to next waiter before ending shift.'
          : '⚠️ You still have active tables! Please select an incoming waiter to transfer your tables before shift-out.'
      );
      return;
    }
    if (waiterRunningTables.length > 0 && targetWaiter) {
      transferWaiterTables(activeWaiter, targetWaiter);
    }
    
    // Complete Shift record
    endWaiterShift(targetWaiter.trim(), closingNotes.trim());

    // Print Server Slip
    await handlePrintServerSlip();
    
    setIsWaiterShiftModalOpen(false);
    setSelectedWaiterForShiftModal(null);
    if (currentUser?.role === 'WAITER') {
      logout();
    }
  };

  const otherWaiters = data.waiters.filter(w => w.toLowerCase() !== activeWaiter.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#004b9b] flex items-center justify-center font-black shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">
                  {activeWaiterShift 
                    ? ('Waiter Shift Handover & Summary')
                    : ('Start Waiter Floor Shift')}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  activeWaiterShift ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-[#004b9b]'
                }`}>
                  {activeWaiterShift ? 'SHIFT ACTIVE' : 'START SHIFT'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeWaiterShift 
                  ? ('Shift sales summary slip & running table re-assignment')
                  : ('Clock-in floor duty, select assigned zone & shift timing')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsWaiterShiftModalOpen(false);
              setSelectedWaiterForShiftModal(null);
            }}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Waiter Switch Dropdown (For Managers or Quick Select) */}
        <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0">
            'Selected Waiter:'
          </span>
          <select
            value={activeWaiter}
            onChange={e => setSelectedWaiterForShiftModal(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:ring-2 focus:ring-[#004b9b]"
          >
            {data.waiters.map(w => (
              <option key={w} value={w}>{w} (Server)</option>
            ))}
          </select>
        </div>

        {/* --- VIEW 1: ACTIVE SHIFT & HANDOVER --- */}
        {activeWaiterShift ? (
          <div className="mt-3 space-y-3">
            {/* Active Shift Banner */}
            <div className="p-3 bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50 border border-blue-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#004b9b] uppercase tracking-wide">
                  {activeWaiterShift.shiftType} • {activeWaiterShift.assignedZone}
                </span>
                <h4 className="text-sm font-black text-slate-900 mt-0.5">
                  {activeWaiterShift.waiterName} (On Duty)
                </h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Duty Started</span>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#004b9b]" />
                  {activeWaiterShift.startTime}
                </span>
              </div>
            </div>

            {/* Shift KPIs Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-blue-300 font-black uppercase">
                <span>{activeWaiter} — Shift Performance</span>
                <span className="font-mono text-slate-400 text-[11px]">{today}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                <div className="bg-slate-800/80 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-bold">Total Orders</span>
                  <span className="text-base font-black text-white font-mono">{totalOrdersCount}</span>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-bold">Total Sales</span>
                  <span className="text-base font-black text-emerald-400 font-mono">৳{totalWaiterSalesAmount.toLocaleString()}</span>
                </div>
                <div className="bg-slate-800/80 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 block font-bold">Est. Tips (5%)</span>
                  <span className="text-base font-black text-amber-300 font-mono">৳{estimatedTips.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Running Tables Assigned to this Waiter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-[#004b9b]" />
                  <span>'Currently Active Tables'</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                  {waiterRunningTables.length} Active
                </span>
              </div>

              {waiterRunningTables.length === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>'No running tables pending. Ready to shift-out.'</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {waiterRunningTables.map(t => (
                      <div key={t.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black text-slate-900">{t.name}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5">({t.zone || 'Floor 1'})</span>
                        </div>
                        <span className="font-mono font-bold text-[#004b9b]">
                          ৳{t.cart.reduce((s, i) => s + (i.price * i.qty), 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Handover Running Tables to Next Waiter */}
                  <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                    <label className="block text-[11px] font-bold text-blue-950">
                      '🔄 Reassign active tables to incoming waiter:'
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={targetWaiter}
                        onChange={e => setTargetWaiter(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#004b9b]"
                      >
                        <option value="">-- Select Incoming Waiter --</option>
                        {otherWaiters.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleTransfer}
                        disabled={!targetWaiter}
                        className="px-3 py-1.5 bg-[#004b9b] hover:bg-[#005bb8] text-white text-xs font-bold rounded-lg shadow-xs disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Transfer</span>
                      </button>
                    </div>
                    {transferSuccess && (
                      <div className="text-[11px] font-bold text-emerald-800 animate-in fade-in">
                        {transferSuccess}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handlePrintServerSlip}
                disabled={isPrintingSlip}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>{isPrintingSlip ? 'Printing...' : 'Print Server Slip'}</span>
              </button>

              <button
                type="button"
                onClick={handleShiftOutAndLogout}
                disabled={isPrintingSlip}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-white" />
                <span>End Shift & Logout</span>
              </button>
            </div>
          </div>
        ) : (
          /* --- VIEW 2: START WAITER SHIFT FORM --- */
          <form onSubmit={handleStartShiftSubmit} className="mt-4 space-y-3.5">
            {/* Assigned Zone / Section */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                'Assigned Floor / Zone'
              </label>
              <select
                value={selectedZone}
                onChange={e => setSelectedZone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#004b9b] transition"
              >
                {availableZones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {/* Shift Timing */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                'Shift Timing'
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SHIFT_TYPES.map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedShiftType(st)}
                    className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition cursor-pointer ${
                      selectedShiftType === st
                        ? 'bg-[#004b9b] text-white border-[#004b9b] shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Pre-Shift Floor Readiness Checklist */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block uppercase">
                'Pre-Shift Floor Checklist'
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklistHygiene}
                  onChange={e => setChecklistHygiene(e.target.checked)}
                  className="rounded text-[#004b9b] focus:ring-[#004b9b]"
                />
                <span>Table sanitization, cutlery & water bottles verified</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklistDevice}
                  onChange={e => setChecklistDevice(e.target.checked)}
                  className="rounded text-[#004b9b] focus:ring-[#004b9b]"
                />
                <span>Mobile ordering terminal / order pad ready</span>
              </label>
            </div>

            {/* Opening Remarks (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                'Opening Remarks (Optional)'
              </label>
              <input
                type="text"
                value={openingNotes}
                onChange={e => setOpeningNotes(e.target.value)}
                placeholder="e.g., Table 1-8 allocated, VIP guest arriving at 1 PM"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#004b9b] transition"
              />
            </div>

            {/* Submit Start Shift Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-[#004b9b] hover:bg-[#005bb8] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>'Start Shift'</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

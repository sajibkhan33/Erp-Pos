import React, { useState, useMemo } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { dispatchHardwarePrint } from '../../utils/hardwarePrint';
import { 
  X, 
  ChefHat, 
  Utensils, 
  Printer, 
  ArrowRightLeft, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Flame,
  CheckSquare,
  FileText,
  AlertCircle
} from 'lucide-react';

const KITCHEN_STATIONS = [
  'Main Kitchen',
  'Rooftop Grill & BBQ',
  'Beverage & Cafe Counter',
  'Bakery & Pastry',
  'All Stations (Executive)'
];

const SHIFT_TYPES: ('Morning Shift' | 'Evening Shift' | 'Night Shift')[] = [
  'Morning Shift',
  'Evening Shift',
  'Night Shift'
];

export const ChefShiftModal: React.FC = () => {
  const { 
    isChefShiftModalOpen, 
    setIsChefShiftModalOpen, 
    data,
    currentUser,
    startChefShift,
    endChefShift,
    language
  } = useRestaurant();

  // Shift Open Form States
  const [selectedChef, setSelectedChef] = useState<string>(() => currentUser?.name || 'Executive Chef (Kabir)');
  const [selectedStation, setSelectedStation] = useState<string>('Main Kitchen');
  const [selectedShiftType, setSelectedShiftType] = useState<'Morning Shift' | 'Evening Shift' | 'Night Shift'>('Morning Shift');
  const [openingNotes, setOpeningNotes] = useState<string>('');
  const [checklistPrep, setChecklistPrep] = useState<boolean>(true);
  const [checklistStock, setChecklistStock] = useState<boolean>(true);

  // Shift Close / Handover States
  const [handoverTargetChef, setHandoverTargetChef] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isPrintingSlip, setIsPrintingSlip] = useState<boolean>(false);

  const activeChefShift = data.activeChefShift;

  // Compute live dishes cooked & KOTs processed during active shift
  const today = new Date().toISOString().split('T')[0];
  const liveShiftStats = useMemo(() => {
    if (!activeChefShift) return { totalKots: 0, totalDishes: 0, dishBreakdown: [] };

    const startTs = activeChefShift.startTimestamp || (Date.now() - 3600000);
    const shiftSales = (data.sales || []).filter(s => s.date === today && (s.createdAt || 0) >= startTs && !s.isVoid && s.status !== 'VOIDED' && s.status !== 'CANCELLED');

    const dishMap: Record<string, number> = {};
    let totalDishes = 0;

    shiftSales.forEach(s => {
      (s.items || []).forEach(item => {
        dishMap[item.name] = (dishMap[item.name] || 0) + item.qty;
        totalDishes += item.qty;
      });
    });

    const dishBreakdown = Object.entries(dishMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);

    return {
      totalKots: shiftSales.length,
      totalDishes,
      dishBreakdown
    };
  }, [activeChefShift, data.sales, today]);

  // Running tables with food in preparation
  const runningPrepTables = useMemo(() => {
    return (data.tables || []).filter(t => t.status !== 'free' && t.cart && t.cart.length > 0);
  }, [data.tables]);

  if (!isChefShiftModalOpen) return null;

  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    startChefShift(
      selectedChef.trim() || 'Chef',
      selectedStation,
      selectedShiftType,
      openingNotes.trim()
    );
  };

  const handleEndShift = () => {
    endChefShift(handoverTargetChef.trim(), closingNotes.trim());
  };

  const handleDirectPrintSlip = async () => {
    if (!activeChefShift) return;
    setIsPrintingSlip(true);
    try {
      await dispatchHardwarePrint('/api/hardware/print-chef-slip', {
        restaurantName: data.restaurantProfile?.name || 'BARCODE CAFE BANANI',
        restaurantAddress: data.restaurantProfile?.address || 'Banani, Dhaka',
        shift: {
          ...activeChefShift,
          endTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          kotsPreparedCount: liveShiftStats.totalKots,
          dishesCookedCount: liveShiftStats.totalDishes,
          notes: closingNotes || activeChefShift.notes || '',
          handoverToChef: handoverTargetChef || ''
        }
      });
    } catch {
      // ignore
    } finally {
      setIsPrintingSlip(false);
    }
  };

  const chefsList = (data.users || [])
    .filter(u => u.role === 'CHEF')
    .map(u => u.name);
  const availableChefs = chefsList.length > 0 ? chefsList : ['Executive Chef (Kabir)', 'Sous Chef (Faruk)', 'Line Cook (Habib)'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[95vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#004b9b] flex items-center justify-center font-black shadow-xs">
              <ChefHat className="w-5 h-5 text-[#004b9b]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-base">
                  {activeChefShift 
                    ? ('Kitchen Shift & Handover')
                    : ('Start Kitchen Shift')}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  activeChefShift ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-[#004b9b]'
                }`}>
                  {activeChefShift ? 'SHIFT ACTIVE' : 'CHEF DUTY'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {language === 'bn' 
                  ? 'Chef station management, running KOT preparation & handover' 
                  : 'Kitchen station management, live KOT production & handover'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsChefShiftModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- VIEW 1: ACTIVE CHEF SHIFT & HANDOVER --- */}
        {activeChefShift ? (
          <div className="mt-4 space-y-4">
            {/* Active Shift Badge */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-[#004b9b] uppercase tracking-wide">
                    {activeChefShift.shiftType}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 mt-0.5">
                    {activeChefShift.chefName} • {activeChefShift.station}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Duty Started</span>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#004b9b]" />
                    {activeChefShift.startTime}
                  </span>
                </div>
              </div>
            </div>

            {/* Production Metrics Counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">KOTs Processed</span>
                <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                  {liveShiftStats.totalKots}
                </span>
                <span className="text-[10px] text-slate-400">Tickets in this shift</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Dishes Prepared</span>
                <span className="text-2xl font-black text-[#004b9b] font-mono mt-1 block">
                  {liveShiftStats.totalDishes}
                </span>
                <span className="text-[10px] text-slate-400">Plates / Portions cooked</span>
              </div>
            </div>

            {/* Top Dishes Cooked List */}
            {liveShiftStats.dishBreakdown.length > 0 && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
                  <Flame className="w-3.5 h-3.5 text-[#004b9b]" />
                  <span>Prepared Dishes in this Shift:</span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                  {liveShiftStats.dishBreakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
                      <span className="text-slate-700 truncate">{item.name}</span>
                      <span className="font-bold text-[#004b9b] bg-blue-50 px-2 py-0.5 rounded text-[11px] font-mono">
                        {item.qty}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* In-Prep / Running Orders Notification */}
            {runningPrepTables.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {language === 'bn' 
                      ? `${runningPrepTables.length} tables currently being prepared` 
                      : `${runningPrepTables.length} tables currently have running orders in preparation`}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800/80">
                  {language === 'bn'
                    ? 'Hand over active cooking preparations to incoming chef.'
                    : 'Please brief the incoming shift chef about active items on fire.'}
                </p>
              </div>
            )}

            {/* Handover to Incoming Chef */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                'Handover to Incoming Chef:'
              </label>
              <select
                value={handoverTargetChef}
                onChange={e => setHandoverTargetChef(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#004b9b]"
              >
                <option value="">'-- Select Incoming Chef --'</option>
                {availableChefs.filter(c => c !== activeChefShift.chefName).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <input
                type="text"
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
                placeholder='Handover notes (e.g. mise en place done, stock replenished)'
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-[#004b9b]"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleDirectPrintSlip}
                disabled={isPrintingSlip}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>{isPrintingSlip ? 'Printing...' : 'Print Kitchen Slip'}</span>
              </button>

              <button
                type="button"
                onClick={handleEndShift}
                className="flex-1 w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>'End Duty & Handover'</span>
              </button>
            </div>
          </div>
        ) : (
          /* --- VIEW 2: START CHEF SHIFT FORM --- */
          <form onSubmit={handleStartShift} className="mt-4 space-y-4">
            {/* Chef Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                On-Duty Chef Name
              </label>
              <select
                value={selectedChef}
                onChange={e => setSelectedChef(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#004b9b] transition"
              >
                {availableChefs.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Station Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Kitchen Station / Section
              </label>
              <select
                value={selectedStation}
                onChange={e => setSelectedStation(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#004b9b] transition"
              >
                {KITCHEN_STATIONS.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* Shift Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Shift Timing
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

            {/* Pre-Shift Kitchen Readiness Checklist */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block uppercase">
                'Pre-Shift Kitchen Checklist'
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklistPrep}
                  onChange={e => setChecklistPrep(e.target.checked)}
                  className="rounded text-[#004b9b] focus:ring-[#004b9b]"
                />
                <span>Mise en Place & station sanitization checked</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklistStock}
                  onChange={e => setChecklistStock(e.target.checked)}
                  className="rounded text-[#004b9b] focus:ring-[#004b9b]"
                />
                <span>Raw materials inventory verified for today's menu</span>
              </label>
            </div>

            {/* Opening Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Opening Remarks / Prep Notes (Optional)
              </label>
              <input
                type="text"
                value={openingNotes}
                onChange={e => setOpeningNotes(e.target.value)}
                placeholder="e.g., Morning prep completed, sauce batches ready"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#004b9b] transition"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 bg-[#004b9b] hover:bg-[#005bb8] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <ChefHat className="w-4 h-4" />
                <span>'Start Kitchen Shift'</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

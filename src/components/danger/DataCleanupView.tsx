import React, { useState, useRef } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { 
  AlertTriangle, 
  Trash2, 
  RefreshCcw, 
  CheckCircle2, 
  ShieldAlert, 
  Download, 
  Upload, 
  Database, 
  Receipt, 
  Wallet, 
  ShoppingCart, 
  Boxes, 
  UtensilsCrossed, 
  Layers, 
  Sliders, 
  Users, 
  FileJson,
  X,
  CreditCard,
  FileText
} from 'lucide-react';

interface CleanModuleTarget {
  key: 'sales' | 'expenses' | 'purchases' | 'payables' | 'receivables' | 'inventory' | 'menu-items' | 'master-items' | 'tables' | 'heads' | 'users';
  label: string;
  desc: string;
  count: string;
  color: string;
  icon: any;
}

export const DataCleanupView: React.FC = () => {
  const { 
    resetModuleData, 
    resetAllData, 
    exportBackupJson, 
    importBackupJson, 
    data 
  } = useRestaurant();

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-app Modal Confirmation States
  const [pendingModule, setPendingModule] = useState<CleanModuleTarget | null>(null);
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 4500);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
    setTimeout(() => setErrorMsg(null), 4500);
  };

  const confirmCleanModule = () => {
    if (!pendingModule) return;
    setIsProcessing(true);
    try {
      resetModuleData(pendingModule.key as any);
      showSuccess(`"${pendingModule.label}" module records have been cleared successfully!`);
    } catch (e: any) {
      showError('Failed to clear module data: ' + (e?.message || 'Error'));
    } finally {
      setIsProcessing(false);
      setPendingModule(null);
    }
  };

  const confirmFactoryReset = () => {
    setIsProcessing(true);
    try {
      resetAllData();
      showSuccess('All transaction records have been successfully reset! Menus, users, and configurations remain intact.');
    } catch (e: any) {
      showError('Failed to reset system: ' + (e?.message || 'Error'));
    } finally {
      setIsProcessing(false);
      setIsFactoryResetModalOpen(false);
    }
  };

  const handleExportBackup = () => {
    try {
      exportBackupJson();
      showSuccess('System backup JSON file downloaded successfully!');
    } catch (e: any) {
      showError('Failed to export backup: ' + (e?.message || 'Unknown error'));
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsedData = JSON.parse(content);
        const success = importBackupJson(parsedData);
        if (success) {
          showSuccess('System backup successfully restored! All modules updated.');
        } else {
          showError('Invalid backup file format or corrupted JSON schema.');
        }
      } catch (err: any) {
        showError('Error reading backup file: ' + (err?.message || 'Invalid file'));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const modulesList: CleanModuleTarget[] = [
    {
      key: 'sales',
      label: 'Sales & Customer Invoices',
      desc: 'All POS order invoices, customer receipts, and bill payments.',
      count: `${data.sales.length} invoices`,
      icon: Receipt,
      color: 'text-emerald-600 bg-emerald-50'
    },
    {
      key: 'expenses',
      label: 'Operating Expenses',
      desc: 'All daily operational expenses, utility, and petty cash voucher entries.',
      count: `${data.expenses.length} vouchers`,
      icon: Wallet,
      color: 'text-rose-600 bg-rose-50'
    },
    {
      key: 'purchases',
      label: 'Purchases & Stock Inward',
      desc: 'All supplier purchase vouchers, orders, returns, and raw material inwards.',
      count: `${data.purchases.length} vouchers`,
      icon: ShoppingCart,
      color: 'text-blue-600 bg-blue-50'
    },
    {
      key: 'payables',
      label: 'Vendor Payments & Settlement',
      desc: 'All payments made to suppliers and debt settlement logs.',
      count: `${data.payments.length} payments`,
      icon: CreditCard,
      color: 'text-amber-600 bg-amber-50'
    },
    {
      key: 'receivables',
      label: 'Customer Advances & Dues',
      desc: 'All advance deposits, customer receivables, and booking records.',
      count: `${(data.customerAdvances || []).length} advances`,
      icon: FileText,
      color: 'text-teal-600 bg-teal-50'
    },
    {
      key: 'inventory',
      label: 'Stock Ledger & Adjustments',
      desc: 'Stock ledger records, manual usage adjustments, and wastage entries.',
      count: `${data.inventory.length} ledger rows`,
      icon: Boxes,
      color: 'text-indigo-600 bg-indigo-50'
    },
    {
      key: 'menu-items',
      label: 'Menu Dishes & Recipe BOMs',
      desc: 'All restaurant menu dishes, prices, and linked ingredient recipe BOMs.',
      count: `${data.menuItems.length} dishes`,
      icon: UtensilsCrossed,
      color: 'text-amber-600 bg-amber-50'
    },
    {
      key: 'master-items',
      label: 'Raw Materials Master Items',
      desc: 'Raw ingredient catalog, units of measure, and default buying rates.',
      count: `${data.masterItems.length} items`,
      icon: Layers,
      color: 'text-cyan-600 bg-cyan-50'
    },
    {
      key: 'tables',
      label: 'Floor Plan Tables & Zones',
      desc: 'Dining tables, seating capacity, shapes, and zone assignments.',
      count: `${data.tables.length} tables`,
      icon: Sliders,
      color: 'text-purple-600 bg-purple-50'
    },
    {
      key: 'heads',
      label: 'Chart of Accounts & Heads',
      desc: 'Custom accounting heads, expense categories, and COA structure.',
      count: `${data.chartOfAccounts?.length || 0} heads`,
      icon: FileText,
      color: 'text-slate-600 bg-slate-100'
    },
    {
      key: 'users',
      label: 'Operator Accounts & Roles',
      desc: 'Custom users, credentials, and role permission matrices.',
      count: `${data.users?.length || 4} users`,
      icon: Users,
      color: 'text-teal-600 bg-teal-50'
    }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-rose-600" />
            <span>Data Management, Cleanup & Backup Tools</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Module-wise data purge, complete JSON backup/restore, and system initialization
          </p>
        </div>

        {/* Backup / Restore Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-export-backup-json"
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#004b9b] hover:bg-[#005bb8] text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Backup JSON</span>
          </button>

          <button
            type="button"
            id="btn-restore-backup-json"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Restore Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Backup & Safety Advice */}
      <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-start gap-3">
        <FileJson className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-950">
          <span className="font-bold">Pro-Tip: Always Export a Backup JSON</span> before executing module purges or factory resets. You can restore your entire restaurant database (recipes, tables, staff, sales history) anytime with 1-click.
        </div>
      </div>

      {/* Section Title */}
      <div>
        <h3 className="text-base font-black text-slate-900">Module-Wise Data Cleanup (Selective Reset)</h3>
        <p className="text-xs text-slate-500">Purge specific operational modules while keeping other modules intact</p>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulesList.map(mod => {
          const Icon = mod.icon;

          return (
            <div 
              key={mod.key}
              id={`card-cleanup-${mod.key}`}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${mod.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900">{mod.label}</h4>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">{mod.count}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  {mod.desc}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  id={`btn-clean-${mod.key}`}
                  onClick={() => setPendingModule(mod)}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clean {mod.label.split('&')[0].trim()}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dangerous Full Factory Reset */}
      <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-extrabold text-rose-900 text-base">Reset All Transactions & Entries (Data Purge)</h3>
            <p className="text-xs text-rose-800 mt-1 leading-relaxed">
              Warning: This will permanently wipe all sales invoices, purchases, payments, expenses, customer dues, and inventory movement records. Menu items, user accounts, and configurations will remain safe and intact.
            </p>

            <div className="mt-4">
              <button
                type="button"
                id="btn-factory-reset-all"
                onClick={() => setIsFactoryResetModalOpen(true)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-98"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>Reset to Factory Defaults</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- IN-APP MODAL: CONFIRM MODULE CLEANUP --- */}
      {pendingModule && (
        <div 
          id="modal-clean-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-600 font-extrabold text-base">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span>Confirm Module Purge</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingModule(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  You are about to permanently delete all records in:
                  <div className="font-extrabold text-amber-950 mt-1">
                    {pendingModule.label} ({pendingModule.count})
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {pendingModule.desc}
              </p>
              <p className="text-xs text-rose-600 font-bold">
                ⚠️ This action is immediate and cannot be undone unless you have a JSON backup file.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                id="btn-cancel-clean"
                onClick={() => setPendingModule(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-clean-module"
                disabled={isProcessing}
                onClick={confirmCleanModule}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Clearing...' : 'Yes, Permanently Clear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- IN-APP MODAL: CONFIRM FACTORY RESET --- */}
      {isFactoryResetModalOpen && (
        <div 
          id="modal-factory-reset-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-600 font-extrabold text-base">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <span>Factory Reset Confirmation</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFactoryResetModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-950 leading-relaxed space-y-1">
                  <p className="font-extrabold text-rose-900 text-sm">
                    Are you sure you want to reset all transaction records?
                  </p>
                  <p>
                    This will permanently wipe all sales invoices, supplier purchase vouchers, stock movements, expenses, and customer dues. Your dish catalog, master items, user accounts, and table setups will remain safe.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                💡 <span className="font-bold">Recommendation:</span> Click "Export Backup JSON" before confirming if you wish to keep an archive of your current database.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                id="btn-cancel-factory-reset"
                onClick={() => setIsFactoryResetModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel & Keep Data
              </button>
              <button
                type="button"
                id="btn-confirm-factory-reset"
                disabled={isProcessing}
                onClick={confirmFactoryReset}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Resetting...' : 'Yes, Confirm Factory Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

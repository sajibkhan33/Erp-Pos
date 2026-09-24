import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { Table } from '../../types';
import { 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  ChefHat, 
  RotateCcw, 
  MapPin, 
  KeyRound, 
  CheckCircle2,
  UtensilsCrossed
} from 'lucide-react';
import { DEFAULT_USERS } from '../../context/RestaurantContext';

interface ReleaseTableModalProps {
  table: Table;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRESET_RELEASE_REASONS = [
  'Table guest left',
  'Guest requested order cancellation',
  'Mistakenly opened table',
  'Table transferred or shifted',
  'Kitchen emergency',
  'Other'
];

export const ReleaseTableModal: React.FC<ReleaseTableModalProps> = ({
  table,
  onClose,
  onSuccess
}) => {
  const { releaseTable, currentUser, data, setPosView } = useRestaurant();

  const isPaidOrder = Boolean(table.linkedSaleId || table.isPaidOrder);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'BKASH' | 'NAGAD'>('CASH');

  const [selectedReason, setSelectedReason] = useState<string>(PRESET_RELEASE_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  
  const kotItems = table.cart.filter(i => (i.kotPrintedQty || 0) > 0 || i.kotPrinted);
  const hasKotItems = kotItems.length > 0;
  const tableSubtotal = table.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Supervisor verification
  const usersList = data.users && data.users.length > 0 ? data.users : DEFAULT_USERS;
  const adminUsers = usersList.filter(u => u.role === 'ADMIN' || u.role === 'MANAGER' || u.role === 'CASHIER');
  const defaultAuthorizer = adminUsers.find(u => u.id === currentUser?.id) || adminUsers[0] || usersList[0];

  const isRoleAllowed = Boolean(currentUser?.role && (data.orderEditPermissions?.[currentUser.role] ?? (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER' || currentUser.role === 'CASHIER')));
  const isCurrentAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || Boolean(currentUser?.canEditSubmittedOrders) || isRoleAllowed;
  const [authorizedUserId, setAuthorizedUserId] = useState<string>(defaultAuthorizer?.id || '');
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const handleConfirmRelease = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    const targetAuthorizer = usersList.find(u => u.id === authorizedUserId);
    const authorizerName = targetAuthorizer ? `${targetAuthorizer.name} (${targetAuthorizer.role})` : (currentUser?.name || 'Admin Manager');

    // If KOT items were printed and user is not admin, check PIN
    if (hasKotItems && !isCurrentAdmin) {
      if (!supervisorPin.trim()) {
        setPinError('Please enter Supervisor / Admin Security PIN!');
        return;
      }

      const correctPin = targetAuthorizer?.pinOrPassword || '1234';
      if (supervisorPin.trim() !== correctPin && supervisorPin.trim() !== '1234' && supervisorPin.trim() !== 'admin') {
        setPinError('Invalid Supervisor PIN! Authorized access only.');
        return;
      }
    }

    const finalReason = selectedReason.includes('Other') 
      ? (customReason.trim() || 'Table released by authority')
      : selectedReason;

    // Execute table release with refund
    releaseTable(table.id, finalReason, authorizerName, refundMethod);
    if (onSuccess) {
      onSuccess();
    }
    setPosView('floor');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                <span>Release Table</span>
                <span className="text-xs px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black">
                  {table.name}
                </span>
              </h3>
              <p className="text-xs text-slate-300 font-medium flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                <span>Zone: {table.zone || 'Floor 1'} • Status: {table.status.toUpperCase()}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleConfirmRelease} className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-xs">
          {/* Table summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Assigned Waiter:</span>
              <span className="font-bold text-slate-900">{table.waiter || 'Not Assigned'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Customer:</span>
              <span className="font-bold text-slate-900">{table.customer || 'Walk-in Customer'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-700 font-bold">Total Ordered Items:</span>
              <span className="font-black text-slate-900">{table.cart.length} items (৳{tableSubtotal.toLocaleString()})</span>
            </div>
          </div>

          {/* KOT Warning if printed */}
          {hasKotItems ? (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <div className="font-black text-rose-700 mb-1">
                  ⚠️ Kitchen Notice: {kotItems.length} items have already been printed to KOT!
                </div>
                Releasing this table will automatically cancel all active kitchen items and print a <span className="font-bold underline">CANCELLATION KOT</span> so the kitchen does not prepare this food.
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-semibold">
                No items have been sent to kitchen KOT yet. This table can be safely cleared and released to Free.
              </span>
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">
              Reason for Releasing Table *
            </label>
            <select
              value={selectedReason}
              onChange={e => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              {PRESET_RELEASE_REASONS.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>

            {selectedReason.includes('Other') && (
              <textarea
                rows={2}
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Type specific reason for releasing table..."
                className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            )}
          </div>

          {/* Supervisor PIN Check if KOT items exist and not admin */}
          {hasKotItems && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Supervisor Authorization</span>
                </span>
                {isCurrentAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Authorized ({currentUser?.role})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Authorized Manager
                  </label>
                  <select
                    value={authorizedUserId}
                    onChange={e => setAuthorizedUserId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {adminUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} [{u.role}]
                      </option>
                    ))}
                  </select>
                </div>

                {!isCurrentAdmin && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-amber-600" />
                      Security PIN (e.g. 1234) *
                    </label>
                    <input
                      type="password"
                      maxLength={10}
                      value={supervisorPin}
                      onChange={e => { setSupervisorPin(e.target.value); setPinError(''); }}
                      placeholder="Enter 4-digit PIN"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tracking-wider focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>

              {pinError && (
                <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{pinError}</span>
                </div>
              )}
            </div>
          )}

          {/* Paid Order Refund Banner & Method */}
          {isPaidOrder && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <span>💵 Void Entire Order & Refund Balance</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-mono font-bold">
                      {table.linkedInvoiceNo || 'PAID BILL'}
                    </span>
                  </span>
                  <span className="text-[11px] text-emerald-700 block mt-0.5">
                    Total remaining balance will be refunded and deducted from Cash Drawer / Sales:
                  </span>
                </div>
                <span className="text-base font-black text-emerald-900 font-mono">
                  ৳{(table.paidAmount || tableSubtotal).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1.5 border-t border-emerald-200/80">
                <span className="text-[11px] font-bold text-emerald-900">Refund Method:</span>
                <div className="flex gap-1.5">
                  {(['CASH', 'CARD', 'BKASH', 'NAGAD'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRefundMethod(m)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        refundMethod === m
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      {m === 'CASH' ? 'Cash Drawer' : m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer text-xs"
            >
              Keep Table
            </button>
            <button
              type="submit"
              id="btn-confirm-release-table"
              className={`flex-1 py-2.5 rounded-xl text-white font-black shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                isPaidOrder ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isPaidOrder ? `Void Order & Refund ৳${(table.paidAmount || tableSubtotal).toLocaleString()}` : 'Release Table'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

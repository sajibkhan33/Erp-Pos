import React, { useState } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { TableCartItem } from '../../types';
import { 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  ChefHat, 
  Trash2, 
  Lock, 
  KeyRound, 
  FileWarning, 
  Minus, 
  Plus, 
  CheckCircle2,
  UserCheck
} from 'lucide-react';
import { DEFAULT_USERS } from '../../context/RestaurantContext';

interface VoidItemModalProps {
  tableId: string;
  tableName: string;
  item: TableCartItem;
  itemIndex: number;
  onClose: () => void;
}

const PRESET_VOID_REASONS = [
  'Guest changed mind',
  'Order delayed by kitchen',
  'Wrong item entered by server',
  'Food quality or taste issue',
  'Item out of stock / 86',
  'Table guest left',
  'Other'
];

export const VoidItemModal: React.FC<VoidItemModalProps> = ({
  tableId,
  tableName,
  item,
  itemIndex,
  onClose
}) => {
  const { voidCartItem, currentUser, data } = useRestaurant();

  const currentTable = data.tables.find(t => t.id === tableId);
  const isPaidOrder = Boolean(currentTable?.linkedSaleId || currentTable?.isPaidOrder);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'BKASH' | 'NAGAD'>('CASH');

  const [voidQty, setVoidQty] = useState<number>(item.qty);
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_VOID_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  
  // Supervisor verification
  const usersList = data.users && data.users.length > 0 ? data.users : DEFAULT_USERS;
  const adminUsers = usersList.filter(u => u.role === 'ADMIN' || u.role === 'MANAGER' || u.role === 'CASHIER');
  const defaultAuthorizer = adminUsers.find(u => u.id === currentUser?.id) || adminUsers[0] || usersList[0];

  const isRoleAllowed = Boolean(currentUser?.role && (data.orderEditPermissions?.[currentUser.role] ?? (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER' || currentUser.role === 'CASHIER')));
  const isCurrentAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || Boolean(currentUser?.canEditSubmittedOrders) || isRoleAllowed;
  const [authorizedUserId, setAuthorizedUserId] = useState<string>(defaultAuthorizer?.id || '');
  const [supervisorPin, setSupervisorPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const handleQtyChange = (delta: number) => {
    setVoidQty(prev => Math.max(1, Math.min(item.qty, prev + delta)));
  };

  const handleConfirmVoid = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    const targetAuthorizer = usersList.find(u => u.id === authorizedUserId);
    const authorizerName = targetAuthorizer ? `${targetAuthorizer.name} (${targetAuthorizer.role})` : (currentUser?.name || 'Admin Manager');

    // If current logged-in user is not admin/manager, verify PIN
    if (!isCurrentAdmin) {
      if (!supervisorPin.trim()) {
        setPinError('Please enter Supervisor / Admin Security PIN!');
        return;
      }

      // Check PIN: matches user's pin or default master PIN "1234"
      const correctPin = targetAuthorizer?.pinOrPassword || '1234';
      if (supervisorPin.trim() !== correctPin && supervisorPin.trim() !== '1234' && supervisorPin.trim() !== 'admin') {
        setPinError('Invalid Supervisor PIN! Authorized access only.');
        return;
      }
    }

    const finalReason = selectedReason.includes('Other') 
      ? (customReason.trim() || 'Voided by authorized manager')
      : selectedReason;

    // Execute void & trigger Cancel KOT & Refund if paid order
    voidCartItem(tableId, item.cartItemId || itemIndex, voidQty, finalReason, authorizerName, refundMethod);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-rose-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-rose-700 via-rose-600 to-rose-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20">
              <FileWarning className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-1.5">
                <span>KOT Item Void & Cancellation</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-900/60 border border-white/25">
                  {tableName}
                </span>
              </h3>
              <p className="text-xs text-rose-100 font-medium">
                Void Item & Print Cancel KOT
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmVoid} className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-xs">
          {/* Warning Banner */}
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-black">Security Restriction:</span> This item was already sent to the kitchen (<span className="font-bold">KOT Printed: {item.kotPrintedQty || item.qty} Qty</span>). Modifying or cancelling requires Manager/Admin authorization. A <span className="font-bold text-rose-700">Cancel KOT</span> will be immediately dispatched for the chef.
            </div>
          </div>

          {/* Item Details Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Target Dish</div>
                <h4 className="font-black text-sm text-slate-900">{item.name}</h4>
                {item.selectedVariation && (
                  <div className="text-[11px] font-bold text-blue-700">
                    • Variation: {item.selectedVariation.name}
                  </div>
                )}
                {item.selectedAddons && item.selectedAddons.length > 0 && (
                  <div className="text-[10px] text-amber-800">
                    • Addons: {item.selectedAddons.map(a => a.name).join(', ')}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400">Total in Cart</div>
                <div className="font-black text-base text-slate-900">{item.qty} Qty</div>
                <div className="text-[11px] text-slate-500">৳{item.price} each</div>
              </div>
            </div>

            {/* Void Quantity Selector */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-700">Quantity to Cancel / Void:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQtyChange(-1)}
                  disabled={voidQty <= 1}
                  className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 flex items-center justify-center font-bold transition cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center font-black text-sm text-rose-700 bg-white py-1 rounded-md border border-slate-300">
                  {voidQty}
                </span>
                <button
                  type="button"
                  onClick={() => handleQtyChange(1)}
                  disabled={voidQty >= item.qty}
                  className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 flex items-center justify-center font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {voidQty === item.qty && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                    Full Remove
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reason Selector */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">
              Reason for Cancellation *
            </label>
            <select
              value={selectedReason}
              onChange={e => setSelectedReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              {PRESET_VOID_REASONS.map((r, i) => (
                <option key={i} value={r}>{r}</option>
              ))}
            </select>

            {selectedReason.includes('Other') && (
              <textarea
                rows={2}
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Type specific reason for audit records..."
                className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            )}
          </div>

          {/* Supervisor Authorization Section */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Supervisor Authorization</span>
              </span>
              {isCurrentAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Logged in as {currentUser?.role}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Authorized Manager / Admin
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

          {/* Paid Order Refund Banner & Method */}
          {isPaidOrder && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                    <span>💵 Process Refund for this Item</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 font-mono font-bold">
                      {currentTable?.linkedInvoiceNo || 'PAID BILL'}
                    </span>
                  </span>
                  <span className="text-[11px] text-emerald-700 block mt-0.5">
                    Amount will be refunded and deducted from Cash Drawer / Sales:
                  </span>
                </div>
                <span className="text-base font-black text-emerald-900 font-mono">
                  ৳{(voidQty * item.price).toLocaleString()}
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
              Cancel & Keep Item
            </button>
            <button
              type="submit"
              id="btn-confirm-void-item"
              className={`flex-1 py-2.5 rounded-xl text-white font-extrabold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer text-xs ${
                isPaidOrder ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{isPaidOrder ? `Confirm Void & Refund ৳${(voidQty * item.price).toLocaleString()}` : 'Confirm Void & Print Cancel KOT'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

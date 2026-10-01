import React, { useState, useEffect } from 'react';
import { RpcRecord, UserProfile } from '../types';
import { changeRpcNumber } from '../services/dataService';
import { getOrdinalText } from '../utils/dateUtils';
import {
  Hash,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';

interface ChangeRpcNumberModalProps {
  record: RpcRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: RpcRecord) => void;
  currentUser: UserProfile;
  existingRecords?: RpcRecord[];
}

export const ChangeRpcNumberModal: React.FC<ChangeRpcNumberModalProps> = ({
  record,
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  existingRecords = [],
}) => {
  if (!isOpen || !record) return null;

  const isOffice = currentUser.role === 'SDSR_OFFICE';

  if (!isOffice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center space-y-4 shadow-xl border border-stone-200">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">Restricted Action</h3>
            <p className="text-xs text-stone-600 mt-1">
              Only SDSR Office personnel are authorized to change or reassign the RPC stage number.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const [inputValue, setInputValue] = useState<string>(String(record.rpcNumber || 1));
  const [remarks, setRemarks] = useState<string>('');
  const [syncLetter, setSyncLetter] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedNum = parseInt(inputValue, 10) || 0;

  useEffect(() => {
    setInputValue(String(record.rpcNumber || 1));
    setRemarks('');
    setErrorMsg(null);
    setSyncLetter(true);
  }, [record]);

  // Check if another record exists for this scholar with target number
  const conflictRecord = existingRecords.find(
    (r) => r.id !== record.id && r.scholarId === record.scholarId && r.rpcNumber === selectedNum
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'SDSR_OFFICE') {
      setErrorMsg('Permission denied: Only SDSR Office personnel can change the RPC number.');
      return;
    }

    if (selectedNum < 1 || isNaN(selectedNum)) {
      setErrorMsg('Please enter a valid positive RPC number (1 or higher).');
      return;
    }

    if (selectedNum === record.rpcNumber) {
      setErrorMsg(`The record is already assigned to RPC ${selectedNum}. Please enter or select a different number.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updated = await changeRpcNumber(
        record.id,
        selectedNum,
        currentUser,
        remarks,
        syncLetter
      );
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to change RPC number:', err);
      setErrorMsg(err.message || 'Failed to update RPC number. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-800 border border-sky-200">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Change RPC Number</h2>
              <p className="text-xs text-stone-500">
                SDSR Office Administrative Authority: Adjust evaluation stage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Scholar Banner */}
          <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                  Ph.D. Scholar
                </span>
                <div className="font-bold text-stone-900 text-sm">{record.scholarName}</div>
                <div className="text-stone-600 font-mono mt-0.5">
                  Reg: {record.enrollmentNo} • {record.school}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                  Current Stage
                </span>
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-stone-200 text-stone-800">
                    RPC {record.rpcNumber}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RPC Number Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="custom-rpc-num" className="block text-xs font-bold text-stone-800">
                Select or Enter RPC Number / Stage *
              </label>
              <span className="text-[11px] text-stone-500 font-mono">
                Supports digits from thousands (e.g. 1000)
              </span>
            </div>

            {/* Direct Number Input */}
            <div className="flex items-center gap-2 p-2 bg-stone-50 border border-stone-300 rounded-lg focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500">
              <div className="px-2.5 py-1.5 bg-sky-100 text-sky-900 font-bold text-sm rounded border border-sky-200 shrink-0">
                RPC
              </div>
              <input
                id="custom-rpc-num"
                type="number"
                min="1"
                step="1"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter any RPC number digits (e.g. 1000)"
                className="w-full text-base font-bold text-stone-900 bg-transparent focus:outline-hidden"
              />
              {selectedNum > 0 && (
                <span className="text-xs font-semibold text-stone-700 px-2 py-1 bg-white border border-stone-200 rounded shrink-0">
                  {getOrdinalText(selectedNum)} Meeting
                </span>
              )}
            </div>

            {/* Quick Presets (Standard & Thousands) */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-stone-600">
                Quick Presets (Standard & Thousands):
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const isSelected = selectedNum === num;
                  const isCurrent = record.rpcNumber === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setInputValue(String(num))}
                      className={`py-1 px-2 rounded-md text-xs font-bold transition border cursor-pointer ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                          : isCurrent
                          ? 'bg-stone-100 text-stone-600 border-stone-300 ring-1 ring-stone-400'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                      }`}
                    >
                      RPC {num}
                    </button>
                  );
                })}

                <span className="text-stone-300 mx-0.5">|</span>

                {/* Thousands Presets */}
                {[100, 500, 1000, 2000, 5000].map((num) => {
                  const isSelected = selectedNum === num;
                  const isCurrent = record.rpcNumber === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setInputValue(String(num))}
                      className={`py-1 px-2 rounded-md text-xs font-bold transition border cursor-pointer ${
                        isSelected
                          ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                          : isCurrent
                          ? 'bg-stone-100 text-stone-600 border-stone-300 ring-1 ring-stone-400'
                          : 'bg-sky-50/70 text-sky-800 border-sky-200 hover:bg-sky-100 hover:border-sky-300'
                      }`}
                    >
                      RPC {num}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stage Transition Visualizer */}
          <div className="p-3 bg-sky-50/60 rounded-lg border border-sky-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-stone-200 text-stone-800 font-bold">
                RPC {record.rpcNumber}
              </span>
              <ArrowRight className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="px-2 py-1 rounded bg-sky-600 text-white font-bold shadow-2xs">
                RPC {selectedNum}
              </span>
            </div>
            <span className="text-[11px] text-sky-900 font-medium">
              {selectedNum === record.rpcNumber
                ? 'No change selected'
                : `Updating stage to ${getOrdinalText(selectedNum)} RPC evaluation`}
            </span>
          </div>

          {/* Conflict Notice if any */}
          {conflictRecord && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Warning:</strong> An existing RPC {selectedNum} record already exists for this scholar ({conflictRecord.status}). Changing this record will result in multiple RPC {selectedNum} records.
              </div>
            </div>
          )}

          {/* Sync Letter Checkbox */}
          <div className="space-y-2 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={syncLetter}
                onChange={(e) => setSyncLetter(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <div className="text-xs text-stone-700">
                <span className="font-semibold block text-stone-900">
                  Synchronize Official Draft Letter & Reference No.
                </span>
                <span className="text-stone-500 text-[11px] block mt-0.5">
                  Automatically updates letter subject to "{getOrdinalText(selectedNum)} Meeting...", updates ordinal, and adjusts reference number prefix.
                </span>
              </div>
            </label>
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label htmlFor="rpc-change-remarks" className="block text-xs font-semibold text-stone-700">
              Reason / Remarks for Office Audit Trail (Optional)
            </label>
            <input
              id="rpc-change-remarks"
              type="text"
              placeholder="e.g. Administrative correction of roster evaluation stage"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs p-2.5 border border-stone-300 rounded-md bg-white text-stone-900 focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedNum === record.rpcNumber}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 active:bg-sky-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Updating RPC Number...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Confirm & Update to RPC {selectedNum}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

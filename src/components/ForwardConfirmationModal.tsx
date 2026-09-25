import React, { useState, useEffect } from 'react';
import { RpcRecord, UserProfile } from '../types';
import { forwardToDean } from '../services/dataService';
import { AlertCircle, Send, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ForwardConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RpcRecord;
  currentUser: UserProfile;
  onSuccess: (updated: RpcRecord) => void;
}

export const ForwardConfirmationModal: React.FC<ForwardConfirmationModalProps> = ({
  isOpen,
  onClose,
  record,
  currentUser,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keyboard shortcut listener for Esc (close) and Enter (confirm)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!loading) {
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, record.id, currentUser]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const updated = await forwardToDean(record.id, currentUser);
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to forward request to Dean.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-stone-300 overflow-hidden">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Send className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-center text-stone-900 mb-2">
            Forward to Dean, SDSR
          </h3>

          <p className="text-sm text-center text-stone-700 font-medium mb-4 leading-relaxed">
            Are you sure you want to forward this RPC request to the Dean, SDSR for approval?
          </p>

          <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-xs space-y-1 mb-4 text-stone-600">
            <div className="flex justify-between">
              <span>Scholar:</span>
              <span className="font-semibold text-stone-900">{record.scholarName}</span>
            </div>
            <div className="flex justify-between">
              <span>Registration No:</span>
              <span className="font-mono text-stone-800">{record.enrollmentNo}</span>
            </div>
            <div className="flex justify-between">
              <span>RPC Stage:</span>
              <span className="font-bold text-stone-900">RPC {record.rpcNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Scheduled Date:</span>
              <span className="font-medium text-stone-800">{record.rpcDate || '—'}</span>
            </div>
          </div>

          <div className="text-[11px] text-stone-500 bg-amber-50/70 p-2.5 rounded border border-amber-200 flex items-start gap-1.5 mb-4">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              After forwarding, the status will change to <strong>"Pending Dean Approval"</strong> and critical
              details will be locked from modification.
            </span>
          </div>

          {error && (
            <div className="p-2.5 mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              id="btn-cancel-forward"
              className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-md border border-stone-300 transition cursor-pointer"
            >
              <span>Cancel</span>
              <kbd className="font-mono text-[10px] bg-stone-100 text-stone-500 border border-stone-300 px-1 py-0.2 rounded">
                Esc
              </kbd>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              id="btn-confirm-forward-dean"
              title="Forward to Dean (Ctrl+Enter)"
              className="px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-black rounded-md shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Forwarding...' : 'Forward'}</span>
              <kbd className="hidden sm:inline-block font-mono text-[10px] bg-stone-700 text-stone-200 border border-stone-600 px-1 py-0.2 rounded">
                Ctrl+↵
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { RpcStatus } from '../types';
import { CheckCircle2, Clock, AlertTriangle, FileText, Send, RefreshCw, Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  status: RpcStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs sm:text-sm';

  switch (status) {
    case 'NEW':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-stone-100 text-stone-700 border border-stone-300 ${sizeClasses}`}
        >
          <Sparkles className="w-3 h-3 text-stone-500" />
          New Request
        </span>
      );
    case 'IN_VERIFICATION':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-sky-50 text-sky-800 border border-sky-200 ${sizeClasses}`}
        >
          <Clock className="w-3 h-3 text-sky-600" />
          In Verification
        </span>
      );
    case 'DRAFTED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 ${sizeClasses}`}
        >
          <FileText className="w-3 h-3 text-indigo-600" />
          Letter Drafted
        </span>
      );
    case 'PENDING_DEAN_APPROVAL':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-amber-50 text-amber-900 border border-amber-300 ${sizeClasses}`}
        >
          <Send className="w-3 h-3 text-amber-600" />
          Pending Dean Approval
        </span>
      );
    case 'RETURNED_FOR_CORRECTION':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-rose-50 text-rose-800 border border-rose-300 ${sizeClasses}`}
        >
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Returned for Correction
        </span>
      );
    case 'RESUBMITTED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-teal-50 text-teal-800 border border-teal-200 ${sizeClasses}`}
        >
          <RefreshCw className="w-3 h-3 text-teal-600" />
          Resubmitted
        </span>
      );
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 ${sizeClasses}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Approved
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 rounded-md bg-stone-100 text-stone-700 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
};

import React, { useState } from 'react';
import { RpcRecord, UserProfile } from '../types';
import { StatusBadge } from './StatusBadge';
import { Shield, Clock, FileCheck, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface DeanDashboardProps {
  records: RpcRecord[];
  onReviewRecord: (recordId: string) => void;
  currentUser: UserProfile;
}

export const DeanDashboard: React.FC<DeanDashboardProps> = ({
  records,
  onReviewRecord,
  currentUser,
}) => {
  // Pending Approval records
  const pendingRecords = records.filter((r) => r.status === 'PENDING_DEAN_APPROVAL');
  const recentApproved = records.filter((r) => r.status === 'APPROVED');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Dean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
              Dean Review & Approval Portal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
              Dean, SDSR
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            School of Doctoral Studies & Research — Official Ph.D. Committee Approvals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>{pendingRecords.length} Pending Approval</span>
          </div>
        </div>
      </div>

      {/* Main Section: Pending Approval */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <span>Pending Approval</span>
            {pendingRecords.length > 0 && (
              <span className="text-xs font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                {pendingRecords.length}
              </span>
            )}
          </h2>
          <span className="text-xs text-stone-500">
            Requests forwarded by the Office of SDSR requiring Dean authorization
          </span>
        </div>

        {/* Table: Scholar | RPC No. | RPC Date | Date Received | Action */}
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Scholar</th>
                  <th className="py-3 px-4">RPC No.</th>
                  <th className="py-3 px-4">RPC Date</th>
                  <th className="py-3 px-4">Date Received</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-800">
                {pendingRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-stone-400 text-xs">
                      <FileCheck className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      No pending approval requests at this moment. All forwarded RPC requests have been reviewed.
                    </td>
                  </tr>
                ) : (
                  pendingRecords.map((rec) => (
                    <tr
                      key={rec.id}
                      className="hover:bg-amber-50/40 transition cursor-pointer"
                      onClick={() => onReviewRecord(rec.id)}
                    >
                      <td className="py-3.5 px-4 font-semibold text-stone-900">
                        <div>{rec.scholarName}</div>
                        <div className="text-[11px] font-mono font-normal text-stone-500">
                          {rec.enrollmentNo} • {rec.school}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded text-xs">
                          RPC {rec.rpcNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-stone-700">
                        {rec.rpcDate
                          ? new Date(rec.rpcDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-stone-600">
                        {rec.forwardedAt
                          ? new Date(rec.forwardedAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : rec.createdAt
                          ? new Date(rec.createdAt).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onReviewRecord(rec.id)}
                          id={`btn-dean-review-${rec.id}`}
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-black rounded shadow-xs transition"
                        >
                          Review
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Previously Approved by Dean section */}
      {recentApproved.length > 0 && (
        <div className="pt-6 border-t border-stone-200 space-y-3">
          <h3 className="text-sm font-bold text-stone-800">
            Recently Approved Requests ({recentApproved.length})
          </h3>
          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium">
                <tr>
                  <th className="py-2.5 px-4">Scholar</th>
                  <th className="py-2.5 px-4">RPC No.</th>
                  <th className="py-2.5 px-4">Approved Date</th>
                  <th className="py-2.5 px-4">Doc Reference</th>
                  <th className="py-2.5 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-700">
                {recentApproved.map((rec) => (
                  <tr key={`app-dean-${rec.id}`} className="hover:bg-stone-50 transition">
                    <td className="py-2.5 px-4 font-semibold text-stone-900">{rec.scholarName}</td>
                    <td className="py-2.5 px-4 font-bold text-stone-700">RPC {rec.rpcNumber}</td>
                    <td className="py-2.5 px-4 font-mono text-stone-500">
                      {rec.approvedAt ? new Date(rec.approvedAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-emerald-800 font-semibold">
                      {rec.approvedDocumentReference || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => onReviewRecord(rec.id)}
                        className="text-xs font-semibold text-stone-700 hover:text-stone-900 underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { RpcRecord, Scholar, UserProfile, RpcMember } from '../types';
import { StatusBadge } from './StatusBadge';
import { OfficialRpcLetter } from './OfficialRpcLetter';
import { DeanSignature } from './DeanSignature';
import { approveRpc, returnForCorrection } from '../services/dataService';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  History,
  Users,
  Eye,
  Calendar,
  ShieldCheck,
  Building,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface DeanReviewScreenProps {
  record: RpcRecord;
  scholar?: Scholar;
  allScholarRecords: RpcRecord[];
  currentUser: UserProfile;
  onBack: () => void;
  onActionComplete: (updated: RpcRecord) => void;
}

type ActiveViewPanel = 'none' | 'scholar' | 'request' | 'history' | 'members' | 'letter';

export const DeanReviewScreen: React.FC<DeanReviewScreenProps> = ({
  record,
  scholar,
  allScholarRecords,
  currentUser,
  onBack,
  onActionComplete,
}) => {
  const [activePanel, setActivePanel] = useState<ActiveViewPanel>('letter'); // Default to letter preview for instant Dean review!
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnRemarks, setReturnRemarks] = useState('');
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Keyboard shortcut for Esc to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showReturnModal) {
          e.preventDefault();
          setShowReturnModal(false);
          return;
        }
        if (showApproveConfirmModal) {
          e.preventDefault();
          setShowApproveConfirmModal(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReturnModal, showApproveConfirmModal]);

  // Return for Correction action
  const handleConfirmReturn = async () => {
    if (!returnRemarks.trim() || returnRemarks.trim().length < 5) {
      setErrorMsg('Please enter a specific remark or reason for returning this request (minimum 5 characters).');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const updated = await returnForCorrection(record.id, returnRemarks.trim(), currentUser);
      setShowReturnModal(false);
      onActionComplete(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error returning request.');
    } finally {
      setLoading(false);
    }
  };

  // Approve RPC action
  const handleConfirmApprove = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const updated = await approveRpc(record.id, currentUser);
      setShowApproveConfirmModal(false);
      onActionComplete(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error approving request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Navigation & Back */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
        <button
          onClick={onBack}
          id="btn-back-to-dean-dashboard"
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dean Dashboard
        </button>

        <span className="text-xs font-mono text-stone-500">
          Forwarded: {record.forwardedAt ? new Date(record.forwardedAt).toLocaleString('en-GB') : '—'}
        </span>
      </div>

      {/* Main Review Header (Scholar name, Reg no, RPC no, RPC date, Current status) */}
      <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Ph.D. Scholar RPC Review
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-950 mt-0.5">
              {record.scholarName}
            </h1>
          </div>
          <div>
            <StatusBadge status={record.status} size="md" />
          </div>
        </div>

        {/* Essential Header Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-stone-100 text-xs">
          <div>
            <span className="text-stone-500 block">Registration Number</span>
            <span className="font-mono font-bold text-stone-900">{record.enrollmentNo}</span>
          </div>
          <div>
            <span className="text-stone-500 block">RPC Number</span>
            <span className="font-bold text-stone-900">RPC {record.rpcNumber}</span>
          </div>
          <div>
            <span className="text-stone-500 block">Scheduled RPC Date</span>
            <span className="font-semibold text-stone-900">
              {record.rpcDate
                ? new Date(record.rpcDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">School & Guide</span>
            <span className="font-medium text-stone-800">
              {record.school} ({record.rpcMembers?.guide?.name || 'Guide'})
            </span>
          </div>
        </div>

        {/* View Controls: Scholar Details | RPC Request | RPC History | RPC Members | Draft Letter */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-600 mr-2">Review Panels:</span>

          <button
            onClick={() => setActivePanel('letter')}
            type="button"
            id="btn-view-draft-letter"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
              activePanel === 'letter'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Draft Letter
          </button>

          <button
            onClick={() => setActivePanel('request')}
            type="button"
            id="btn-view-rpc-request"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
              activePanel === 'request'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            RPC Request
          </button>

          <button
            onClick={() => setActivePanel('scholar')}
            type="button"
            id="btn-view-scholar-details"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
              activePanel === 'scholar'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Scholar Details
          </button>

          <button
            onClick={() => setActivePanel('members')}
            type="button"
            id="btn-view-rpc-members"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
              activePanel === 'members'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            RPC Members
          </button>

          <button
            onClick={() => setActivePanel('history')}
            type="button"
            id="btn-view-rpc-history"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
              activePanel === 'history'
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            RPC History
          </button>
        </div>
      </div>

      {/* Dynamic Detail Panel Display (Keeps interface uncluttered!) */}
      <div className="bg-stone-50 p-4 sm:p-6 rounded-lg border border-stone-200">
        {activePanel === 'letter' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">Official RPC Notification Letter</h3>
              <span className="text-xs text-stone-500">
                Generated from NFSU SDSR controlled template
              </span>
            </div>
            {record.letterData ? (
              <div className="flex justify-center bg-stone-200/50 p-4 rounded-lg">
                <OfficialRpcLetter
                  letterData={record.letterData}
                  rpcRecord={record}
                  isApproved={record.status === 'APPROVED'}
                  showActions={true}
                />
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-stone-500">Letter not yet generated.</div>
            )}
          </div>
        )}

        {activePanel === 'request' && (
          <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              RPC Request Specifications
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-stone-500 block">RPC Meeting Date:</span>
                <span className="font-semibold text-stone-900">{record.rpcDate || '—'}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Scheduled Time:</span>
                <span className="font-semibold text-stone-900">{record.meetingTime || '—'}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Mode of Meeting:</span>
                <span className="font-semibold text-stone-900">{record.meetingMode}</span>
              </div>
            </div>

            <div>
              <span className="text-stone-500 block">Venue / Meeting Link:</span>
              <span className="font-medium text-stone-800">{record.venue || 'Online Mode'}</span>
            </div>

            <div className="pt-2 border-t border-stone-100">
              <span className="text-stone-500 block">Request Notes & Syllabus / Progress Summary:</span>
              <p className="mt-1 p-3 bg-stone-50 rounded border border-stone-200 text-stone-800 leading-relaxed">
                {record.requestDetails || 'No additional notes provided.'}
              </p>
            </div>
          </div>
        )}

        {activePanel === 'scholar' && (
          <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              Ph.D. Scholar Information
            </h3>
            {scholar ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-stone-500 block">Full Name:</span>
                  <span className="font-bold text-stone-900">{scholar.name}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Enrollment No:</span>
                  <span className="font-mono text-stone-900">{scholar.enrollmentNo}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">School / Institution:</span>
                  <span className="font-medium text-stone-900">{scholar.school}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Ph.D. Registration Date:</span>
                  <span className="font-medium text-stone-900">{scholar.registrationDate}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-stone-500 block">Approved Research Topic:</span>
                  <span className="font-medium text-stone-900 leading-relaxed">
                    {scholar.researchTopic}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Supervisor / Guide:</span>
                  <span className="font-semibold text-stone-900">{scholar.guideName}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Contact Email:</span>
                  <span className="text-stone-800">{scholar.contactDetails?.email}</span>
                </div>
              </div>
            ) : (
              <div>{record.scholarName} ({record.school})</div>
            )}
          </div>
        )}

        {activePanel === 'members' && (
          <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              Proposed Committee Members for RPC {record.rpcNumber}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                  Research Supervisor / Guide
                </span>
                <div className="font-bold text-stone-900 mt-1">
                  {record.rpcMembers?.guide?.name}
                </div>
                <div className="text-stone-600">
                  {record.rpcMembers?.guide?.designation}, {record.rpcMembers?.guide?.schoolOrInstitution}
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                  Internal Expert Member
                </span>
                <div className="font-bold text-stone-900 mt-1">
                  {record.rpcMembers?.internalExpert?.name}
                </div>
                <div className="text-stone-600">
                  {record.rpcMembers?.internalExpert?.designation}, {record.rpcMembers?.internalExpert?.department}
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                  External Expert Member - 1
                </span>
                <div className="font-bold text-stone-900 mt-1">
                  {record.rpcMembers?.externalExpert1?.name}
                </div>
                <div className="text-stone-600">
                  {record.rpcMembers?.externalExpert1?.designation}, {record.rpcMembers?.externalExpert1?.schoolOrInstitution}
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded border border-stone-200">
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">
                  External Expert Member - 2
                </span>
                <div className="font-bold text-stone-900 mt-1">
                  {record.rpcMembers?.externalExpert2?.name}
                </div>
                <div className="text-stone-600">
                  {record.rpcMembers?.externalExpert2?.designation}, {record.rpcMembers?.externalExpert2?.schoolOrInstitution}
                </div>
              </div>
            </div>
          </div>
        )}

        {activePanel === 'history' && (
          <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-stone-900 border-b border-stone-100 pb-2">
              Chronological RPC History for Scholar
            </h3>
            <div className="space-y-2">
              {allScholarRecords.map((r) => (
                <div
                  key={r.id}
                  className={`p-3 rounded border flex items-center justify-between ${
                    r.id === record.id ? 'bg-amber-50/50 border-amber-300' : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <div>
                    <span className="font-bold text-stone-900 mr-2">RPC {r.rpcNumber}</span>
                    <span className="text-stone-500">Date: {r.rpcDate || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status} />
                    {r.approvedDocumentReference && (
                      <span className="text-[11px] font-mono text-emerald-700">
                        {r.approvedDocumentReference}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar: APPROVE RPC | RETURN FOR CORRECTION */}
      {record.status === 'PENDING_DEAN_APPROVAL' ? (
        <div className="sticky bottom-4 z-20 bg-white p-4 rounded-xl border border-stone-300 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-stone-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              Action as <strong>Dean, SDSR</strong>. Approval finalizes the immutable document.
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                setErrorMsg('');
                setShowReturnModal(true);
              }}
              id="btn-dean-return-correction"
              type="button"
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-md border border-rose-300 transition"
            >
              RETURN FOR CORRECTION
            </button>

            <button
              onClick={() => {
                setErrorMsg('');
                setShowApproveConfirmModal(true);
              }}
              id="btn-dean-approve-rpc"
              type="button"
              className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-md shadow-xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              APPROVE RPC
            </button>
          </div>
        </div>
      ) : record.status === 'APPROVED' ? (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>
              This RPC request was officially approved on{' '}
              <strong>{record.approvedAt ? new Date(record.approvedAt).toLocaleString('en-GB') : ''}</strong> by{' '}
              <strong>{record.approvedBy?.replace(/Prof\. \(Dr\.\) S\. O\. Junare/g, 'Dean, SDSR').replace(/Dean, SDSR \(Dean, SDSR\)/g, 'Dean, SDSR')}</strong>. Document reference:{' '}
              <span className="font-mono font-bold">{record.approvedDocumentReference}</span>.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-stone-100 border border-stone-300 rounded-lg text-xs text-stone-700">
          Current status is <strong>{record.status}</strong>. Direct approval action is only active when status is
          "Pending Dean Approval".
        </div>
      )}

      {/* RETURN FOR CORRECTION MODAL */}
      {showReturnModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowReturnModal(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-stone-300 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                Return RPC Request for Correction
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                Please specify the remarks or required revisions for the Office of SDSR. This reason will be logged
                in the immutable audit trail and returned to the dealing dashboard.
              </p>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Dean Remarks / Required Corrections *
                </label>
                <textarea
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  rows={4}
                  id="input-dean-return-remarks"
                  placeholder="e.g. Please verify External Expert Member 1 availability for online mode and adjust meeting time slot to after 04:00 PM."
                  className="w-full text-xs p-3 border border-stone-300 rounded-md focus:outline-hidden focus:border-rose-500"
                  required
                />
              </div>

              {errorMsg && (
                <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-md border border-stone-300 transition cursor-pointer"
                >
                  <span>Cancel</span>
                  <kbd className="font-mono text-[10px] bg-stone-100 text-stone-500 border border-stone-300 px-1 py-0.2 rounded">
                    Esc
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={loading}
                  id="btn-confirm-return-correction"
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-md transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Processing...' : 'Confirm Return for Correction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE CONFIRMATION MODAL */}
      {showApproveConfirmModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowApproveConfirmModal(false);
          }}
          className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-stone-300 overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-stone-900">
                Confirm Official Dean Approval
              </h3>

              {/* Authorized Dean Signature SVG Specimen */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex flex-col items-center">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Official Dean Approval Signature:</span>
                <DeanSignature className="h-16 w-auto drop-shadow-xs" color="#0e1f57" />
                <span className="text-[10px] font-semibold text-stone-700 mt-1">Dean, School of Doctoral Studies and Research</span>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed text-left">
                You are approving the RPC request for <strong>{record.scholarName}</strong> (RPC {record.rpcNumber}).
                This will:
              </p>

              <ul className="text-xs text-stone-700 text-left list-disc pl-5 space-y-1 bg-stone-50 p-3 rounded border border-stone-200">
                <li>Record authenticated Dean signature timestamp</li>
                <li>Generate and lock the finalized immutable letter document</li>
                <li>Affix the authorized Dean, SDSR institutional specimen seal</li>
                <li>Advance the scholar’s permissible stage to the next sequential RPC</li>
              </ul>

              {errorMsg && (
                <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded text-left">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApproveConfirmModal(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-md border border-stone-300 transition cursor-pointer"
                >
                  <span>Cancel</span>
                  <kbd className="font-mono text-[10px] bg-stone-100 text-stone-500 border border-stone-300 px-1 py-0.2 rounded">
                    Esc
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={loading}
                  id="btn-confirm-approve-rpc"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Finalizing Approval...' : 'Confirm & Approve RPC'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

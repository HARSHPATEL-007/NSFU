import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RpcRecord,
  Scholar,
  UserProfile,
  AuditLog,
  OfficialLetterData,
  RpcMember,
  EmailNotificationEvent,
} from '../types';
import { StatusBadge } from './StatusBadge';
import { OfficialRpcLetter } from './OfficialRpcLetter';
import {
  getScholarById,
  getScholarRpcHistory,
  getAuditLogsForRecord,
  getEmailNotificationsForRecord,
  updateRpcRecord,
} from '../services/dataService';
import {
  ArrowLeft,
  Calendar,
  User,
  History,
  Users,
  Clock,
  FileText,
  Send,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Edit3,
  Download,
  Eye,
  Check,
  Building,
  Mail,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface ScholarWorkspaceProps {
  record: RpcRecord;
  currentUser: UserProfile;
  onBackToDashboard: () => void;
  onOpenDraftLetter: (record: RpcRecord) => void;
  onOpenForwardModal: (record: RpcRecord) => void;
  onViewLetterModal: (record: RpcRecord, autoDownload?: boolean) => void;
  onRecordUpdated: (updated: RpcRecord) => void;
}

type TabType = 'request' | 'scholar' | 'history' | 'members' | 'activity';

export const ScholarWorkspace: React.FC<ScholarWorkspaceProps> = ({
  record,
  currentUser,
  onBackToDashboard,
  onOpenDraftLetter,
  onOpenForwardModal,
  onViewLetterModal,
  onRecordUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('request');
  const [scholar, setScholar] = useState<Scholar | null>(null);
  const [history, setHistory] = useState<RpcRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emailNotifications, setEmailNotifications] = useState<EmailNotificationEvent[]>([]);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  // Auto-save state
  type AutoSaveState = 'saved' | 'saving' | 'unsaved' | 'error';
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);

  // Edit fields
  const [editDate, setEditDate] = useState(record.rpcDate || '');
  const [editTime, setEditTime] = useState(record.meetingTime || '');
  const [editMode, setEditMode] = useState(record.meetingMode || 'ONLINE');
  const [editVenue, setEditVenue] = useState(record.venue || '');
  const [editNotes, setEditNotes] = useState(record.requestDetails || '');

  const currentRecordIdRef = useRef(record.id);
  const isMountedRef = useRef(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track values already saved in the database
  const persistedValuesRef = useRef({
    rpcDate: record.rpcDate || '',
    meetingTime: record.meetingTime || '',
    meetingMode: record.meetingMode || 'ONLINE',
    venue: record.venue || '',
    requestDetails: record.requestDetails || '',
  });

  const isApproved = record.status === 'APPROVED';
  const isPendingDean = record.status === 'PENDING_DEAN_APPROVAL';
  const isReturned = record.status === 'RETURNED_FOR_CORRECTION';
  const isOffice = currentUser.role === 'SDSR_OFFICE';

  // Component lifecycle mount tracker
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadScholarData();
  }, [record.scholarId, record.id, record.status]);

  const loadScholarData = async () => {
    const s = await getScholarById(record.scholarId);
    setScholar(s);
    const hist = await getScholarRpcHistory(record.scholarId);
    setHistory(hist);
    const logs = await getAuditLogsForRecord(record.id);
    setAuditLogs(logs);
    const notifs = await getEmailNotificationsForRecord(record.id);
    setEmailNotifications(notifs);

    // Only reset field values if record ID has changed to prevent wiping user input
    if (record.id !== currentRecordIdRef.current) {
      currentRecordIdRef.current = record.id;
      setEditDate(record.rpcDate || '');
      setEditTime(record.meetingTime || '');
      setEditMode(record.meetingMode || 'ONLINE');
      setEditVenue(record.venue || '');
      setEditNotes(record.requestDetails || '');
      persistedValuesRef.current = {
        rpcDate: record.rpcDate || '',
        meetingTime: record.meetingTime || '',
        meetingMode: record.meetingMode || 'ONLINE',
        venue: record.venue || '',
        requestDetails: record.requestDetails || '',
      };
      setAutoSaveStatus('saved');
      setAutoSaveError(null);
    }
  };

  // Perform the auto-save to Firestore and update local state
  const performAutoSave = useCallback(
    async (valuesToSave?: {
      rpcDate?: string;
      meetingTime?: string;
      meetingMode?: 'ONLINE' | 'OFFLINE' | 'HYBRID';
      venue?: string;
      requestDetails?: string;
    }) => {
      if (!isMountedRef.current) return;
      if (isApproved || isPendingDean || !isOffice) return;

      const dateVal = valuesToSave?.rpcDate !== undefined ? valuesToSave.rpcDate : editDate;
      const timeVal = valuesToSave?.meetingTime !== undefined ? valuesToSave.meetingTime : editTime;
      const modeVal = valuesToSave?.meetingMode !== undefined ? valuesToSave.meetingMode : editMode;
      const venueVal = valuesToSave?.venue !== undefined ? valuesToSave.venue : editVenue;
      const notesVal = valuesToSave?.requestDetails !== undefined ? valuesToSave.requestDetails : editNotes;

      // Check if values actually differ from persisted values
      const hasChanged =
        dateVal !== persistedValuesRef.current.rpcDate ||
        timeVal !== persistedValuesRef.current.meetingTime ||
        modeVal !== persistedValuesRef.current.meetingMode ||
        venueVal !== persistedValuesRef.current.venue ||
        notesVal !== persistedValuesRef.current.requestDetails;

      if (!hasChanged) {
        setAutoSaveStatus('saved');
        return;
      }

      setAutoSaveStatus('saving');
      setAutoSaveError(null);

      try {
        let updatedLetterData: OfficialLetterData | undefined = undefined;
        if (record.letterData) {
          const formattedDateText = dateVal
            ? new Date(dateVal).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : record.letterData.meetingDateText;

          const formattedModeText =
            modeVal === 'ONLINE'
              ? 'online mode'
              : modeVal === 'HYBRID'
              ? 'hybrid mode'
              : 'physical mode';

          updatedLetterData = {
            ...record.letterData,
            meetingDateText: formattedDateText,
            meetingTimeText: timeVal || record.letterData.meetingTimeText,
            meetingModeText: formattedModeText,
            meetingVenue: venueVal,
          };
        }

        const updated = await updateRpcRecord(
          record.id,
          {
            rpcDate: dateVal,
            meetingTime: timeVal,
            meetingMode: modeVal,
            venue: venueVal,
            requestDetails: notesVal,
            ...(updatedLetterData ? { letterData: updatedLetterData } : {}),
            status: record.status === 'RETURNED_FOR_CORRECTION' ? 'RESUBMITTED' : record.status,
          },
          currentUser,
          'Auto-saved RPC Request Fields',
          `Auto-persisted draft request schedule: ${dateVal} ${timeVal} (${modeVal})`
        );

        persistedValuesRef.current = {
          rpcDate: dateVal,
          meetingTime: timeVal,
          meetingMode: modeVal,
          venue: venueVal,
          requestDetails: notesVal,
        };

        if (isMountedRef.current) {
          setAutoSaveStatus('saved');
          const timeStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setLastSavedAt(timeStr);
          onRecordUpdated(updated);
        }
      } catch (err: any) {
        console.error('Auto-save error:', err);
        if (isMountedRef.current) {
          setAutoSaveStatus('error');
          setAutoSaveError(err.message || 'Auto-save failed');
        }
      }
    },
    [editDate, editTime, editMode, editVenue, editNotes, record, currentUser, isApproved, isPendingDean, isOffice, onRecordUpdated]
  );

  // Immediate flush for auto-save (used on blur or before modal transition)
  const flushAutoSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await performAutoSave();
  }, [performAutoSave]);

  // Handle field change with automatic 800ms debounce
  const handleFieldChange = (
    field: 'rpcDate' | 'meetingTime' | 'meetingMode' | 'venue' | 'requestDetails',
    value: string
  ) => {
    if (isApproved || isPendingDean || !isOffice) return;

    if (field === 'rpcDate') setEditDate(value);
    else if (field === 'meetingTime') setEditTime(value);
    else if (field === 'meetingMode') setEditMode(value as any);
    else if (field === 'venue') setEditVenue(value);
    else if (field === 'requestDetails') setEditNotes(value);

    setAutoSaveStatus('unsaved');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const nextValues = {
      rpcDate: field === 'rpcDate' ? value : editDate,
      meetingTime: field === 'meetingTime' ? value : editTime,
      meetingMode: field === 'meetingMode' ? (value as any) : editMode,
      venue: field === 'venue' ? value : editVenue,
      requestDetails: field === 'requestDetails' ? value : editNotes,
    };

    debounceTimerRef.current = setTimeout(() => {
      performAutoSave(nextValues);
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Breadcrumb / Back Navigation */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
        <button
          onClick={onBackToDashboard}
          id="btn-back-to-dashboard"
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to RPC Processing Dashboard
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500 font-mono">Record ID: {record.id}</span>
        </div>
      </div>

      {/* TOP SECTION: Scholar Name, Reg No, School, Supervisor, Current RPC Stage, Current Status */}
      <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Ph.D. Scholar Workspace
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-stone-950 mt-0.5">
              {record.scholarName}
            </h1>
            <div className="text-xs text-stone-600 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono font-medium text-stone-800">
                Reg: {record.enrollmentNo}
              </span>
              <span>•</span>
              <span>{record.school}</span>
              <span>•</span>
              <span>Supervisor: {record.rpcMembers?.guide?.name || scholar?.guideName || '—'}</span>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-stone-100 text-stone-900 font-bold text-xs">
                RPC {record.rpcNumber}
              </span>
              <StatusBadge status={record.status} size="md" />
            </div>

            {isApproved && (
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {record.approvedDocumentReference}
              </span>
            )}
          </div>
        </div>

        {/* Highlight Dean's Remarks if RETURNED FOR CORRECTION */}
        {isReturned && (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Dean, SDSR Returned this RPC Request for Correction</span>
            </div>
            <div className="pl-6 text-xs text-rose-800 leading-relaxed font-medium">
              "{record.returnRemarks}"
            </div>
            <div className="pl-6 text-[11px] text-rose-600 font-mono">
              Returned by {record.returnedBy || 'Dean, SDSR'} on{' '}
              {record.returnedAt ? new Date(record.returnedAt).toLocaleString('en-GB') : '—'}
            </div>
          </div>
        )}

        {/* Message if PENDING DEAN APPROVAL */}
        {isPendingDean && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Under Review by Dean, SDSR.</strong> Request forwarded on{' '}
                {record.forwardedAt ? new Date(record.forwardedAt).toLocaleString('en-GB') : 'recently'}.
                Critical fields are locked to maintain integrity.
              </span>
            </div>
          </div>
        )}

        {/* Message if APPROVED */}
        {isApproved && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Approved by Dean, SDSR.</strong> Officially finalized and signed by{' '}
                {record.approvedBy?.replace(/Prof\. \(Dr\.\) S\. O\. Junare/g, 'Dean, SDSR').replace(/Dean, SDSR \(Dean, SDSR\)/g, 'Dean, SDSR') || 'Dean, SDSR'} on{' '}
                {record.approvedAt ? new Date(record.approvedAt).toLocaleDateString('en-GB') : '—'}.
              </span>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => onViewLetterModal(record)}
                id="btn-view-approved-letter-banner"
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-100 rounded border border-emerald-300 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                View Approved Letter
              </button>
              <button
                onClick={() => onViewLetterModal(record, true)}
                id="btn-download-approved-letter-banner"
                type="button"
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition cursor-pointer"
                title="Download Approved RPC Letter as PDF"
              >
                <Download className="w-3.5 h-3.5" />
                Download Letter
              </button>
            </div>
          </div>
        )}

        {/* PRIMARY WORKFLOW ACTIONS BAR */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            {isApproved ? (
              <span className="flex items-center gap-1 text-stone-500">
                <Lock className="w-3.5 h-3.5" />
                This record is immutable and completed.
              </span>
            ) : isPendingDean ? (
              <span className="flex items-center gap-1 text-amber-800">
                <Clock className="w-3.5 h-3.5" />
                Awaiting Dean decision
              </span>
            ) : (
              <span>Ready for verification, drafting, and forwarding.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* If New, In Verification, or Returned */}
            {!isApproved && !isPendingDean && isOffice && (
              <>
                <button
                  onClick={() => {
                    setActiveTab('request');
                    setTimeout(() => {
                      const el = document.getElementById('input-rpc-date');
                      if (el) el.focus();
                    }, 50);
                  }}
                  id="btn-edit-request"
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 rounded border border-stone-300 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                  Edit Request
                </button>

                <button
                  onClick={async () => {
                    await flushAutoSave();
                    onOpenDraftLetter(record);
                  }}
                  id="btn-draft-letter-action"
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-stone-700" />
                  Draft Letter
                </button>

                <button
                  onClick={async () => {
                    await flushAutoSave();
                    onOpenForwardModal(record);
                  }}
                  id="btn-forward-dean-action"
                  type="button"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-black rounded shadow-xs transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isReturned ? 'Resubmit / Forward to Dean' : 'Forward to Dean, SDSR'}
                </button>
              </>
            )}

            {/* If Pending Dean */}
            {isPendingDean && (
              <button
                onClick={() => onOpenDraftLetter(record)}
                id="btn-view-draft-letter-pending"
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                View Letter Draft
              </button>
            )}

            {/* If Approved */}
            {isApproved && (
              <>
                <button
                  onClick={() => onViewLetterModal(record)}
                  id="btn-view-approved-letter-main"
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-300 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-700" />
                  View Approved Letter
                </button>
                <button
                  onClick={() => onViewLetterModal(record, true)}
                  id="btn-download-approved-letter-main"
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 rounded border border-stone-300 transition cursor-pointer"
                  title="Download Approved RPC Letter as PDF"
                >
                  <Download className="w-3.5 h-3.5 text-stone-600" />
                  Download Approved Letter
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MINIMAL TABBED INTERFACE:
          1. RPC Request
          2. Scholar Details
          3. RPC History
          4. RPC Members
          5. Activity / Audit Trail */}
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 text-xs sm:text-sm font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('request')}
            id="tab-btn-request"
            type="button"
            className={`py-2.5 px-4 border-b-2 font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'request'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            1. RPC Request
          </button>

          <button
            onClick={() => setActiveTab('scholar')}
            id="tab-btn-scholar"
            type="button"
            className={`py-2.5 px-4 border-b-2 font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'scholar'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <User className="w-4 h-4" />
            2. Scholar Details
          </button>

          <button
            onClick={() => setActiveTab('history')}
            id="tab-btn-history"
            type="button"
            className={`py-2.5 px-4 border-b-2 font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <History className="w-4 h-4" />
            3. RPC History
          </button>

          <button
            onClick={() => setActiveTab('members')}
            id="tab-btn-members"
            type="button"
            className={`py-2.5 px-4 border-b-2 font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Users className="w-4 h-4" />
            4. RPC Members
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            id="tab-btn-activity"
            type="button"
            className={`py-2.5 px-4 border-b-2 font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            5. Activity / Audit Trail
          </button>
        </div>

        {/* Tab 1: RPC Request (current request details) */}
        {activeTab === 'request' && (
          <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-stone-900">
                    RPC {record.rpcNumber} Request Details
                  </h2>
                  {isApproved || isPendingDean ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                      <Lock className="w-3 h-3 text-stone-500" />
                      Locked ({isApproved ? 'Approved' : 'Pending Dean'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      Draft Editable
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Schedule, mode, and verification status for current evaluation
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Auto-Save Indicator */}
                {!isApproved && !isPendingDean && isOffice && (
                  <div id="rpc-request-autosave-status" className="transition-all duration-200">
                    {autoSaveStatus === 'saving' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                        Auto-saving draft...
                      </span>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Auto-saved {lastSavedAt ? `(${lastSavedAt})` : 'to draft'}
                      </span>
                    )}
                    {autoSaveStatus === 'unsaved' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Unsaved edits (saving...)
                      </span>
                    )}
                    {autoSaveStatus === 'error' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Save failed</span>
                        <button
                          type="button"
                          onClick={() => performAutoSave()}
                          className="ml-1 underline text-rose-900 font-bold hover:text-rose-950 cursor-pointer"
                        >
                          Retry
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {record.letterData && (
                  <button
                    onClick={async () => {
                      await flushAutoSave();
                      onOpenDraftLetter(record);
                    }}
                    type="button"
                    className="text-xs font-semibold text-stone-700 hover:text-stone-900 underline flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Draft Letter
                  </button>
                )}
              </div>
            </div>

            {autoSaveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{autoSaveError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => performAutoSave()}
                  className="font-bold underline text-rose-900 hover:text-rose-950"
                >
                  Retry Save
                </button>
              </div>
            )}

            {/* If Editable: Render Live Debounced Inputs */}
            {!isApproved && !isPendingDean && isOffice ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-stone-600">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Debounced Auto-Save:</strong> Any edits to schedule date, meeting time, mode, venue, or synopsis are automatically persisted to the draft record without requiring a manual save button click.
                    </span>
                  </div>
                  {lastSavedAt && (
                    <span className="text-[11px] text-stone-500 font-mono shrink-0">
                      Last persisted: {lastSavedAt}
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="input-rpc-date" className="block font-semibold text-stone-700 mb-1">
                        RPC Scheduled Date *
                      </label>
                      <input
                        id="input-rpc-date"
                        type="date"
                        value={editDate}
                        onChange={(e) => handleFieldChange('rpcDate', e.target.value)}
                        onBlur={flushAutoSave}
                        className="w-full p-2.5 border border-stone-300 rounded bg-white text-stone-900 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition"
                        required
                      />
                      <span className="text-[11px] text-stone-500 mt-0.5 block">
                        {editDate
                          ? new Date(editDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Set evaluation date'}
                      </span>
                    </div>

                    <div>
                      <label htmlFor="input-rpc-time" className="block font-semibold text-stone-700 mb-1">
                        Meeting Time *
                      </label>
                      <input
                        id="input-rpc-time"
                        type="text"
                        placeholder="e.g. 11:30 AM IST"
                        value={editTime}
                        onChange={(e) => handleFieldChange('meetingTime', e.target.value)}
                        onBlur={flushAutoSave}
                        className="w-full p-2.5 border border-stone-300 rounded bg-white text-stone-900 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition"
                        required
                      />
                      <span className="text-[11px] text-stone-500 mt-0.5 block">
                        Exact time of RPC committee convening
                      </span>
                    </div>

                    <div>
                      <label htmlFor="select-rpc-mode" className="block font-semibold text-stone-700 mb-1">
                        Meeting Mode *
                      </label>
                      <select
                        id="select-rpc-mode"
                        value={editMode}
                        onChange={(e) => handleFieldChange('meetingMode', e.target.value)}
                        onBlur={flushAutoSave}
                        className="w-full p-2.5 border border-stone-300 rounded bg-white text-stone-900 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition font-medium"
                      >
                        <option value="ONLINE">ONLINE</option>
                        <option value="OFFLINE">OFFLINE</option>
                        <option value="HYBRID">HYBRID</option>
                      </select>
                      <span className="text-[11px] text-stone-500 mt-0.5 block">
                        Evaluation conduct platform
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="input-rpc-venue" className="block font-semibold text-stone-700 mb-1">
                      Venue or Meeting Link
                    </label>
                    <input
                      id="input-rpc-venue"
                      type="text"
                      placeholder="e.g. Conference Room 102, NFSU Gandhinagar or Google Meet link"
                      value={editVenue}
                      onChange={(e) => handleFieldChange('venue', e.target.value)}
                      onBlur={flushAutoSave}
                      className="w-full p-2.5 border border-stone-300 rounded bg-white text-stone-900 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition"
                    />
                    <span className="text-[11px] text-stone-500 mt-0.5 block">
                      Physical boardroom location or virtual video link for committee members
                    </span>
                  </div>

                  <div>
                    <label htmlFor="textarea-rpc-notes" className="block font-semibold text-stone-700 mb-1">
                      Notes & Ph.D. Cell Reference Details
                    </label>
                    <textarea
                      id="textarea-rpc-notes"
                      value={editNotes}
                      onChange={(e) => handleFieldChange('requestDetails', e.target.value)}
                      onBlur={flushAutoSave}
                      rows={3}
                      placeholder="Provide context, synopsis submission notes, or internal SDSR office references..."
                      className="w-full p-2.5 border border-stone-300 rounded bg-white text-stone-900 focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition"
                    />
                  </div>
                </div>

                {/* Pre-Forwarding Checklist */}
                <div className="p-4 rounded-lg border border-stone-200 bg-stone-50 space-y-2 mt-4">
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
                    Forwarding Verification Checklist
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className={`flex items-center gap-2 ${editDate && editTime ? 'text-emerald-800' : 'text-stone-400'}`}>
                      <Check className={`w-4 h-4 ${editDate && editTime ? 'text-emerald-600' : 'text-stone-300'}`} />
                      <span>RPC Date and Time confirmed ({editDate || 'Date missing'}, {editTime || 'Time missing'})</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Research Supervisor / Guide verified</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Committee Experts pool assigned</span>
                    </div>
                    <div className={`flex items-center gap-2 ${record.letterData ? 'text-emerald-800' : 'text-stone-400'}`}>
                      <Check className={`w-4 h-4 ${record.letterData ? 'text-emerald-600' : 'text-stone-300'}`} />
                      <span>Official Letter Draft {record.letterData ? 'prepared' : 'pending drafting'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* If Read-Only / Locked: Display Clean Summary Grid */
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg flex items-center gap-2 text-stone-600">
                  <Lock className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>
                    This record is in status <strong>{record.status}</strong>. Request fields are locked and immutable.
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
                  <div>
                    <span className="text-stone-500 block">RPC Date</span>
                    <span className="font-semibold text-stone-900 text-sm">
                      {record.rpcDate
                        ? new Date(record.rpcDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        : 'Not set'}
                    </span>
                  </div>

                  <div>
                    <span className="text-stone-500 block">Meeting Time</span>
                    <span className="font-semibold text-stone-900 text-sm">
                      {record.meetingTime || 'Not set'}
                    </span>
                  </div>

                  <div>
                    <span className="text-stone-500 block">Mode</span>
                    <span className="font-semibold text-stone-900 text-sm">{record.meetingMode}</span>
                  </div>

                  <div>
                    <span className="text-stone-500 block">Venue / Link</span>
                    <span className="font-medium text-stone-800 text-xs">
                      {record.venue || 'Online Platform'}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-stone-800 mb-1">Request Notes & Progress Synopsis</h3>
                  <div className="p-3 bg-stone-50 rounded border border-stone-200 text-stone-700 leading-relaxed">
                    {record.requestDetails || 'Standard Research Progress evaluation request.'}
                  </div>
                </div>

                {/* Pre-Forwarding Checklist */}
                <div className="p-4 rounded-lg border border-stone-200 bg-white space-y-2">
                  <h4 className="font-bold text-stone-900 text-xs uppercase tracking-wider">
                    Forwarding Verification Checklist
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>RPC Date and Time confirmed</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Research Supervisor / Guide verified</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Committee Experts pool assigned</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Official Letter Draft prepared</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Scholar Details (research topic, enrollment date, contact info) */}
        {activeTab === 'scholar' && (
          <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-2xs space-y-6">
            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-stone-900">
                Ph.D. Scholar Profile
              </h2>
              <p className="text-xs text-stone-500">
                Permanent institutional registration details on record at SDSR
              </p>
            </div>

            {scholar ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs sm:text-sm">
                <div className="space-y-3">
                  <div>
                    <span className="text-stone-500 block text-xs">Full Name of Scholar</span>
                    <span className="font-bold text-stone-950 text-base">{scholar.name}</span>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-xs">Registration / Enrollment Number</span>
                    <span className="font-mono font-bold text-stone-900">{scholar.enrollmentNo}</span>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-xs">Enrolled School</span>
                    <span className="font-medium text-stone-800">{scholar.school}</span>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-xs">Campus</span>
                    <span className="font-medium text-stone-800">{scholar.campus}</span>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-xs">Date of Ph.D. Registration</span>
                    <span className="font-medium text-stone-800">{scholar.registrationDate}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-stone-500 block text-xs">Research Supervisor / Guide</span>
                    <span className="font-bold text-stone-900">{scholar.guideName}</span>
                    <span className="text-stone-500 text-xs block">{scholar.guideDesignation}</span>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-xs">Approved Ph.D. Research Topic</span>
                    <p className="font-medium text-stone-900 bg-stone-50 p-2.5 rounded border border-stone-200 leading-relaxed text-xs">
                      {scholar.researchTopic}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-100">
                    <span className="text-stone-500 block text-xs mb-1">Contact Information</span>
                    <div className="text-xs text-stone-700 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-stone-400" />
                        <span>{scholar.contactDetails?.email}</span>
                      </div>
                      <div>Phone: {scholar.contactDetails?.phone}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-500">Loading scholar information...</div>
            )}
          </div>
        )}

        {/* Tab 3: RPC History (chronological record of previous RPCs with strict sequencing) */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-2xs space-y-4">
            <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-stone-900">
                  Chronological RPC Progression History
                </h2>
                <p className="text-xs text-stone-500">
                  Strict sequencing: Previous RPCs are locked, future stages unlock only after Dean approval
                </p>
              </div>
              <div className="text-xs text-stone-600 bg-stone-100 px-3 py-1 rounded">
                Current Stage: <strong>RPC {record.rpcNumber}</strong>
              </div>
            </div>

            {/* Timeline / Table of RPCs */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">RPC Stage</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Document Reference</th>
                    <th className="py-2.5 px-3 text-right">Letter / Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {history.map((histRecord) => {
                    const isCurrent = histRecord.id === record.id;
                    return (
                      <tr
                        key={histRecord.id}
                        className={`${isCurrent ? 'bg-amber-50/40 font-medium' : 'hover:bg-stone-50'} transition`}
                      >
                        <td className="py-3 px-3">
                          <span className="font-bold text-stone-900 mr-2">
                            RPC {histRecord.rpcNumber}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-stone-600">
                          {histRecord.rpcDate || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={histRecord.status} />
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-stone-600">
                          {histRecord.approvedDocumentReference ||
                            histRecord.draftDocumentReference ||
                            '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {histRecord.status === 'APPROVED' ? (
                            <button
                              onClick={() => onViewLetterModal(histRecord)}
                              type="button"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline"
                            >
                              <FileText className="w-3 h-3" />
                              View Approved Letter
                            </button>
                          ) : isCurrent ? (
                            <button
                              onClick={() => onOpenDraftLetter(histRecord)}
                              type="button"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 hover:text-stone-900 underline"
                            >
                              <FileText className="w-3 h-3" />
                              Draft Letter
                            </button>
                          ) : (
                            <span className="text-stone-400 italic">Locked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Next Stage Permissibility Indicator */}
            <div className="pt-3 border-t border-stone-200 text-xs text-stone-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Deterministic sequencing logic prevents skipping RPC levels. Stage RPC {record.rpcNumber + 1} will
                become permissible once RPC {record.rpcNumber} receives official Dean approval.
              </span>
            </div>
          </div>
        )}

        {/* Tab 4: RPC Members (guide, internal expert, external experts) */}
        {activeTab === 'members' && (
          <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-2xs space-y-6">
            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-stone-900">
                Research Progress Committee (RPC) Composition
              </h2>
              <p className="text-xs text-stone-500">
                Approved supervisory and examination committee for RPC {record.rpcNumber}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Supervisor / Guide */}
              <div className="p-4 rounded-lg border border-stone-200 bg-stone-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  1. Research Supervisor / Guide
                </span>
                <div className="font-bold text-stone-950 text-sm">
                  {record.rpcMembers?.guide?.name}
                </div>
                <div className="text-stone-700">{record.rpcMembers?.guide?.designation}</div>
                <div className="text-stone-600">
                  {record.rpcMembers?.guide?.schoolOrInstitution || record.school}, NFSU
                </div>
                <div className="text-stone-500 text-[11px] pt-1">
                  Email: {record.rpcMembers?.guide?.email || 'guide@nfsu.ac.in'}
                </div>
              </div>

              {/* Internal Expert */}
              <div className="p-4 rounded-lg border border-stone-200 bg-stone-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  2. Internal Expert Member
                </span>
                <div className="font-bold text-stone-950 text-sm">
                  {record.rpcMembers?.internalExpert?.name}
                </div>
                <div className="text-stone-700">
                  {record.rpcMembers?.internalExpert?.designation}
                </div>
                <div className="text-stone-600">
                  {record.rpcMembers?.internalExpert?.department},{' '}
                  {record.rpcMembers?.internalExpert?.schoolOrInstitution}
                </div>
                <div className="text-stone-500 text-[11px] pt-1">
                  Campus: {record.rpcMembers?.internalExpert?.location}
                </div>
              </div>

              {/* External Expert 1 */}
              <div className="p-4 rounded-lg border border-stone-200 bg-stone-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  3. External Expert Member - 1
                </span>
                <div className="font-bold text-stone-950 text-sm">
                  {record.rpcMembers?.externalExpert1?.name}
                </div>
                <div className="text-stone-700">
                  {record.rpcMembers?.externalExpert1?.designation}
                </div>
                <div className="text-stone-600">
                  {record.rpcMembers?.externalExpert1?.department},{' '}
                  {record.rpcMembers?.externalExpert1?.schoolOrInstitution}
                </div>
                <div className="text-stone-500 text-[11px] pt-1">
                  Location: {record.rpcMembers?.externalExpert1?.location}
                </div>
              </div>

              {/* External Expert 2 */}
              <div className="p-4 rounded-lg border border-stone-200 bg-stone-50/70 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  4. External Expert Member - 2
                </span>
                <div className="font-bold text-stone-950 text-sm">
                  {record.rpcMembers?.externalExpert2?.name}
                </div>
                <div className="text-stone-700">
                  {record.rpcMembers?.externalExpert2?.designation}
                </div>
                <div className="text-stone-600">
                  {record.rpcMembers?.externalExpert2?.department},{' '}
                  {record.rpcMembers?.externalExpert2?.schoolOrInstitution}
                </div>
                <div className="text-stone-500 text-[11px] pt-1">
                  Location: {record.rpcMembers?.externalExpert2?.location}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Activity / Audit Trail (who created, modified, forwarded, approved, or returned) */}
        {activeTab === 'activity' && (
          <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-2xs space-y-4">
            <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-stone-900">
                  Institutional Activity & Audit Trail
                </h2>
                <p className="text-xs text-stone-500">
                  Immutable audit records tracking user actions, timestamps, and remarks
                </p>
              </div>
              <span className="text-xs font-mono text-stone-500">
                Total Logs: {auditLogs.length}
              </span>
            </div>

            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400">
                  No activity logs recorded yet for this RPC record.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{log.action}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            log.userRole === 'DEAN_SDSR'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {log.userRole}
                        </span>
                      </div>
                      <span className="font-mono text-stone-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleString('en-GB')}
                      </span>
                    </div>

                    <div className="text-stone-700 leading-relaxed pt-0.5">
                      {log.details}
                    </div>

                    <div className="text-[11px] text-stone-500 pt-0.5">
                      Performed by: <span className="font-semibold text-stone-800">{log.performedBy}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Email Notification Queue / Logs (Firestore) */}
            <div className="border-t border-stone-200 pt-5 mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                    Automated Email Notifications (Firestore Queue)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                  {emailNotifications.length} event(s) logged
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Pending notification events logged in Firestore collection <code className="text-stone-700 bg-stone-100 px-1 py-0.5 rounded font-mono">emailNotifications</code> upon status transitions to <span className="font-semibold">Pending Dean Approval</span> or <span className="font-semibold">Returned for Correction</span>.
              </p>

              {emailNotifications.length === 0 ? (
                <div className="p-4 bg-stone-50/80 rounded-lg border border-dashed border-stone-200 text-center text-xs text-stone-400">
                  No automated email notification events logged yet for this RPC record. Events trigger automatically when forwarded to Dean or returned for correction.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {emailNotifications.map((notif) => {
                    const isExpanded = expandedEmailId === notif.id;
                    const isReturnedEvent = notif.eventType === 'RPC_RETURNED_FOR_CORRECTION';

                    return (
                      <div
                        key={notif.id}
                        className={`rounded-lg border text-xs transition-colors overflow-hidden ${
                          isReturnedEvent
                            ? 'border-amber-200 bg-amber-50/40'
                            : 'border-blue-200 bg-blue-50/40'
                        }`}
                      >
                        <div
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-stone-50/60"
                          onClick={() => setExpandedEmailId(isExpanded ? null : notif.id)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded font-semibold text-[10px] tracking-wide ${
                                  isReturnedEvent
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                                }`}
                              >
                                {isReturnedEvent ? 'RETURNED FOR CORRECTION' : 'PENDING DEAN APPROVAL'}
                              </span>

                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] border border-emerald-300">
                                {notif.status}
                              </span>

                              <span className="font-mono text-stone-500 text-[10px]">
                                Event ID: {notif.id}
                              </span>
                            </div>

                            <div className="font-medium text-stone-900 text-xs">
                              To: <span className="font-bold">{notif.recipientName}</span>{' '}
                              <span className="text-stone-500 font-mono">({notif.recipientEmail})</span>
                            </div>

                            <div className="text-stone-700 font-semibold text-xs line-clamp-1">
                              Subject: {notif.subject}
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-end justify-between gap-1 shrink-0">
                            <span className="font-mono text-stone-500 text-[11px]">
                              {new Date(notif.createdAt).toLocaleString('en-GB')}
                            </span>
                            <button
                              type="button"
                              className="text-stone-600 hover:text-stone-900 font-semibold text-[11px] underline"
                            >
                              {isExpanded ? 'Hide Payload' : 'View Message'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3.5 border-t border-stone-200/80 bg-white space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-stone-500 pb-1 border-b border-stone-100">
                              <span>Recipient Role: <strong className="text-stone-800">{notif.recipientRole}</strong></span>
                              <span>Target RPC: <strong className="text-stone-800">RPC {notif.rpcNumber}</strong></span>
                              <span>Scholar: <strong className="text-stone-800">{notif.scholarName}</strong></span>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                                Full Formatted Email Notification Content
                              </span>
                              <pre className="p-3 bg-stone-900 text-stone-100 rounded text-[11px] font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                {notif.emailBody}
                              </pre>
                            </div>

                            {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                              <div className="text-[11px] text-stone-600 bg-stone-50 p-2 rounded border border-stone-200">
                                <span className="font-bold text-stone-800 block mb-0.5">Metadata Payload:</span>
                                <div className="font-mono text-[10px] text-stone-700">
                                  {JSON.stringify(notif.metadata, null, 2)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

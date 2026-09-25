import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RpcRecord, UserProfile } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  Plus,
  Search,
  AlertTriangle,
  FileText,
  Eye,
  CheckCircle2,
  Send,
  Download,
  X,
  RotateCcw,
  Layers,
  Building2,
  FileSpreadsheet,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  Trash2,
  User,
  Hash,
} from 'lucide-react';
import {
  exportApprovedLettersToExcel,
  exportAllRpcRecordsToExcel,
  downloadExcelTemplate,
} from '../services/excelService';
import {
  removeAllApprovedRpcRecords,
  deleteRpcRecord,
} from '../services/dataService';

interface OfficeDashboardProps {
  records: RpcRecord[];
  onOpenRecord: (recordId: string) => void;
  onNewRequest: () => void;
  currentUser: UserProfile;
  onViewLetterModal: (record: RpcRecord, autoDownload?: boolean) => void;
  onOpenExcelImport?: () => void;
  onRefreshData?: () => Promise<void> | void;
}

export const OfficeDashboard: React.FC<OfficeDashboardProps> = ({
  records,
  onOpenRecord,
  onNewRequest,
  currentUser,
  onViewLetterModal,
  onOpenExcelImport,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTarget, setSearchTarget] = useState<'ALL' | 'SCHOLAR' | 'REGISTRATION'>('ALL');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('ALL');
  const [isUnloadMenuOpen, setIsUnloadMenuOpen] = useState(false);
  const unloadMenuRef = useRef<HTMLDivElement>(null);
  const [showConfirmPurgeApproved, setShowConfirmPurgeApproved] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<RpcRecord | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Global keyboard shortcut: Press '/' to focus real-time search, 'Escape' to clear and blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Real-time highlight helper for matched search terms
  const highlightMatch = (text: string, query: string): React.ReactNode => {
    const trimmed = query.trim();
    if (!trimmed || !text) return text;

    try {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = text.split(regex);

      return parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-amber-100 text-amber-900 rounded-xs px-0.5 font-bold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  const handlePurgeAllApproved = async () => {
    setIsPurging(true);
    try {
      const removedCount = await removeAllApprovedRpcRecords();
      if (onRefreshData) {
        await onRefreshData();
      }
      setNotification({
        type: 'success',
        message: `Successfully removed all approved data (${removedCount} record${removedCount === 1 ? '' : 's'} cleared).`,
      });
      setShowConfirmPurgeApproved(false);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to remove approved records: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsPurging(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRpcRecord(recordToDelete.id);
      if (onRefreshData) {
        await onRefreshData();
      }
      setNotification({
        type: 'success',
        message: `Successfully removed RPC ${recordToDelete.rpcNumber} record for ${recordToDelete.scholarName}.`,
      });
      setRecordToDelete(null);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Failed to delete record: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Close unload menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (unloadMenuRef.current && !unloadMenuRef.current.contains(e.target as Node)) {
        setIsUnloadMenuOpen(false);
      }
    };
    if (isUnloadMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUnloadMenuOpen]);

  // Distinct schools from records for school filter
  const distinctSchools = useMemo(() => {
    const schools = new Set<string>();
    records.forEach((r) => {
      if (r.school) schools.add(r.school);
    });
    return Array.from(schools).sort();
  }, [records]);

  // Count summaries
  const newRequestsCount = records.filter(
    (r) => r.status === 'NEW' || r.status === 'IN_VERIFICATION' || r.status === 'DRAFTED'
  ).length;
  const returnedCount = records.filter((r) => r.status === 'RETURNED_FOR_CORRECTION').length;
  const pendingDeanCount = records.filter((r) => r.status === 'PENDING_DEAN_APPROVAL').length;
  const approvedCount = records.filter((r) => r.status === 'APPROVED').length;

  // Filter records
  const filteredRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return records.filter((r) => {
      // 1. Real-time Search matching (Scholar Name or Registration Number)
      if (query) {
        const scholarMatch = r.scholarName.toLowerCase().includes(query);
        const regMatch = r.enrollmentNo.toLowerCase().includes(query);

        let matchesSearch = false;
        if (searchTarget === 'SCHOLAR') {
          matchesSearch = scholarMatch;
        } else if (searchTarget === 'REGISTRATION') {
          matchesSearch = regMatch;
        } else {
          // 'ALL': matches Scholar Name or Registration Number, plus secondary fields
          const schoolMatch = r.school.toLowerCase().includes(query);
          const guideMatch = (r.rpcMembers?.guide?.name || '').toLowerCase().includes(query);
          const rpcStageStr = `rpc ${r.rpcNumber}`.toLowerCase();
          const rpcStageHyphen = `rpc-${r.rpcNumber}`.toLowerCase();
          const rpcOnlyNum = String(r.rpcNumber);
          const approvedRef = r.approvedDocumentReference?.toLowerCase() || '';
          const draftRef = r.draftDocumentReference?.toLowerCase() || '';
          const letterRef = r.letterData?.refNo?.toLowerCase() || '';
          const subject = r.letterData?.subject?.toLowerCase() || '';

          matchesSearch =
            scholarMatch ||
            regMatch ||
            schoolMatch ||
            guideMatch ||
            rpcStageStr.includes(query) ||
            rpcStageHyphen.includes(query) ||
            rpcOnlyNum === query ||
            approvedRef.includes(query) ||
            draftRef.includes(query) ||
            letterRef.includes(query) ||
            subject.includes(query);
        }

        if (!matchesSearch) return false;
      }

      // 2. Status Filter
      if (selectedStatusFilter !== 'ALL') {
        if (selectedStatusFilter === 'NEW') {
          if (r.status !== 'NEW' && r.status !== 'IN_VERIFICATION' && r.status !== 'DRAFTED') {
            return false;
          }
        } else if (selectedStatusFilter === 'RETURNED') {
          if (r.status !== 'RETURNED_FOR_CORRECTION') return false;
        } else if (selectedStatusFilter === 'PENDING') {
          if (r.status !== 'PENDING_DEAN_APPROVAL') return false;
        } else if (selectedStatusFilter === 'APPROVED') {
          if (r.status !== 'APPROVED') return false;
        }
      }

      // 3. RPC Stage Filter
      if (selectedStageFilter !== 'ALL') {
        if (selectedStageFilter === '5+') {
          if (r.rpcNumber < 5) return false;
        } else {
          if (r.rpcNumber !== Number(selectedStageFilter)) return false;
        }
      }

      // 4. School Filter
      if (selectedSchoolFilter !== 'ALL') {
        if (r.school !== selectedSchoolFilter) return false;
      }

      return true;
    });
  }, [records, searchQuery, searchTarget, selectedStatusFilter, selectedStageFilter, selectedSchoolFilter]);

  // Approved records list (filtered also by search if entered)
  const approvedRecords = useMemo(() => {
    const baseApproved = records.filter((r) => r.status === 'APPROVED');
    const query = searchQuery.trim().toLowerCase();
    if (!query) return baseApproved;

    return baseApproved.filter((r) => {
      const scholarMatch = r.scholarName.toLowerCase().includes(query);
      const regMatch = r.enrollmentNo.toLowerCase().includes(query);

      if (searchTarget === 'SCHOLAR') return scholarMatch;
      if (searchTarget === 'REGISTRATION') return regMatch;

      return (
        scholarMatch ||
        regMatch ||
        r.school.toLowerCase().includes(query) ||
        `rpc ${r.rpcNumber}`.toLowerCase().includes(query) ||
        (r.approvedDocumentReference && r.approvedDocumentReference.toLowerCase().includes(query))
      );
    });
  }, [records, searchQuery, searchTarget]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    searchTarget !== 'ALL' ||
    selectedStatusFilter !== 'ALL' ||
    selectedStageFilter !== 'ALL' ||
    selectedSchoolFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSearchTarget('ALL');
    setSelectedStatusFilter('ALL');
    setSelectedStageFilter('ALL');
    setSelectedSchoolFilter('ALL');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            RPC Processing
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
            Office of SDSR — Ph.D. Research Progress Committee Records and Letter Generation
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Load Excel Button */}
          <button
            onClick={onOpenExcelImport}
            id="btn-open-excel-import"
            type="button"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 active:bg-stone-100 rounded-md shadow-2xs transition cursor-pointer"
            title="Load Excel file for student data matching and preparing approved letters"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Load Excel</span>
          </button>

          {/* Unload Excel Dropdown */}
          <div className="relative" ref={unloadMenuRef}>
            <button
              onClick={() => setIsUnloadMenuOpen(!isUnloadMenuOpen)}
              id="btn-unload-excel-dropdown"
              type="button"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 active:bg-stone-100 rounded-md shadow-2xs transition cursor-pointer"
              title="Unload / Export records to formatted Excel spreadsheets (.xlsx)"
            >
              <Download className="w-4 h-4 text-stone-600" />
              <span>Unload Excel</span>
              <ChevronDown className={`w-3.5 h-3.5 text-stone-500 transition-transform ${isUnloadMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isUnloadMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-stone-200 py-1.5 z-30 divide-y divide-stone-100 text-xs">
                <div className="px-3 py-2 bg-stone-50">
                  <div className="font-bold text-stone-900">SDSR Excel Unload Options</div>
                  <div className="text-[10px] text-stone-500">Export verified records to Excel (.xlsx)</div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnloadMenuOpen(false);
                      const approved = records.filter((r) => r.status === 'APPROVED');
                      if (approved.length === 0) {
                        alert('No approved letters currently in database to export.');
                        return;
                      }
                      exportApprovedLettersToExcel(approved);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-stone-50 flex items-center gap-2 text-stone-700 hover:text-stone-900 transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold">Unload Approved Letters</div>
                      <div className="text-[10px] text-stone-500">
                        {approvedCount} finalized letter register (.xlsx)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUnloadMenuOpen(false);
                      exportAllRpcRecordsToExcel(records);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-stone-50 flex items-center gap-2 text-stone-700 hover:text-stone-900 transition cursor-pointer"
                  >
                    <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-semibold">Unload Master RPC Database</div>
                      <div className="text-[10px] text-stone-500">
                        All {records.length} evaluation records (.xlsx)
                      </div>
                    </div>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnloadMenuOpen(false);
                      downloadExcelTemplate('combined');
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center gap-2 text-stone-600 hover:text-stone-900 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>Download Blank Templates</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUnloadMenuOpen(false);
                      if (onOpenExcelImport) onOpenExcelImport();
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center gap-2 text-stone-600 hover:text-stone-900 transition cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>Open Student Matching Console</span>
                  </button>
                </div>

                <div className="py-1 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnloadMenuOpen(false);
                      setShowConfirmPurgeApproved(true);
                    }}
                    id="btn-menu-remove-approved-data"
                    className="w-full px-3 py-1.5 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-600 hover:text-rose-800 transition cursor-pointer text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Remove All Approved Data</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New RPC Request Button */}
          <button
            onClick={onNewRequest}
            id="btn-new-rpc-request"
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-black rounded-md shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New RPC Request</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Notice Banner if any request is returned for correction */}
      {returnedCount > 0 && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Action Required:</strong> {returnedCount} RPC request(s) returned by the Dean, SDSR for correction.
            </span>
          </div>
          <button
            onClick={() => setSelectedStatusFilter('RETURNED')}
            id="btn-filter-returned-banner"
            type="button"
            className="text-xs font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-900 cursor-pointer"
          >
            Filter Returned ({returnedCount})
          </button>
        </div>
      )}

      {/* Small Summary Cards (interactive status shortcuts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* New Requests */}
        <div
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'NEW' ? 'ALL' : 'NEW')}
          id="stat-card-new"
          className={`p-3.5 rounded-lg border transition cursor-pointer ${
            selectedStatusFilter === 'NEW'
              ? 'bg-stone-100 border-stone-400 ring-1 ring-stone-400 shadow-xs'
              : 'bg-white border-stone-200 hover:border-stone-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600">New Requests</span>
            <FileText className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-bold text-stone-900 mt-1">{newRequestsCount}</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Under verification / drafting</div>
        </div>

        {/* Returned for Correction */}
        <div
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'RETURNED' ? 'ALL' : 'RETURNED')}
          id="stat-card-returned"
          className={`p-3.5 rounded-lg border transition cursor-pointer ${
            selectedStatusFilter === 'RETURNED'
              ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400 shadow-xs'
              : 'bg-white border-stone-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-700">Returned for Correction</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{returnedCount}</div>
          <div className="text-[11px] text-rose-600 mt-0.5">Remarks from Dean</div>
        </div>

        {/* Pending Dean Approval */}
        <div
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          id="stat-card-pending"
          className={`p-3.5 rounded-lg border transition cursor-pointer ${
            selectedStatusFilter === 'PENDING'
              ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400 shadow-xs'
              : 'bg-white border-stone-200 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Pending Dean Approval</span>
            <Send className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{pendingDeanCount}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Forwarded for Dean signature</div>
        </div>

        {/* Approved */}
        <div
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
          id="stat-card-approved"
          className={`p-3.5 rounded-lg border transition cursor-pointer ${
            selectedStatusFilter === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400 shadow-xs'
              : 'bg-white border-stone-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{approvedCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Finalized & authorized</div>
        </div>
      </div>

      {/* ADVANCED REAL-TIME SEARCH & STATUS FILTERS BAR */}
      <div className="bg-white rounded-lg border border-stone-200 p-3 sm:p-4 shadow-2xs space-y-3">
        {/* Row 1: Real-time Search Input & Quick Scope & Secondary Filters */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          {/* Main Real-Time Search Bar */}
          <div className="relative flex-1">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 transition-colors pointer-events-none ${searchQuery ? 'text-stone-900' : 'text-stone-400'}`} />
            <input
              ref={searchInputRef}
              type="text"
              id="input-sdsr-search"
              placeholder={
                searchTarget === 'SCHOLAR'
                  ? 'Real-time lookup by Scholar Name (e.g., Priya Sharma)...'
                  : searchTarget === 'REGISTRATION'
                  ? 'Real-time lookup by Registration No. (e.g., NFSU/PHD/2023)...'
                  : 'Search by Scholar Name or Registration Number for fast lookup...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-24 py-2 text-xs sm:text-sm text-stone-900 bg-stone-50 hover:bg-white focus:bg-white rounded-md border border-stone-300 focus:outline-hidden focus:ring-1 focus:ring-stone-500 focus:border-stone-500 transition placeholder:text-stone-400"
            />
            {/* Real-time Result Badge & Clear Button */}
            <div className="absolute right-2.5 top-2 flex items-center gap-1.5">
              {searchQuery ? (
                <>
                  <span
                    id="search-live-matches-badge"
                    className="inline-flex items-center text-[10px] font-semibold text-stone-600 bg-stone-200/80 px-1.5 py-0.5 rounded-full"
                  >
                    {filteredRecords.length} {filteredRecords.length === 1 ? 'match' : 'matches'}
                  </span>
                  <button
                    type="button"
                    id="btn-clear-search"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer transition"
                    title="Clear search (Esc)"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <kbd
                  onClick={() => searchInputRef.current?.focus()}
                  className="hidden sm:inline-flex items-center text-[10px] font-mono text-stone-400 bg-stone-100 hover:bg-stone-200 border border-stone-200 px-1.5 py-0.5 rounded cursor-pointer transition select-none"
                  title="Press / to search"
                >
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Quick Filter Scope Pills (All | Scholar Name | Registration No.) */}
          <div className="flex items-center gap-1 shrink-0 bg-stone-100 p-1 rounded-md border border-stone-200 text-xs">
            <button
              type="button"
              id="btn-scope-all"
              onClick={() => setSearchTarget('ALL')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer text-xs ${
                searchTarget === 'ALL'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              id="btn-scope-scholar"
              onClick={() => setSearchTarget('SCHOLAR')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition cursor-pointer text-xs ${
                searchTarget === 'SCHOLAR'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Filter records strictly by Scholar Name"
            >
              <User className="w-3 h-3 text-stone-500" />
              <span>Scholar Name</span>
            </button>
            <button
              type="button"
              id="btn-scope-registration"
              onClick={() => setSearchTarget('REGISTRATION')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition cursor-pointer text-xs ${
                searchTarget === 'REGISTRATION'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Filter records strictly by Registration Number"
            >
              <Hash className="w-3 h-3 text-stone-500" />
              <span>Registration No.</span>
            </button>
          </div>

          {/* Quick Select: RPC Stage */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative inline-flex items-center">
              <Layers className="w-3.5 h-3.5 absolute left-2.5 text-stone-400 pointer-events-none" />
              <select
                id="select-rpc-stage"
                value={selectedStageFilter}
                onChange={(e) => setSelectedStageFilter(e.target.value)}
                className="pl-8 pr-7 py-2 text-xs font-medium text-stone-700 bg-stone-50 border border-stone-300 rounded-md hover:bg-white focus:outline-hidden focus:ring-1 focus:ring-stone-500 focus:border-stone-500 cursor-pointer transition appearance-none"
              >
                <option value="ALL">All RPC Stages</option>
                <option value="1">RPC 1</option>
                <option value="2">RPC 2</option>
                <option value="3">RPC 3</option>
                <option value="4">RPC 4</option>
                <option value="5+">RPC 5+</option>
              </select>
              <span className="pointer-events-none absolute right-2 text-stone-400 text-[10px]">▼</span>
            </div>

            {/* Quick Select: School */}
            {distinctSchools.length > 1 && (
              <div className="relative inline-flex items-center">
                <Building2 className="w-3.5 h-3.5 absolute left-2.5 text-stone-400 pointer-events-none" />
                <select
                  id="select-school-filter"
                  value={selectedSchoolFilter}
                  onChange={(e) => setSelectedSchoolFilter(e.target.value)}
                  className="pl-8 pr-7 py-2 text-xs font-medium text-stone-700 bg-stone-50 border border-stone-300 rounded-md hover:bg-white focus:outline-hidden focus:ring-1 focus:ring-stone-500 focus:border-stone-500 cursor-pointer transition appearance-none max-w-[180px] sm:max-w-[220px] truncate"
                >
                  <option value="ALL">All Schools</option>
                  {distinctSchools.map((school) => (
                    <option key={school} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 text-stone-400 text-[10px]">▼</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Status Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {/* ALL */}
            <button
              id="filter-status-all"
              type="button"
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                selectedStatusFilter === 'ALL'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>All Requests</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedStatusFilter === 'ALL'
                    ? 'bg-stone-700 text-stone-100'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {records.length}
              </span>
            </button>

            {/* NEW / IN VERIFICATION */}
            <button
              id="filter-status-new"
              type="button"
              onClick={() => setSelectedStatusFilter('NEW')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                selectedStatusFilter === 'NEW'
                  ? 'bg-stone-800 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>New / In Verification</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedStatusFilter === 'NEW'
                    ? 'bg-stone-700 text-stone-100'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {newRequestsCount}
              </span>
            </button>

            {/* RETURNED FOR CORRECTION */}
            <button
              id="filter-status-returned"
              type="button"
              onClick={() => setSelectedStatusFilter('RETURNED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                selectedStatusFilter === 'RETURNED'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : returnedCount > 0
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {returnedCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
              <span>Returned for Correction</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedStatusFilter === 'RETURNED'
                    ? 'bg-rose-900 text-rose-100'
                    : returnedCount > 0
                    ? 'bg-rose-200 text-rose-900 font-bold'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {returnedCount}
              </span>
            </button>

            {/* PENDING DEAN APPROVAL */}
            <button
              id="filter-status-pending"
              type="button"
              onClick={() => setSelectedStatusFilter('PENDING')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                selectedStatusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : pendingDeanCount > 0
                  ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>Pending Dean</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedStatusFilter === 'PENDING'
                    ? 'bg-amber-800 text-amber-100'
                    : pendingDeanCount > 0
                    ? 'bg-amber-200 text-amber-900 font-bold'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {pendingDeanCount}
              </span>
            </button>

            {/* APPROVED */}
            <button
              id="filter-status-approved"
              type="button"
              onClick={() => setSelectedStatusFilter('APPROVED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                selectedStatusFilter === 'APPROVED'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>Approved</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedStatusFilter === 'APPROVED'
                    ? 'bg-emerald-900 text-emerald-100'
                    : 'bg-stone-200 text-stone-700'
                }`}
              >
                {approvedCount}
              </span>
            </button>
          </div>

          {/* Reset Filters action */}
          {hasActiveFilters && (
            <button
              id="btn-reset-filters"
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset filters
            </button>
          )}
        </div>

        {/* Active Filter summary pill row when filters applied */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1.5 text-xs text-stone-600">
            <span className="font-medium text-stone-500">
              Showing <strong>{filteredRecords.length}</strong> of {records.length} records:
            </span>

            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-medium">
                {searchTarget === 'SCHOLAR'
                  ? 'Scholar: '
                  : searchTarget === 'REGISTRATION'
                  ? 'Reg No: '
                  : 'Search: '}
                &ldquo;{searchQuery}&rdquo;
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-amber-950 cursor-pointer ml-0.5"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {searchTarget !== 'ALL' && !searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200 text-[11px]">
                Target: {searchTarget === 'SCHOLAR' ? 'Scholar Name' : 'Registration No.'}
                <button
                  type="button"
                  onClick={() => setSearchTarget('ALL')}
                  className="hover:text-stone-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedStatusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200 text-[11px]">
                Status:{' '}
                {selectedStatusFilter === 'NEW'
                  ? 'New / In Verification'
                  : selectedStatusFilter === 'RETURNED'
                  ? 'Returned for Correction'
                  : selectedStatusFilter === 'PENDING'
                  ? 'Pending Dean Approval'
                  : 'Approved'}
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('ALL')}
                  className="hover:text-stone-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedStageFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200 text-[11px]">
                Stage: RPC {selectedStageFilter}
                <button
                  type="button"
                  onClick={() => setSelectedStageFilter('ALL')}
                  className="hover:text-stone-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedSchoolFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-200 text-[11px]">
                School: {selectedSchoolFilter}
                <button
                  type="button"
                  onClick={() => setSelectedSchoolFilter('ALL')}
                  className="hover:text-stone-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Table: Scholar | Registration No. | RPC No. | RPC Date | Status | Action */}
      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Scholar</th>
                <th className="py-3 px-4">Registration No.</th>
                <th className="py-3 px-4">RPC No.</th>
                <th className="py-3 px-4">RPC Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-stone-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                        <Search className="w-5 h-5" />
                      </div>
                      <div className="font-semibold text-stone-900 text-sm">
                        {searchQuery
                          ? `No RPC records found matching "${searchQuery}"`
                          : 'No matching RPC requests found'}
                      </div>
                      <p className="text-xs text-stone-500">
                        {searchQuery
                          ? `No matching records found for ${
                              searchTarget === 'SCHOLAR'
                                ? 'Scholar Name'
                                : searchTarget === 'REGISTRATION'
                                ? 'Registration Number'
                                : 'Scholar Name or Registration Number'
                            }. Check your spelling or clear the filter.`
                          : 'Try adjusting your search terms or clearing selected status and stage filters.'}
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        {searchQuery && (
                          <button
                            type="button"
                            id="btn-empty-clear-search"
                            onClick={() => setSearchQuery('')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Clear Search Term
                          </button>
                        )}
                        {hasActiveFilters && (
                          <button
                            type="button"
                            id="btn-empty-clear-filters"
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 transition cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Clear All Filters
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-stone-50 transition cursor-pointer"
                    onClick={() => onOpenRecord(rec.id)}
                  >
                    <td className="py-3.5 px-4 font-semibold text-stone-900">
                      <div>{highlightMatch(rec.scholarName, searchQuery)}</div>
                      <div className="text-[11px] font-normal text-stone-500">{rec.school}</div>
                      {rec.rpcMembers?.guide?.name && (
                        <div className="text-[10px] text-stone-400 font-normal mt-0.5">
                          Guide: {rec.rpcMembers.guide.name}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-stone-700 font-medium">
                      {highlightMatch(rec.enrollmentNo, searchQuery)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded text-xs">
                        RPC {rec.rpcNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-stone-600">
                      {rec.rpcDate
                        ? new Date(rec.rpcDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => onOpenRecord(rec.id)}
                          id={`btn-open-rpc-${rec.id}`}
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded border border-stone-300 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-stone-600" />
                          Open
                        </button>
                        <button
                          onClick={() => setRecordToDelete(rec)}
                          id={`btn-delete-rpc-${rec.id}`}
                          type="button"
                          title="Delete / Remove Record"
                          className="inline-flex items-center justify-center p-1.5 text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SDSR OFFICE AFTER APPROVAL Section */}
      {approvedRecords.length > 0 && (selectedStatusFilter === 'ALL' || selectedStatusFilter === 'APPROVED') && (
        <div className="mt-10 pt-6 border-t border-stone-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-stone-900">Approved RPC Records</h2>
              <p className="text-xs text-stone-500">
                Finalized letters signed and authorized by the Dean, SDSR
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmPurgeApproved(true)}
                id="btn-remove-all-approved-data"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-md transition cursor-pointer shadow-2xs"
                title="Remove and purge all approved RPC records from database"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Remove All Approved Data</span>
              </button>
              <button
                type="button"
                onClick={() => exportApprovedLettersToExcel(approvedRecords)}
                id="btn-unload-approved-letters-section"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition cursor-pointer shadow-2xs"
                title="Unload and export approved letter register into Excel spreadsheet (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Unload Approved Letters (.xlsx)</span>
              </button>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium border border-emerald-200">
                {approvedRecords.length} Finalized
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Scholar</th>
                    <th className="py-2.5 px-4">RPC Number</th>
                    <th className="py-2.5 px-4">RPC Date</th>
                    <th className="py-2.5 px-4">Approved by</th>
                    <th className="py-2.5 px-4">Approval Date</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-stone-800">
                  {approvedRecords.map((rec) => (
                    <tr key={`app-${rec.id}`} className="hover:bg-stone-50/70 transition">
                      <td className="py-3 px-4 font-medium text-stone-900">
                        <div>{highlightMatch(rec.scholarName, searchQuery)}</div>
                        <div className="text-[10px] font-mono text-stone-500">
                          {highlightMatch(rec.enrollmentNo, searchQuery)}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-700">RPC {rec.rpcNumber}</td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {rec.rpcDate ? new Date(rec.rpcDate).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 px-4 text-stone-700">
                        {rec.approvedBy ? rec.approvedBy.replace(/Prof\. \(Dr\.\) S\. O\. Junare/g, 'Dean, SDSR').replace(/Dean, SDSR \(Dean, SDSR\)/g, 'Dean, SDSR') : 'Dean, SDSR'}
                      </td>
                      <td className="py-3 px-4 font-mono text-stone-600">
                        {rec.approvedAt ? new Date(rec.approvedAt).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => onViewLetterModal(rec)}
                          id={`btn-view-approved-letter-${rec.id}`}
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-emerald-700" />
                          VIEW LETTER
                        </button>
                        <button
                          onClick={() => onViewLetterModal(rec, true)}
                          id={`btn-download-approved-letter-${rec.id}`}
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded transition cursor-pointer"
                          title="Download Approved RPC Letter as PDF"
                        >
                          <Download className="w-3 h-3 text-stone-600" />
                          DOWNLOAD
                        </button>
                        <button
                          onClick={() => setRecordToDelete(rec)}
                          id={`btn-delete-approved-rpc-${rec.id}`}
                          type="button"
                          title="Delete / Remove approved record"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          REMOVE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Purge All Approved Data */}
      {showConfirmPurgeApproved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-full shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900">Remove All Approved Data?</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Are you sure you want to remove all approved RPC evaluation records and letters from the system?
                  This will clear all Dean-approved letters and reset the scholar stage counter.
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-[11px] text-rose-800">
              This action will permanently delete approved RPC documents from the database.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmPurgeApproved(false)}
                disabled={isPurging}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeAllApproved}
                disabled={isPurging}
                id="btn-confirm-purge-approved"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isPurging ? 'Removing...' : 'Yes, Remove Approved Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Individual RPC Record */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-full shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900">Remove RPC Record?</h3>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Are you sure you want to remove <strong>RPC {recordToDelete.rpcNumber}</strong> for{' '}
                  <strong>{recordToDelete.scholarName}</strong> ({recordToDelete.enrollmentNo})?
                </p>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-[11px] text-stone-600 space-y-1">
              <div><strong>Status:</strong> {recordToDelete.status}</div>
              <div><strong>Scheduled:</strong> {recordToDelete.rpcDate || 'Not set'}</div>
              <div><strong>Venue:</strong> {recordToDelete.venue || 'Not set'}</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={isDeleting}
                id="btn-confirm-delete-record"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-md shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Removing...' : 'Remove Record'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

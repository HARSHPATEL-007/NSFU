import React, { useState, useEffect, useRef } from 'react';
import { Scholar, RpcMember, UserProfile, MeetingMode } from '../types';
import {
  getAllScholars,
  getAllMembers,
  validateRpcSequence,
  createNewRpcRequest,
} from '../services/dataService';
import {
  ExcelRosterCandidate,
  getLoadedExcelRosterCandidates,
  getSharedLoadedFiles,
  quickLoadSampleRosterShared,
  parseMultipleExcelFiles,
  setSharedLoadedData,
  getSharedLoadedSheets,
} from '../services/excelService';
import {
  X,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Building,
  FileSpreadsheet,
  Upload,
  Sparkles,
  Database,
  Layers,
  ArrowRight,
  Info,
  Loader2,
  FileCheck,
} from 'lucide-react';

interface NewRpcModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSuccess: (newRpcId: string) => void;
}

export const NewRpcModal: React.FC<NewRpcModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}) => {
  // Data Sources
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [members, setMembers] = useState<RpcMember[]>([]);
  const [excelCandidates, setExcelCandidates] = useState<ExcelRosterCandidate[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<'DATABASE' | 'EXCEL'>('DATABASE');

  // Database Scholar Form Selection
  const [selectedScholarId, setSelectedScholarId] = useState<string>('');

  // Excel Candidate Selection
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<ExcelRosterCandidate | null>(null);

  // Common Form Fields
  const [rpcNumber, setRpcNumber] = useState<number>(1);
  const [rpcDate, setRpcDate] = useState<string>('2025-10-15');
  const [meetingTime, setMeetingTime] = useState<string>('11:30 AM');
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('ONLINE');
  const [venue, setVenue] = useState<string>('online mode (Google Meet)');
  const [requestDetails, setRequestDetails] = useState<string>('');

  // Selected Committee Members
  const [selectedInternalId, setSelectedInternalId] = useState<string>('');
  const [selectedExternal1Id, setSelectedExternal1Id] = useState<string>('');
  const [selectedExternal2Id, setSelectedExternal2Id] = useState<string>('');

  // Sequence Validation State
  const [sequenceCheck, setSequenceCheck] = useState<{
    checked: boolean;
    isValid: boolean;
    permissible: number;
    message: string;
  }>({ checked: false, isValid: true, permissible: 1, message: '' });

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [excelSuccessNotice, setExcelSuccessNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener for Esc (close) and Ctrl+Enter / Cmd+Enter (submit)
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
        if (!loading && sequenceCheck.isValid) {
          const form = document.getElementById('form-new-rpc') as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, sequenceCheck.isValid]);

  // Initial Data Loader
  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  // Listen to shared Excel data updates across modals/components
  useEffect(() => {
    const handleSharedExcelUpdate = () => {
      if (scholars.length > 0) {
        const candidates = getLoadedExcelRosterCandidates(scholars);
        setExcelCandidates(candidates);
        if (candidates.length > 0 && selectedDataSource === 'EXCEL' && !selectedCandidateId) {
          selectExcelCandidate(candidates[0], scholars, members);
        }
      }
    };
    window.addEventListener('nfsu-excel-data-updated', handleSharedExcelUpdate);
    return () => window.removeEventListener('nfsu-excel-data-updated', handleSharedExcelUpdate);
  }, [scholars, members, selectedDataSource, selectedCandidateId]);

  const loadInitialData = async () => {
    try {
      const sList = await getAllScholars();
      const mList = await getAllMembers();
      setScholars(sList);
      setMembers(mList);

      // Check loaded Excel candidates
      const candidates = getLoadedExcelRosterCandidates(sList);
      setExcelCandidates(candidates);

      // Set default members
      const internal = mList.find((m) => m.memberType === 'INTERNAL');
      const ext1 = mList.find((m) => m.memberType === 'EXTERNAL_1');
      const ext2 = mList.find((m) => m.memberType === 'EXTERNAL_2');

      if (internal) setSelectedInternalId(internal.id);
      if (ext1) setSelectedExternal1Id(ext1.id);
      if (ext2) setSelectedExternal2Id(ext2.id);

      // If Excel candidates are available, prioritize using Excel roster data
      if (candidates.length > 0) {
        setSelectedDataSource('EXCEL');
        selectExcelCandidate(candidates[0], sList, mList);
      } else if (sList.length > 0) {
        const first = sList[0];
        setSelectedScholarId(first.id);
        checkSequence(first.id, first.currentRpcNo || 1);
      }

      // Restore user form draft if available to guarantee zero work lost
      try {
        const rawDraft = localStorage.getItem('nfsu_new_rpc_draft');
        if (rawDraft) {
          const draft = JSON.parse(rawDraft);
          if (draft) {
            if (draft.rpcDate) setRpcDate(draft.rpcDate);
            if (draft.meetingTime) setMeetingTime(draft.meetingTime);
            if (draft.meetingMode) setMeetingMode(draft.meetingMode);
            if (draft.venue) setVenue(draft.venue);
            if (draft.requestDetails) setRequestDetails(draft.requestDetails);
            if (draft.selectedInternalId) setSelectedInternalId(draft.selectedInternalId);
            if (draft.selectedExternal1Id) setSelectedExternal1Id(draft.selectedExternal1Id);
            if (draft.selectedExternal2Id) setSelectedExternal2Id(draft.selectedExternal2Id);
          }
        }
      } catch (e) {}
    } catch (err: any) {
      console.warn('Error loading initial modal data:', err);
    }
  };

  // Auto-save form draft whenever inputs change to ensure work is never lost
  useEffect(() => {
    if (!isOpen) return;
    try {
      const draft = {
        selectedDataSource,
        selectedScholarId,
        selectedCandidateId,
        rpcNumber,
        rpcDate,
        meetingTime,
        meetingMode,
        venue,
        requestDetails,
        selectedInternalId,
        selectedExternal1Id,
        selectedExternal2Id,
      };
      localStorage.setItem('nfsu_new_rpc_draft', JSON.stringify(draft));
    } catch (e) {}
  }, [
    isOpen,
    selectedDataSource,
    selectedScholarId,
    selectedCandidateId,
    rpcNumber,
    rpcDate,
    meetingTime,
    meetingMode,
    venue,
    requestDetails,
    selectedInternalId,
    selectedExternal1Id,
    selectedExternal2Id,
  ]);

  // Helper to match member by name
  const findMatchingMember = (
    nameQuery: string | undefined,
    memberType: 'INTERNAL' | 'EXTERNAL_1' | 'EXTERNAL_2',
    allMembers: RpcMember[]
  ): RpcMember | undefined => {
    if (!nameQuery) {
      return allMembers.find((m) => m.memberType === memberType);
    }
    const cleanQuery = nameQuery.toLowerCase().replace(/^dr\.\s*|^prof\.\s*|\(dr\.\)\s*/i, '').trim();
    const match = allMembers.find(
      (m) =>
        m.memberType === memberType &&
        (m.name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(m.name.toLowerCase()))
    );
    return match || allMembers.find((m) => m.memberType === memberType);
  };

  // Select an Excel candidate and auto-fill all form fields
  const selectExcelCandidate = (
    candidate: ExcelRosterCandidate,
    currentScholars: Scholar[] = scholars,
    currentMembers: RpcMember[] = members
  ) => {
    setSelectedCandidateId(candidate.id);
    setSelectedCandidate(candidate);

    // Auto-fill RPC stage & scheduling details
    setRpcNumber(candidate.rpcNumber);
    setRpcDate(candidate.rpcDate || new Date().toISOString().split('T')[0]);
    setMeetingTime(candidate.meetingTime || '11:30 AM');
    setMeetingMode(candidate.meetingMode || 'ONLINE');
    setVenue(candidate.venue || 'SDSR Board Room / Google Meet');
    setRequestDetails(
      candidate.notes ||
        `${candidate.rpcNumber}th RPC evaluation for Ph.D. Scholar ${candidate.scholarName} (${candidate.school}).`
    );

    // Auto-match committee members from Excel row
    const matchedInternal = findMatchingMember(candidate.internalExpertName, 'INTERNAL', currentMembers);
    const matchedExt1 = findMatchingMember(candidate.externalExpert1Name, 'EXTERNAL_1', currentMembers);
    const matchedExt2 = findMatchingMember(candidate.externalExpert2Name, 'EXTERNAL_2', currentMembers);

    if (matchedInternal) setSelectedInternalId(matchedInternal.id);
    if (matchedExt1) setSelectedExternal1Id(matchedExt1.id);
    if (matchedExt2) setSelectedExternal2Id(matchedExt2.id);

    // Check Sequence
    if (candidate.matchedScholarId) {
      setSelectedScholarId(candidate.matchedScholarId);
      checkSequence(candidate.matchedScholarId, candidate.rpcNumber);
    } else {
      setSelectedScholarId('');
      setSequenceCheck({
        checked: true,
        isValid: true,
        permissible: candidate.rpcNumber,
        message: `New scholar from Excel roster. Initiating RPC ${candidate.rpcNumber}.`,
      });
    }

    setExcelSuccessNotice(
      `Auto-filled from Excel: "${candidate.sourceSheetName}" (${candidate.scholarName} — RPC ${candidate.rpcNumber})`
    );
    setTimeout(() => setExcelSuccessNotice(null), 4000);
  };

  const checkSequence = async (scholarId: string, rpcNum: number) => {
    try {
      const res = await validateRpcSequence(scholarId, rpcNum);
      setRpcNumber(res.permissibleRpcNumber);
      setSequenceCheck({
        checked: true,
        isValid: res.isValid,
        permissible: res.permissibleRpcNumber,
        message: res.message,
      });
    } catch (err: any) {
      console.warn('Sequence validation error:', err);
    }
  };

  // Change Database Scholar
  const handleScholarChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schId = e.target.value;
    setSelectedScholarId(schId);
    const sch = scholars.find((s) => s.id === schId);
    if (sch) {
      checkSequence(sch.id, sch.currentRpcNo || 1);
    }
  };

  // Quick Load Multi-Sheet Sample Roster
  const handleQuickLoadSampleRoster = async () => {
    setIsUploadingExcel(true);
    setErrorMessage('');
    try {
      const { candidates } = await quickLoadSampleRosterShared(scholars);
      setExcelCandidates(candidates);
      setSelectedDataSource('EXCEL');
      if (candidates.length > 0) {
        selectExcelCandidate(candidates[0]);
      }
    } catch (err: any) {
      console.error('Error loading sample roster:', err);
      setErrorMessage(err.message || 'Failed to load sample roster.');
    } finally {
      setIsUploadingExcel(false);
    }
  };

  // Load custom Excel file directly inside modal
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingExcel(true);
    setErrorMessage('');

    try {
      const existingSheets = getSharedLoadedSheets();
      const res = await parseMultipleExcelFiles([file], scholars);
      const combinedSheets = [...existingSheets, ...res.sheets];
      const combinedFiles = [...getSharedLoadedFiles(), ...res.files];

      setSharedLoadedData(combinedFiles, combinedSheets);
      const candidates = getLoadedExcelRosterCandidates(scholars);
      setExcelCandidates(candidates);
      setSelectedDataSource('EXCEL');

      if (candidates.length > 0) {
        selectExcelCandidate(candidates[0]);
      }
    } catch (err: any) {
      console.error('Excel file reading error:', err);
      setErrorMessage(err.message || 'Failed to read Excel file. Please check file format.');
    } finally {
      setIsUploadingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const internalExp = members.find((m) => m.id === selectedInternalId);
      const ext1Exp = members.find((m) => m.id === selectedExternal1Id);
      const ext2Exp = members.find((m) => m.id === selectedExternal2Id);

      if (!internalExp || !ext1Exp || !ext2Exp) {
        throw new Error('Please assign all required committee members (Internal, External 1, External 2).');
      }

      let targetScholar: Scholar;
      let effectiveScholarId: string;

      if (selectedDataSource === 'EXCEL') {
        if (!selectedCandidate) {
          throw new Error('Please select a candidate from the loaded Excel roster.');
        }

        if (selectedCandidate.matchedScholarId) {
          const dbSch = scholars.find((s) => s.id === selectedCandidate.matchedScholarId);
          if (!dbSch) throw new Error('Matched scholar record not found in system.');
          targetScholar = dbSch;
          effectiveScholarId = dbSch.id;
        } else {
          // Construct new scholar object from Excel data
          const newId = `sch-${selectedCandidate.enrollmentNo.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now()}`;
          targetScholar = {
            id: newId,
            name: selectedCandidate.scholarName,
            enrollmentNo: selectedCandidate.enrollmentNo,
            school: selectedCandidate.school,
            department: selectedCandidate.department || selectedCandidate.school,
            guideName: selectedCandidate.guideName,
            guideDesignation: selectedCandidate.guideDesignation || 'Professor',
            guideEmail:
              selectedCandidate.guideEmail ||
              `${selectedCandidate.guideName.toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`,
            guideSchool: selectedCandidate.guideSchool || selectedCandidate.school,
            registrationDate: new Date().toISOString().split('T')[0],
            researchTopic: selectedCandidate.notes || 'Doctoral Research Study at NFSU',
            currentRpcNo: rpcNumber,
            status: 'ACTIVE',
            contactDetails: {
              email: `${selectedCandidate.enrollmentNo.toLowerCase()}@nfsu.ac.in`,
              phone: '+91-9800000000',
              address: 'NFSU Gandhinagar Campus, Sector-9, Gandhinagar 382007',
            },
            academicDetails: {
              qualifyingDegree: "Master's Degree",
              university: 'Recognized University',
              yearOfPassing: String(new Date().getFullYear() - 1),
              category: 'Regular Full-Time',
            },
          };
          effectiveScholarId = newId;
        }
      } else {
        const dbSch = scholars.find((s) => s.id === selectedScholarId);
        if (!dbSch) throw new Error('Please select a scholar.');
        targetScholar = dbSch;
        effectiveScholarId = dbSch.id;
      }

      // Guide member
      const guideMember: RpcMember = {
        id: `guide-${targetScholar.id}`,
        name: targetScholar.guideName,
        designation: targetScholar.guideDesignation,
        department: targetScholar.department,
        schoolOrInstitution: targetScholar.guideSchool || targetScholar.school,
        location: 'NFSU Gandhinagar',
        email: targetScholar.guideEmail,
        memberType: 'GUIDE',
        addressLine1: targetScholar.guideDesignation,
        addressLine2: targetScholar.guideSchool || targetScholar.school,
        addressLine3: 'NFSU, Gandhinagar',
      };

      const newRecord = await createNewRpcRequest(
        effectiveScholarId,
        rpcNumber,
        rpcDate,
        meetingTime,
        meetingMode,
        venue,
        {
          guide: guideMember,
          internalExpert: internalExp,
          externalExpert1: ext1Exp,
          externalExpert2: ext2Exp,
        },
        requestDetails || `${rpcNumber}th Research Progress Committee (RPC) Meeting request.`,
        currentUser,
        selectedDataSource === 'EXCEL' && !selectedCandidate?.matchedScholarId ? targetScholar : undefined
      );

      // Successfully saved and created, clear draft
      try {
        localStorage.removeItem('nfsu_new_rpc_draft');
      } catch (e) {}

      onSuccess(newRecord.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating RPC request.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentDbScholar = scholars.find((s) => s.id === selectedScholarId);
  const loadedFiles = getSharedLoadedFiles();

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-stone-200 overflow-hidden">
        {/* Hidden File Input for Excel loading */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
          id="modal-excel-file-input"
        />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#15244C] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              RPC
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">+ New RPC Request</h2>
              <p className="text-xs text-stone-500">
                Office of SDSR — Ph.D. Research Progress Committee Initiation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-700 p-1.5 rounded-md transition cursor-pointer"
            aria-label="Close"
            title="Close modal (Esc)"
          >
            <kbd className="hidden sm:inline-block text-[10px] bg-white text-stone-500 border border-stone-300 px-1.5 py-0.5 rounded font-mono">
              Esc
            </kbd>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Data Source Selector & Excel Quick Actions */}
        <div className="px-6 pt-4 pb-3 bg-stone-100/70 border-b border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Toggle: Database Scholars vs Excel Roster */}
            <div className="inline-flex p-1 bg-white rounded-lg border border-stone-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedDataSource('DATABASE')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  selectedDataSource === 'DATABASE'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Registered Scholars ({scholars.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedDataSource('EXCEL');
                  if (excelCandidates.length > 0 && !selectedCandidateId) {
                    selectExcelCandidate(excelCandidates[0]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  selectedDataSource === 'EXCEL'
                    ? 'bg-[#15244C] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Use Loaded Excel Data ({excelCandidates.length})</span>
                {excelCandidates.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* Quick Excel Load Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingExcel}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-md shadow-2xs transition cursor-pointer disabled:opacity-60"
                title="Upload custom Excel or CSV roster file"
              >
                {isUploadingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-stone-600" />
                )}
                <span>Load File</span>
              </button>

              <button
                type="button"
                onClick={handleQuickLoadSampleRoster}
                disabled={isUploadingExcel}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md shadow-2xs transition cursor-pointer disabled:opacity-60"
                title="Quickly load sample multi-sheet roster (SPH, SFS, Registrations)"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sample Roster</span>
              </button>
            </div>
          </div>

          {/* Active Excel Banner */}
          {selectedDataSource === 'EXCEL' && excelCandidates.length > 0 && (
            <div className="mt-2.5 p-2 bg-emerald-50/80 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  <strong>Excel Data Active:</strong> {excelCandidates.length} candidate(s) loaded across{' '}
                  {loadedFiles.length || 1} file(s). Select any candidate below to auto-populate the request!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Form */}
        <form id="form-new-rpc" onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {excelSuccessNotice && (
            <div className="p-2.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-md flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{excelSuccessNotice}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* SOURCE 1: LOADED EXCEL ROSTER CANDIDATES                       */}
          {/* ============================================================== */}
          {selectedDataSource === 'EXCEL' && (
            <div className="space-y-3">
              {excelCandidates.length === 0 ? (
                /* Empty Excel state */
                <div className="p-6 border-2 border-dashed border-stone-300 rounded-lg text-center bg-stone-50 space-y-3">
                  <FileSpreadsheet className="w-10 h-10 text-stone-400 mx-auto" />
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">No Excel Roster Data Loaded Yet</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      Upload an official roster (.xlsx, .xls, .csv) or click "Sample Roster" to load test doctoral candidates.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-md shadow-xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Browse Excel File
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickLoadSampleRoster}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Quick Load Sample Roster
                    </button>
                  </div>
                </div>
              ) : (
                /* Candidate Selection from Excel */
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-stone-700">
                        Select Scholar / RPC Entry from Loaded Excel Data *
                      </label>
                      <span className="text-[11px] text-stone-500">
                        {excelCandidates.length} candidate(s) loaded
                      </span>
                    </div>

                    <select
                      value={selectedCandidateId}
                      onChange={(e) => {
                        const cand = excelCandidates.find((c) => c.id === e.target.value);
                        if (cand) selectExcelCandidate(cand);
                      }}
                      id="select-excel-candidate"
                      className="w-full text-sm rounded-md border border-stone-300 p-2.5 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-stone-500 font-medium"
                      required
                    >
                      {excelCandidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.scholarName} ({c.enrollmentNo || 'No Enroll'}) — {c.school} • [RPC {c.rpcNumber}] ({c.sourceSheetName})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Candidate Summary Card */}
                  {selectedCandidate && (
                    <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#15244C] text-[13px]">
                          {selectedCandidate.scholarName}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#15244C] text-white">
                          <FileSpreadsheet className="w-3 h-3" />
                          Sheet: {selectedCandidate.sourceSheetName}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-700 pt-1">
                        <div>
                          <span className="text-stone-500">Enrollment No: </span>
                          <span className="font-semibold text-stone-900">{selectedCandidate.enrollmentNo || '—'}</span>
                        </div>
                        <div>
                          <span className="text-stone-500">Guide / Supervisor: </span>
                          <span className="font-semibold text-stone-900">{selectedCandidate.guideName}</span>
                        </div>
                        <div>
                          <span className="text-stone-500">School / Department: </span>
                          <span className="font-medium text-stone-800">{selectedCandidate.school}</span>
                        </div>
                        <div>
                          <span className="text-stone-500">System Status: </span>
                          {selectedCandidate.isExistingInDb ? (
                            <span className="font-semibold text-emerald-700">Matched in Database</span>
                          ) : (
                            <span className="font-semibold text-amber-700">✨ New Scholar Registration</span>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between">
                        <span className="font-semibold text-stone-700">Excel Proposed RPC Stage:</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          RPC {rpcNumber} ({sequenceCheck.message || 'Next Permissible'})
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* SOURCE 2: DATABASE REGISTERED SCHOLARS                         */}
          {/* ============================================================== */}
          {selectedDataSource === 'DATABASE' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Select Ph.D. Research Scholar (from Database) *
                </label>
                <select
                  value={selectedScholarId}
                  onChange={handleScholarChange}
                  id="select-scholar"
                  className="w-full text-sm rounded-md border border-stone-300 p-2.5 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-stone-500"
                  required
                >
                  {scholars.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.enrollmentNo}) — {s.school}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scholar Meta & RPC Sequencing Info */}
              {currentDbScholar && (
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between items-center text-stone-600">
                    <span>Supervisor / Guide:</span>
                    <span className="font-semibold text-stone-900">{currentDbScholar.guideName}</span>
                  </div>
                  <div className="flex justify-between items-center text-stone-600">
                    <span>Enrolled School:</span>
                    <span className="font-medium text-stone-800">{currentDbScholar.school}</span>
                  </div>
                  <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
                    <span className="font-semibold text-stone-700">Enforced RPC Stage:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      RPC {sequenceCheck.permissible} (Next Permissible)
                    </span>
                  </div>
                  {sequenceCheck.message && (
                    <p className="text-[11px] text-stone-500 pt-1 italic">{sequenceCheck.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* COMMON SCHEDULING DETAILS                                      */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>RPC Scheduled Date *</span>
              </label>
              <input
                type="date"
                value={rpcDate}
                onChange={(e) => setRpcDate(e.target.value)}
                id="input-rpc-date"
                className="w-full text-sm rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Meeting Time *</span>
              </label>
              <input
                type="text"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                placeholder="e.g. 11:30 AM / 12:00 Noon"
                id="input-rpc-time"
                className="w-full text-sm rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Meeting Mode *
              </label>
              <select
                value={meetingMode}
                onChange={(e) => setMeetingMode(e.target.value as MeetingMode)}
                id="select-rpc-mode"
                className="w-full text-sm rounded-md border border-stone-300 p-2 bg-white text-stone-900 focus:outline-hidden"
              >
                <option value="ONLINE">Online Mode</option>
                <option value="OFFLINE">Offline (In-Person)</option>
                <option value="HYBRID">Hybrid Mode</option>
              </select>
            </div>
          </div>

          {/* Venue / Meeting Link */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Venue or Meeting Platform / Link
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Google Meet: meet.google.com/nfs-sdsr-rpc / SDSR Board Room 102"
              id="input-rpc-venue"
              className="w-full text-sm rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden"
            />
          </div>

          {/* ============================================================== */}
          {/* PROPOSED COMMITTEE MEMBERS                                     */}
          {/* ============================================================== */}
          <div className="pt-2 border-t border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                Proposed Committee Members
              </h3>
              {selectedDataSource === 'EXCEL' && (
                <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Auto-mapped from Excel roster
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  Internal Expert *
                </label>
                <select
                  value={selectedInternalId}
                  onChange={(e) => setSelectedInternalId(e.target.value)}
                  id="select-internal-expert"
                  className="w-full text-xs rounded-md border border-stone-300 p-2 bg-white text-stone-900 focus:outline-hidden"
                  required
                >
                  {members
                    .filter((m) => m.memberType === 'INTERNAL')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.designation})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  External Expert 1 *
                </label>
                <select
                  value={selectedExternal1Id}
                  onChange={(e) => setSelectedExternal1Id(e.target.value)}
                  id="select-external-expert-1"
                  className="w-full text-xs rounded-md border border-stone-300 p-2 bg-white text-stone-900 focus:outline-hidden"
                  required
                >
                  {members
                    .filter((m) => m.memberType === 'EXTERNAL_1')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.schoolOrInstitution})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-stone-600 mb-1">
                  External Expert 2 *
                </label>
                <select
                  value={selectedExternal2Id}
                  onChange={(e) => setSelectedExternal2Id(e.target.value)}
                  id="select-external-expert-2"
                  className="w-full text-xs rounded-md border border-stone-300 p-2 bg-white text-stone-900 focus:outline-hidden"
                  required
                >
                  {members
                    .filter((m) => m.memberType === 'EXTERNAL_2')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.schoolOrInstitution})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Request Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Request Notes / Synopsis / Ph.D. Cell Reference Details
            </label>
            <textarea
              value={requestDetails}
              onChange={(e) => setRequestDetails(e.target.value)}
              rows={2}
              id="input-rpc-notes"
              placeholder="e.g. Research progress synopsis received, verified by Guide for progress evaluation."
              className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-md border border-stone-300 transition cursor-pointer"
            >
              <span>Cancel</span>
              <kbd className="font-mono text-[10px] bg-stone-100 text-stone-500 border border-stone-300 px-1 py-0.2 rounded">
                Esc
              </kbd>
            </button>
            <button
              type="submit"
              disabled={loading || (selectedDataSource === 'EXCEL' && excelCandidates.length === 0)}
              id="btn-submit-new-rpc"
              title="Initiate RPC Request (Ctrl+Enter / Cmd+Enter)"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Request...</span>
                </>
              ) : (
                <>
                  <span>
                    {selectedDataSource === 'EXCEL'
                      ? 'Initiate RPC Request from Excel Data'
                      : 'Initiate RPC Request'}
                  </span>
                  <kbd className="hidden sm:inline-block font-mono text-[10px] bg-stone-700 text-stone-200 border border-stone-600 px-1 py-0.2 rounded">
                    Ctrl+↵
                  </kbd>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

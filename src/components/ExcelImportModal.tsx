import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Scholar, RpcRecord, UserProfile, OfficialLetterData } from '../types';
import {
  parseExcelFile,
  downloadExcelTemplate,
  ExcelParseResult,
  matchStudentData,
  StudentMatchItem,
  exportMatchedStudentsToExcel,
  exportApprovedLettersToExcel,
  exportAllRpcRecordsToExcel,
  createSampleRosterExcelFile,
  LoadedExcelSheet,
  LoadedExcelFile,
  parseMultipleExcelFiles,
  aggregateActiveSheets,
  exportMultiSheetExcelWorkbook,
} from '../services/excelService';
import { bulkImportScholarsAndRpc, prepareAndApproveRpcLetter } from '../services/dataService';
import { OfficialRpcLetter } from './OfficialRpcLetter';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Eye,
  Printer,
  Sparkles,
  Trash2,
  ChevronRight,
  CheckSquare,
  Square,
  Building2,
  UserCheck,
  Clock,
  Send,
  Loader2,
  FolderPlus,
  ToggleLeft,
  ToggleRight,
  FileCheck,
} from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  existingScholars: Scholar[];
  existingRecords?: RpcRecord[];
  onImportComplete: (summary: { scholarsAdded: number; scholarsUpdated: number; rpcAdded: number }) => void;
  onViewLetterModal?: (record: RpcRecord) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  existingScholars,
  existingRecords = [],
  onImportComplete,
  onViewLetterModal,
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'LOAD' | 'MATCHING' | 'PREPARE_LETTER' | 'UNLOAD'>('LOAD');

  // Multi-File & Multi-Sheet State
  const [dragActive, setDragActive] = useState(false);
  const [loadedFiles, setLoadedFiles] = useState<LoadedExcelFile[]>([]);
  const [loadedSheets, setLoadedSheets] = useState<LoadedExcelSheet[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSheetFilter, setSelectedSheetFilter] = useState<string>('ALL');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Student Matching State
  const [matchedStudents, setMatchedStudents] = useState<StudentMatchItem[]>([]);
  const [matchingSearch, setMatchingSearch] = useState('');
  const [matchingStatusFilter, setMatchingStatusFilter] = useState<'ALL' | 'MATCHED' | 'NEW' | 'DISCREPANCY'>('ALL');
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());

  // Letter Preparation Form State
  const [targetStudentForLetter, setTargetStudentForLetter] = useState<StudentMatchItem | null>(null);
  const [letterRefNo, setLetterRefNo] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('11:00 AM IST');
  const [meetingMode, setMeetingMode] = useState<'ONLINE' | 'OFFLINE' | 'HYBRID'>('ONLINE');
  const [meetingVenue, setMeetingVenue] = useState('SDSR Board Room / Google Meet: meet.google.com/nfs-sdsr-rpc');
  const [internalExpert, setInternalExpert] = useState('Dr. Bhoomika Patel');
  const [externalExpert1, setExternalExpert1] = useState('Dr. Dhiraj Bhatia');
  const [externalExpert2, setExternalExpert2] = useState('Prof. (Dr.) Sanjay K. Jain');
  const [isProcessingLetter, setIsProcessingLetter] = useState(false);
  const [generatedLetterRecord, setGeneratedLetterRecord] = useState<RpcRecord | null>(null);
  const [letterSuccessNotice, setLetterSuccessNotice] = useState<string | null>(null);

  // Bulk operation status
  const [isCommittingAll, setIsCommittingAll] = useState(false);
  const [commitSummary, setCommitSummary] = useState<{
    scholarsAdded: number;
    scholarsUpdated: number;
    rpcAdded: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCommittingAll && !isProcessingLetter) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCommittingAll, isProcessingLetter, onClose]);

  // When loadedSheets change, recompute aggregated result and run multi-sheet student matching
  useEffect(() => {
    const activeSheets = loadedSheets.filter((s) => s.isLoaded);
    if (activeSheets.length > 0) {
      const aggregated = aggregateActiveSheets(loadedSheets);
      setParseResult(aggregated);
      const matches = matchStudentData(activeSheets, existingScholars, existingRecords);
      setMatchedStudents(matches);

      // Auto-select matched items by default
      const initialSelected = new Set<string>();
      matches.forEach((m) => {
        if (m.matchStatus !== 'NEW_STUDENT') {
          initialSelected.add(m.id);
        }
      });
      setSelectedMatchIds(initialSelected);
    } else {
      setParseResult(null);
      setMatchedStudents([]);
      setSelectedMatchIds(new Set());
    }
  }, [loadedSheets, existingScholars, existingRecords]);

  // Filtered matched students (accounting for sheet filter, search query, and matching status)
  const filteredMatches = useMemo(() => {
    return matchedStudents.filter((item) => {
      // Sheet filter
      if (selectedSheetFilter !== 'ALL') {
        const matchesSheet =
          item.sourceSheetId === selectedSheetFilter ||
          item.sourceSheetName === selectedSheetFilter;
        if (!matchesSheet) return false;
      }

      // Search filter
      if (matchingSearch.trim()) {
        const query = matchingSearch.toLowerCase();
        const matchesQuery =
          item.scholarName.toLowerCase().includes(query) ||
          item.enrollmentNo.toLowerCase().includes(query) ||
          item.school.toLowerCase().includes(query) ||
          item.guideName.toLowerCase().includes(query) ||
          (item.sourceSheetName && item.sourceSheetName.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      // Status filter
      if (matchingStatusFilter === 'MATCHED') {
        if (item.matchStatus === 'NEW_STUDENT') return false;
      } else if (matchingStatusFilter === 'NEW') {
        if (item.matchStatus !== 'NEW_STUDENT') return false;
      } else if (matchingStatusFilter === 'DISCREPANCY') {
        if (item.discrepancies.length === 0) return false;
      }

      return true;
    });
  }, [matchedStudents, selectedSheetFilter, matchingSearch, matchingStatusFilter]);

  // Matching Statistics
  const matchStats = useMemo(() => {
    const total = matchedStudents.length;
    const exact = matchedStudents.filter((m) => m.matchStatus === 'EXACT_MATCH').length;
    const nameOnly = matchedStudents.filter((m) => m.matchStatus === 'NAME_MATCH').length;
    const newStudents = matchedStudents.filter((m) => m.matchStatus === 'NEW_STUDENT').length;
    const discrepancies = matchedStudents.filter((m) => m.discrepancies.length > 0).length;
    const lettersApproved = matchedStudents.filter((m) => m.hasExistingApprovedLetter).length;
    return {
      total,
      matched: exact + nameOnly,
      exact,
      nameOnly,
      newStudents,
      discrepancies,
      lettersApproved,
    };
  }, [matchedStudents]);

  // Granular Unload Handler: Unload / Remove an individual sheet
  const handleUnloadSingleSheet = (sheetId: string) => {
    setLoadedSheets((prev) => prev.filter((s) => s.id !== sheetId));
    setLoadedFiles((prevFiles) =>
      prevFiles
        .map((f) => ({
          ...f,
          sheets: f.sheets.filter((s) => s.id !== sheetId),
        }))
        .filter((f) => f.sheets.length > 0)
    );
    if (selectedSheetFilter === sheetId) {
      setSelectedSheetFilter('ALL');
    }
  };

  // Toggle Sheet Active/Inactive (loaded vs unloaded state)
  const handleToggleSheet = (sheetId: string) => {
    setLoadedSheets((prev) =>
      prev.map((s) => (s.id === sheetId ? { ...s, isLoaded: !s.isLoaded } : s))
    );
  };

  // Unload / Remove an entire file and all its sheets
  const handleUnloadSingleFile = (fileId: string) => {
    setLoadedSheets((prev) => prev.filter((s) => s.fileId !== fileId));
    setLoadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    setSelectedSheetFilter('ALL');
  };

  // Complete Unload / Reset of all staged files and sheets
  const handleUnloadAll = () => {
    setLoadedFiles([]);
    setLoadedSheets([]);
    setSelectedFile(null);
    setParseResult(null);
    setParseError(null);
    setCommitSummary(null);
    setMatchedStudents([]);
    setSelectedMatchIds(new Set());
    setTargetStudentForLetter(null);
    setGeneratedLetterRecord(null);
    setLetterSuccessNotice(null);
    setSelectedSheetFilter('ALL');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveTab('LOAD');
  };

  // Process single or multiple files
  const processFiles = async (files: File[], append = false) => {
    if (!files || files.length === 0) return;
    setIsParsing(true);
    setParseError(null);
    setCommitSummary(null);
    setLetterSuccessNotice(null);

    try {
      const validFiles: File[] = [];
      for (const f of files) {
        const name = f.name.toLowerCase();
        if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
          validFiles.push(f);
        }
      }

      if (validFiles.length === 0) {
        setParseError('Please upload valid Excel spreadsheets (.xlsx, .xls) or CSV files.');
        setIsParsing(false);
        return;
      }

      const { files: newFiles, sheets: newSheets } = await parseMultipleExcelFiles(
        validFiles,
        existingScholars
      );

      if (newSheets.length === 0) {
        setParseError('The selected file(s) did not contain recognizable Ph.D. scholar or RPC data sheets.');
        setIsParsing(false);
        return;
      }

      if (append) {
        setLoadedFiles((prev) => [...prev, ...newFiles]);
        setLoadedSheets((prev) => [...prev, ...newSheets]);
      } else {
        setLoadedFiles(newFiles);
        setLoadedSheets(newSheets);
      }

      if (validFiles.length > 0) {
        setSelectedFile(validFiles[0]);
      }
    } catch (err: any) {
      console.error('Multi-file parsing error:', err);
      setParseError(err.message || 'Failed to read and parse Excel file(s). Please verify file formats.');
    } finally {
      setIsParsing(false);
    }
  };

  // Quick load sample multi-sheet roster (3 distinct sheets)
  const handleQuickLoadSample = async () => {
    const sampleFile = createSampleRosterExcelFile();
    await processFiles([sampleFile], false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      processFiles(filesArray, loadedFiles.length > 0);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      processFiles(filesArray, loadedFiles.length > 0);
    }
  };

  // Selection toggle
  const toggleSelectMatch = (id: string) => {
    const next = new Set(selectedMatchIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMatchIds(next);
  };

  const toggleSelectAllMatches = () => {
    if (selectedMatchIds.size === filteredMatches.length) {
      setSelectedMatchIds(new Set());
    } else {
      setSelectedMatchIds(new Set(filteredMatches.map((m) => m.id)));
    }
  };

  // Launch Letter Preparation for an individual matched student
  const handleOpenLetterPreparation = (student: StudentMatchItem) => {
    setTargetStudentForLetter(student);
    setLetterRefNo(
      student.approvedLetterRef ||
      `NFSU/SDSR/Ph.D./RPC-0${student.rpcNumber}/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`
    );
    setLetterDate(new Date().toLocaleDateString('en-GB'));
    setMeetingDate(student.rpcDate || new Date().toISOString().split('T')[0]);
    setMeetingTime(student.meetingTime || '11:00 AM IST');
    setMeetingMode(student.meetingMode || 'ONLINE');
    setMeetingVenue(student.venue || 'SDSR Board Room / Google Meet');
    setInternalExpert(student.internalExpertName || 'Dr. Bhoomika Patel');
    setExternalExpert1(student.externalExpert1Name || 'Dr. Dhiraj Bhatia');
    setExternalExpert2(student.externalExpert2Name || 'Prof. (Dr.) Sanjay K. Jain');
    setGeneratedLetterRecord(null);
    setLetterSuccessNotice(null);
    setActiveTab('PREPARE_LETTER');
  };

  // Execute Letter Preparation (Save as Approved or Draft)
  const handleExecutePrepareLetter = async (markApprovedImmediately: boolean) => {
    if (!targetStudentForLetter) return;
    setIsProcessingLetter(true);
    setLetterSuccessNotice(null);

    try {
      const savedRecord = await prepareAndApproveRpcLetter(
        {
          enrollmentNo: targetStudentForLetter.enrollmentNo,
          scholarName: targetStudentForLetter.scholarName,
          school: targetStudentForLetter.school,
          department: targetStudentForLetter.department,
          guideName: targetStudentForLetter.guideName,
          guideDesignation: targetStudentForLetter.guideDesignation,
          guideEmail: targetStudentForLetter.guideEmail,
        },
        targetStudentForLetter.rpcNumber,
        {
          rpcDate: meetingDate,
          meetingTime,
          meetingMode,
          venue: meetingVenue,
        },
        {
          internalExpertName: internalExpert,
          externalExpert1Name: externalExpert1,
          externalExpert2Name: externalExpert2,
        },
        letterRefNo,
        currentUser,
        markApprovedImmediately
      );

      setGeneratedLetterRecord(savedRecord);
      setLetterSuccessNotice(
        markApprovedImmediately
          ? `Official Approved Letter successfully finalized and authorized by Dean, SDSR! Document Ref: ${savedRecord.approvedDocumentReference}`
          : `Official RPC Letter draft saved and submitted for Dean SDSR review.`
      );

      // Update student matching item state
      setMatchedStudents((prev) =>
        prev.map((item) =>
          item.id === targetStudentForLetter.id
            ? {
                ...item,
                hasExistingApprovedLetter: markApprovedImmediately,
                approvedLetterRef: savedRecord.approvedDocumentReference || savedRecord.letterData?.refNo,
                existingRpcRecord: savedRecord,
              }
            : item
        )
      );

      // Refresh parent app records
      onImportComplete({ scholarsAdded: 0, scholarsUpdated: 1, rpcAdded: 1 });
    } catch (err: any) {
      console.error('Error preparing approved letter:', err);
      alert(`Failed to prepare approved letter: ${err.message || err}`);
    } finally {
      setIsProcessingLetter(false);
    }
  };

  // Batch Prepare Approved Letters for all selected matched students
  const handleBatchPrepareApprovedLetters = async () => {
    const selectedStudents = matchedStudents.filter((m) => selectedMatchIds.has(m.id));
    if (selectedStudents.length === 0) {
      alert('Please select at least one matched student to prepare approved letters.');
      return;
    }

    const confirmed = window.confirm(
      `Prepare and officially approve RPC letters for ${selectedStudents.length} selected student(s) with Dean, SDSR authorization?`
    );
    if (!confirmed) return;

    setIsProcessingLetter(true);
    let preparedCount = 0;

    try {
      for (const student of selectedStudents) {
        const refNo = `NFSU/SDSR/Ph.D./RPC-0${student.rpcNumber}/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;
        await prepareAndApproveRpcLetter(
          {
            enrollmentNo: student.enrollmentNo,
            scholarName: student.scholarName,
            school: student.school,
            department: student.department,
            guideName: student.guideName,
            guideDesignation: student.guideDesignation,
            guideEmail: student.guideEmail,
          },
          student.rpcNumber,
          {
            rpcDate: student.rpcDate || new Date().toISOString().split('T')[0],
            meetingTime: student.meetingTime || '11:00 AM IST',
            meetingMode: student.meetingMode || 'ONLINE',
            venue: student.venue || 'SDSR Board Room / Google Meet',
          },
          {
            internalExpertName: student.internalExpertName || 'Dr. Bhoomika Patel',
            externalExpert1Name: student.externalExpert1Name || 'Dr. Dhiraj Bhatia',
            externalExpert2Name: student.externalExpert2Name || 'Prof. (Dr.) Sanjay K. Jain',
          },
          refNo,
          currentUser,
          true // Mark approved immediately
        );
        preparedCount++;
      }

      onImportComplete({ scholarsAdded: 0, scholarsUpdated: preparedCount, rpcAdded: preparedCount });
      alert(`Successfully prepared and authorized ${preparedCount} official Approved Letter(s) with Dean signature seal!`);

      // Refresh matching statuses
      setMatchedStudents((prev) =>
        prev.map((item) =>
          selectedMatchIds.has(item.id)
            ? { ...item, hasExistingApprovedLetter: true }
            : item
        )
      );
    } catch (err: any) {
      console.error('Batch letter preparation error:', err);
      alert(`Error during batch preparation: ${err.message || err}`);
    } finally {
      setIsProcessingLetter(false);
    }
  };

  // Full Database Bulk Import
  const handleCommitAllData = async () => {
    if (!parseResult) return;
    setIsCommittingAll(true);
    try {
      const scholarsToImport = parseResult.scholarRows
        .filter((r) => r.isValid)
        .map((r) => r.scholar);

      const rpcRowsToImport = parseResult.rpcRows.filter((r) => r.isValid);

      const summary = await bulkImportScholarsAndRpc(
        scholarsToImport,
        rpcRowsToImport,
        currentUser,
        true
      );

      setCommitSummary(summary);
      onImportComplete(summary);
    } catch (err: any) {
      console.error('Commit error:', err);
      alert(`Import error: ${err.message || err}`);
    } finally {
      setIsCommittingAll(false);
    }
  };

  // Export consolidated Multi-Sheet Workbook
  const handleExportMultiSheetWorkbook = () => {
    // Sheet 1: Reconciled Scholars
    const reconciledHeaders = [
      'Enrollment No',
      'Scholar Name',
      'School',
      'Guide Name',
      'RPC Stage',
      'Scheduled Date',
      'Match Status',
      'Discrepancies',
      'Approved Letter Reference',
      'Source Sheet',
    ];
    const reconciledRows = matchedStudents.map((item) => [
      item.enrollmentNo,
      item.scholarName,
      item.school,
      item.guideName,
      `RPC ${item.rpcNumber}`,
      item.rpcDate,
      item.matchStatus,
      item.discrepancies.length > 0
        ? item.discrepancies.map((d) => `${d.label}: Excel [${d.excelValue}] vs DB [${d.dbValue}]`).join('; ')
        : 'None',
      item.approvedLetterRef || (item.hasExistingApprovedLetter ? 'Approved (Drafted)' : 'Pending'),
      item.sourceSheetName || 'Default Sheet',
    ]);

    // Sheet 2: Discrepancies Audit
    const discrepancyHeaders = [
      'Enrollment No',
      'Scholar Name',
      'School',
      'Discrepancy Field',
      'Excel File Value',
      'University DB Value',
      'Source Sheet',
    ];
    const discrepancyRows: any[][] = [];
    matchedStudents.forEach((item) => {
      item.discrepancies.forEach((d) => {
        discrepancyRows.push([
          item.enrollmentNo,
          item.scholarName,
          item.school,
          d.label,
          d.excelValue,
          d.dbValue,
          item.sourceSheetName || 'Default Sheet',
        ]);
      });
    });

    // Sheet 3: New Admissions
    const newScholarHeaders = [
      'Enrollment No',
      'Scholar Name',
      'School',
      'Guide Name',
      'Initial RPC Stage',
      'Scheduled Date',
      'Source Sheet',
    ];
    const newScholarRows = matchedStudents
      .filter((item) => item.matchStatus === 'NO_MATCH')
      .map((item) => [
        item.enrollmentNo,
        item.scholarName,
        item.school,
        item.guideName,
        `RPC ${item.rpcNumber}`,
        item.rpcDate,
        item.sourceSheetName || 'Default Sheet',
      ]);

    // Sheet 4: Approved Letters Register
    const approvedHeaders = [
      'Letter Dispatch ID',
      'Enrollment No',
      'Scholar Name',
      'School',
      'RPC Stage',
      'RPC Date',
      'Guide / Convener',
      'Dean Approval Status',
    ];
    const approvedRows = existingRecords
      .filter((r) => r.status === 'APPROVED')
      .map((r) => [
        r.letterData?.refNo || r.id,
        r.scholarEnrollment,
        r.scholarName,
        r.school,
        `RPC ${r.rpcNumber}`,
        r.rpcScheduledDate,
        r.guideName,
        'OFFICIALLY AUTHORIZED (Dean, SDSR)',
      ]);

    exportMultiSheetExcelWorkbook(
      [
        {
          sheetName: 'Reconciled_Scholars',
          headers: reconciledHeaders,
          rows: reconciledRows,
          colWidths: [18, 25, 28, 24, 12, 14, 16, 40, 26, 22],
        },
        {
          sheetName: 'Discrepancies_Audit',
          headers: discrepancyHeaders,
          rows: discrepancyRows,
          colWidths: [18, 25, 28, 20, 24, 24, 22],
        },
        {
          sheetName: 'New_Admissions',
          headers: newScholarHeaders,
          rows: newScholarRows,
          colWidths: [18, 25, 28, 24, 15, 14, 22],
        },
        {
          sheetName: 'Approved_RPC_Letters',
          headers: approvedHeaders,
          rows: approvedRows,
          colWidths: [26, 18, 25, 28, 12, 14, 24, 25],
        },
      ],
      `NFSU_SDSR_Consolidated_MultiSheet_Doctoral_Register_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const approvedRecordsCount = existingRecords.filter((r) => r.status === 'APPROVED').length;

  if (!isOpen) return null;

  return (
    <div
      id="excel-operations-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden"
    >
      <div
        id="excel-operations-modal-container"
        className="bg-white w-full max-w-6xl rounded-xl shadow-2xl border border-stone-300 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/90 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight">
                  SDSR Office — Multi-Sheet Excel Matching & Approved Letter Preparation
                </h2>
                {loadedSheets.length > 0 && (
                  <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {loadedFiles.length} file{loadedFiles.length > 1 ? 's' : ''} • {loadedSheets.filter((s) => s.isLoaded).length}/{loadedSheets.length} active sheets
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-300">
                National Forensic Sciences University • School of Doctoral Studies and Research
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loadedSheets.length > 0 && (
              <button
                type="button"
                onClick={handleUnloadAll}
                id="btn-unload-active-file-header"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-rose-200 hover:text-white bg-rose-950/80 hover:bg-rose-900 rounded border border-rose-800/80 transition cursor-pointer"
                title="Unload all loaded files/sheets and reset matching workspace"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Unload All</span>
              </button>
            )}
            <button
              onClick={onClose}
              id="btn-close-excel-modal"
              type="button"
              className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workflow Navigation Tabs */}
        <div className="bg-stone-100 border-b border-stone-200 px-4 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1 py-1">
            <button
              type="button"
              id="tab-load-excel"
              onClick={() => setActiveTab('LOAD')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition cursor-pointer ${
                activeTab === 'LOAD'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>1. Load & Manage Sheets</span>
              {loadedSheets.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                  {loadedSheets.filter((s) => s.isLoaded).length}/{loadedSheets.length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-student-matching"
              onClick={() => setActiveTab('MATCHING')}
              disabled={matchedStudents.length === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'MATCHING'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>2. Student Data Matching</span>
              {matchedStudents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
                  {matchedStudents.length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-prepare-approved-letter"
              onClick={() => setActiveTab('PREPARE_LETTER')}
              disabled={!targetStudentForLetter && matchedStudents.length === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === 'PREPARE_LETTER'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>3. Prepare Approved Letter</span>
              {targetStudentForLetter && (
                <span className="max-w-[120px] truncate text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                  {targetStudentForLetter.scholarName}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-unload-export-hub"
              onClick={() => setActiveTab('UNLOAD')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition cursor-pointer ${
                activeTab === 'UNLOAD'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>4. Unload / Multi-Sheet Hub</span>
              {loadedSheets.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-200 text-stone-700 font-bold">
                  {loadedSheets.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Unload trigger on right side of nav bar */}
          <div className="flex items-center gap-1.5 shrink-0 py-1">
            {matchedStudents.length > 0 && (
              <button
                type="button"
                id="quick-unload-matched-excel-btn"
                onClick={() => exportMatchedStudentsToExcel(matchedStudents)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded transition cursor-pointer"
                title="Unload matched student data into formatted Excel (.xlsx)"
              >
                <Download className="w-3 h-3 text-emerald-700" />
                <span>Unload Matched (.xlsx)</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ============================================================ */}
          {/* TAB 1: LOAD & MANAGE EXCEL SHEETS                            */}
          {/* ============================================================ */}
          {activeTab === 'LOAD' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Informational Guidance */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 flex items-start gap-3 text-xs text-stone-700">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-stone-900">
                    SDSR Multi-Sheet Excel Roster Loading & Automatic Student Data Matching
                  </div>
                  <p className="leading-relaxed">
                    Load single or multiple Excel workbooks (.xlsx, .xls) containing one or multiple sheets (e.g. SPH Pharmacy RPC,
                    SFS Forensics RPC, New Registrations). You can selectively toggle, load, and unload individual sheets or entire files at any time.
                  </p>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center transition cursor-pointer ${
                  dragActive
                    ? 'border-emerald-600 bg-emerald-50/60'
                    : 'border-stone-300 bg-white hover:bg-stone-50/80 hover:border-stone-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-3 shadow-2xs">
                  <Upload className="w-5 h-5" />
                </div>

                <h3 className="text-base font-bold text-stone-900">
                  {loadedFiles.length > 0
                    ? `Load Additional Excel Files or Replace Workspace`
                    : 'Load Multi-Sheet Doctoral Excel Spreadsheets'}
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                  Drag and drop one or multiple .xlsx / .xls files here, or click to browse.
                  Supports multi-sheet workbooks with automatic sheet detection and individual sheet unloading.
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    Browse Files (Multi-Select Allowed)
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickLoadSample();
                    }}
                    id="btn-quick-load-sample-roster"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                    title="Load official 3-sheet sample workbook: SPH Pharmacy RPC, SFS Forensics RPC, and New Registrations"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Quick Load Sample Multi-Sheet Roster (3 Sheets)
                  </button>
                </div>

                {isParsing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reading workbook sheets and cross-referencing scholars...
                  </div>
                )}
              </div>

              {parseError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-xs text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Unable to load Excel file</div>
                    <p className="mt-0.5">{parseError}</p>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* LOADED FILES & SHEETS MANAGEMENT CONSOLE                     */}
              {/* ============================================================ */}
              {loadedSheets.length > 0 && (
                <div className="border border-stone-300 rounded-xl bg-white p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-700" />
                        Loaded Sheets & Files Dashboard ({loadedSheets.length} Sheet{loadedSheets.length > 1 ? 's' : ''})
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Manage active and unloaded sheets. Toggle any sheet off to exclude its students from matching, or unload it permanently.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded shadow-2xs transition cursor-pointer"
                        title="Add more Excel spreadsheets to current workspace"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-stone-600" />
                        <span>Add Files</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUnloadAll}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded transition cursor-pointer"
                        title="Unload all files and sheets from workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unload All</span>
                      </button>
                    </div>
                  </div>

                  {/* Per-File and Per-Sheet Cards */}
                  <div className="space-y-4">
                    {loadedFiles.map((fileItem) => {
                      const fileSheets = loadedSheets.filter((s) => s.fileId === fileItem.fileId);
                      return (
                        <div
                          key={fileItem.fileId}
                          className="border border-stone-200 rounded-lg overflow-hidden bg-stone-50/50"
                        >
                          {/* File Header Bar */}
                          <div className="bg-stone-100 px-4 py-2.5 flex items-center justify-between border-b border-stone-200 text-xs">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                              <span className="font-bold text-stone-900">{fileItem.fileName}</span>
                              <span className="text-[11px] text-stone-500 font-mono">
                                ({(fileItem.fileSize / 1024).toFixed(1)} KB • {fileSheets.length} sheet{fileSheets.length > 1 ? 's' : ''})
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnloadSingleFile(fileItem.fileId)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:text-rose-900 hover:bg-rose-100/60 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                              title={`Unload entire file ${fileItem.fileName} and all its sheets`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Unload File</span>
                            </button>
                          </div>

                          {/* Sheets Table */}
                          <div className="divide-y divide-stone-200 bg-white">
                            {fileSheets.map((sheet) => (
                              <div
                                key={sheet.id}
                                className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition ${
                                  sheet.isLoaded ? 'bg-white' : 'bg-stone-50/80 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Toggle button */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSheet(sheet.id)}
                                    className="cursor-pointer"
                                    title={
                                      sheet.isLoaded
                                        ? 'Click to Unload / Exclude this sheet from matching'
                                        : 'Click to Load / Include this sheet into matching'
                                    }
                                  >
                                    {sheet.isLoaded ? (
                                      <ToggleRight className="w-6 h-6 text-emerald-600" />
                                    ) : (
                                      <ToggleLeft className="w-6 h-6 text-stone-400" />
                                    )}
                                  </button>

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-stone-900">
                                        {sheet.sheetName}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold ${
                                          sheet.type === 'RPC_SCHEDULES'
                                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                            : sheet.type === 'PHD_SCHOLARS'
                                            ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                        }`}
                                      >
                                        {sheet.type === 'RPC_SCHEDULES'
                                          ? 'RPC Schedules'
                                          : sheet.type === 'PHD_SCHOLARS'
                                          ? 'Doctoral Scholars'
                                          : 'Combined Roster'}
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                          sheet.isLoaded
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-stone-200 text-stone-600'
                                        }`}
                                      >
                                        {sheet.isLoaded ? 'Loaded (Active)' : 'Unloaded (Excluded)'}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-stone-500 mt-0.5">
                                      {sheet.validRows} valid student rows ({sheet.totalRows} raw rows)
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSheet(sheet.id)}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                                      sheet.isLoaded
                                        ? 'text-stone-700 bg-stone-100 hover:bg-stone-200 border-stone-300'
                                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                                    }`}
                                  >
                                    {sheet.isLoaded ? 'Unload Sheet' : 'Load Sheet'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleUnloadSingleSheet(sheet.id)}
                                    className="p-1 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title={`Permanently unload and remove ${sheet.sheetName} from workspace`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Proceed to Matching Bar */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="text-xs text-emerald-950 font-medium">
                        <strong>{matchedStudents.length} student records</strong> ready across{' '}
                        {loadedSheets.filter((s) => s.isLoaded).length} active sheet(s).
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('MATCHING')}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer self-end sm:self-auto"
                    >
                      <span>Proceed to Student Data Matching</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Download Official Blank Templates */}
              <div className="border-t border-stone-200 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      Standard NFSU Excel Templates (Download / Unload)
                    </h4>
                    <p className="text-xs text-stone-500">
                      Download standardized pre-formatted spreadsheets for entering student data
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => downloadExcelTemplate('scholars')}
                    className="p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-stone-900 group-hover:text-emerald-700">
                        Ph.D. Scholars Template
                      </div>
                      <div className="text-[11px] text-stone-500">Enrollment, Guide, School</div>
                    </div>
                    <Download className="w-4 h-4 text-stone-400 group-hover:text-emerald-700" />
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadExcelTemplate('rpc_requests')}
                    className="p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-stone-900 group-hover:text-emerald-700">
                        RPC Schedule Template
                      </div>
                      <div className="text-[11px] text-stone-500">Dates, Committee & Venue</div>
                    </div>
                    <Download className="w-4 h-4 text-stone-400 group-hover:text-emerald-700" />
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadExcelTemplate('combined')}
                    className="p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-stone-900 group-hover:text-emerald-700">
                        Master Unified Workbook
                      </div>
                      <div className="text-[11px] text-stone-500">Two sheets combined</div>
                    </div>
                    <Download className="w-4 h-4 text-stone-400 group-hover:text-emerald-700" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: STUDENT DATA MATCHING & RECONCILIATION                */}
          {/* ============================================================ */}
          {activeTab === 'MATCHING' && (
            <div className="space-y-4">
              {/* Top Matching Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg">
                  <div className="text-[11px] font-medium text-stone-500 uppercase">Loaded in File</div>
                  <div className="text-xl font-bold text-stone-900 mt-0.5">{matchStats.total}</div>
                  <div className="text-[10px] text-stone-500">Students staged</div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-lg">
                  <div className="text-[11px] font-medium text-blue-700 uppercase">Matched in SDSR</div>
                  <div className="text-xl font-bold text-blue-900 mt-0.5">{matchStats.matched}</div>
                  <div className="text-[10px] text-blue-600">{matchStats.exact} exact enrollment</div>
                </div>

                <div className="bg-purple-50/70 border border-purple-200 p-3 rounded-lg">
                  <div className="text-[11px] font-medium text-purple-700 uppercase">New Scholars</div>
                  <div className="text-xl font-bold text-purple-900 mt-0.5">{matchStats.newStudents}</div>
                  <div className="text-[10px] text-purple-600">Will be enrolled</div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-lg">
                  <div className="text-[11px] font-medium text-amber-800 uppercase">Discrepancies</div>
                  <div className="text-xl font-bold text-amber-900 mt-0.5">{matchStats.discrepancies}</div>
                  <div className="text-[10px] text-amber-700">Guide or stage diff</div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-lg col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-medium text-emerald-800 uppercase">Approved Letters</div>
                  <div className="text-xl font-bold text-emerald-900 mt-0.5">{matchStats.lettersApproved}</div>
                  <div className="text-[10px] text-emerald-700">Issued & authorized</div>
                </div>
              </div>

              {/* Matching Search & Filters Toolbar */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search scholar, enrollment, guide..."
                      value={matchingSearch}
                      onChange={(e) => setMatchingSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-stone-500"
                    />
                  </div>

                  {/* Sheet Filter dropdown */}
                  {loadedSheets.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <select
                          value={selectedSheetFilter}
                          onChange={(e) => setSelectedSheetFilter(e.target.value)}
                          className="text-xs bg-white border border-stone-300 rounded-md py-1.5 pl-2.5 pr-7 font-medium text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-stone-500"
                          title="Filter students by origin spreadsheet sheet"
                        >
                          <option value="ALL">All Sheets ({matchedStudents.length})</option>
                          {loadedSheets.map((s) => {
                            const countInSheet = matchedStudents.filter(
                              (m) => m.sourceSheetName === s.sheetName
                            ).length;
                            return (
                              <option key={s.id} value={s.sheetName}>
                                Sheet: {s.sheetName} ({countInSheet} staged) {s.isLoaded ? '' : '— [Unloaded]'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* If a specific sheet is selected, provide instant unload / toggle buttons */}
                      {selectedSheetFilter !== 'ALL' && (
                        (() => {
                          const targetSheet = loadedSheets.find((s) => s.sheetName === selectedSheetFilter);
                          if (!targetSheet) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => handleUnloadSingleSheet(targetSheet.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition cursor-pointer"
                              title={`Unload and remove sheet "${targetSheet.sheetName}" from matching`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Unload "{targetSheet.sheetName}"</span>
                            </button>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* Filter chips */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMatchingStatusFilter('ALL')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                        matchingStatusFilter === 'ALL'
                          ? 'bg-stone-900 text-white'
                          : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      All ({matchedStudents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchingStatusFilter('MATCHED')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                        matchingStatusFilter === 'MATCHED'
                          ? 'bg-blue-700 text-white'
                          : 'bg-white text-blue-900 border border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      Matched ({matchStats.matched})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchingStatusFilter('NEW')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                        matchingStatusFilter === 'NEW'
                          ? 'bg-purple-700 text-white'
                          : 'bg-white text-purple-900 border border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      New ({matchStats.newStudents})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchingStatusFilter('DISCREPANCY')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition cursor-pointer ${
                        matchingStatusFilter === 'DISCREPANCY'
                          ? 'bg-amber-700 text-white'
                          : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      Discrepancies ({matchStats.discrepancies})
                    </button>
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBatchPrepareApprovedLetters}
                    disabled={selectedMatchIds.size === 0 || isProcessingLetter}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                    title="Generate and approve letters with Dean SDSR signature for all checked students"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Batch Prepare Approved Letters ({selectedMatchIds.size})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportMatchedStudentsToExcel(matchedStudents)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 rounded-md text-xs font-semibold shadow-2xs transition cursor-pointer"
                    title="Export matching reconciliation report to Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5 text-stone-600" />
                    <span>Unload Matched (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUnloadAll}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-300 hover:border-rose-300 rounded-md text-xs font-medium transition cursor-pointer"
                    title="Unload/remove all loaded files and sheets from memory and reset matching workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Unload All</span>
                  </button>
                </div>
              </div>

              {/* Matched Student Roster Table */}
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 w-8">
                          <button
                            type="button"
                            onClick={toggleSelectAllMatches}
                            className="text-stone-500 hover:text-stone-900 cursor-pointer"
                          >
                            {selectedMatchIds.size === filteredMatches.length && filteredMatches.length > 0 ? (
                              <CheckSquare className="w-4 h-4 text-emerald-700" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-3">Scholar & Enrollment</th>
                        <th className="py-2.5 px-3">Matching Status</th>
                        <th className="py-2.5 px-3">School & Guide</th>
                        <th className="py-2.5 px-3">RPC Stage</th>
                        <th className="py-2.5 px-3">Approved Letter</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-stone-800">
                      {filteredMatches.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-stone-500">
                            No students match your selected filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredMatches.map((item) => {
                          const isSelected = selectedMatchIds.has(item.id);
                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-stone-50/80 transition ${
                                isSelected ? 'bg-emerald-50/30' : ''
                              }`}
                            >
                              <td className="py-3 px-3">
                                <button
                                  type="button"
                                  onClick={() => toggleSelectMatch(item.id)}
                                  className="text-stone-500 hover:text-stone-900 cursor-pointer"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-700" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </td>

                              {/* Scholar Info */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-stone-900">{item.scholarName}</div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[11px] text-stone-500">{item.enrollmentNo}</span>
                                  {item.sourceSheetName && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded font-mono border border-stone-200">
                                      <FileSpreadsheet className="w-2.5 h-2.5 text-stone-400" />
                                      {item.sourceSheetName}
                                    </span>
                                  )}
                                </div>
                                {item.discrepancies.length > 0 && (
                                  <div className="mt-1 space-y-0.5">
                                    {item.discrepancies.map((d, dIdx) => (
                                      <div
                                        key={dIdx}
                                        className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block mr-1"
                                      >
                                        <strong>{d.label}:</strong> Excel: {d.excelValue} ≠ DB: {d.dbValue}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* Matching Badge */}
                              <td className="py-3 px-3">
                                {item.matchStatus === 'EXACT_MATCH' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Exact Matched
                                  </span>
                                ) : item.matchStatus === 'NAME_MATCH' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                                    <UserCheck className="w-3 h-3 text-blue-600" />
                                    Matched by Name
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                    <Users className="w-3 h-3 text-purple-600" />
                                    New Student
                                  </span>
                                )}
                              </td>

                              {/* School & Guide */}
                              <td className="py-3 px-3">
                                <div className="text-stone-900 truncate max-w-[180px]">{item.school}</div>
                                <div className="text-[11px] text-stone-500 truncate max-w-[180px]">
                                  Guide: {item.guideName}
                                </div>
                              </td>

                              {/* RPC Stage */}
                              <td className="py-3 px-3">
                                <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded text-xs">
                                  RPC {item.rpcNumber}
                                </span>
                                <div className="text-[10px] text-stone-500 mt-0.5">{item.rpcDate}</div>
                              </td>

                              {/* Approved Letter Status */}
                              <td className="py-3 px-3">
                                {item.hasExistingApprovedLetter ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                      APPROVED
                                    </span>
                                    {item.approvedLetterRef && (
                                      <div className="text-[9px] font-mono text-stone-500 truncate max-w-[140px]">
                                        {item.approvedLetterRef}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-stone-500 italic">Not Prepared Yet</span>
                                )}
                              </td>

                              {/* Action */}
                              <td className="py-3 px-3 text-right space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenLetterPreparation(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-black rounded shadow-xs transition cursor-pointer"
                                  title="Prepare or modify approved letter for this student"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>{item.hasExistingApprovedLetter ? 'Edit Letter' : 'Prepare Approved Letter'}</span>
                                </button>

                                {item.existingRpcRecord && onViewLetterModal && (
                                  <button
                                    type="button"
                                    onClick={() => onViewLetterModal(item.existingRpcRecord!)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded shadow-2xs transition cursor-pointer"
                                    title="View full letter in official viewer"
                                  >
                                    <Eye className="w-3 h-3 text-stone-600" />
                                    <span>View</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Commit Staged Records to Database Bar */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-stone-600">
                  Ready to persist full Excel records into Firestore SDSR database?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCommitAllData}
                    disabled={isCommittingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    {isCommittingAll ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving to Database...
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        Commit All Records to Database
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: PREPARE APPROVED LETTER CONSOLE                       */}
          {/* ============================================================ */}
          {activeTab === 'PREPARE_LETTER' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {!targetStudentForLetter ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-stone-900">No Student Selected for Letter Preparation</h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Please go to the <strong>Student Data Matching</strong> tab and click &ldquo;Prepare Approved Letter&rdquo;
                    on any matched scholar to generate their official approval documentation.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('MATCHING')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-md text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    Back to Student Matching
                  </button>
                </div>
              ) : (
                <>
                  {/* Scholar Summary Header */}
                  <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-stone-900">
                          {targetStudentForLetter.scholarName}
                        </h3>
                        <span className="font-mono text-xs bg-stone-200 text-stone-800 px-2 py-0.5 rounded">
                          {targetStudentForLetter.enrollmentNo}
                        </span>
                        <span className="font-bold text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                          RPC {targetStudentForLetter.rpcNumber}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {targetStudentForLetter.school} • Research Supervisor: {targetStudentForLetter.guideName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('MATCHING')}
                      className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 hover:underline cursor-pointer"
                    >
                      <span>Choose Different Scholar</span>
                    </button>
                  </div>

                  {/* Letter Notice if successfully prepared */}
                  {letterSuccessNotice && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3 text-xs text-emerald-950">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold">Letter Authorized & Approved</div>
                        <p>{letterSuccessNotice}</p>
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[11px] font-semibold shadow-2xs transition cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            Print Official Letter
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Letter Builder Form Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border border-stone-200 p-4 rounded-lg shadow-2xs">
                    {/* Left: Dispatch & Reference */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 border-b border-stone-100 pb-1.5">
                        Official Letter Reference & Schedule
                      </h4>

                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 mb-1">
                          Official Reference Number
                        </label>
                        <input
                          type="text"
                          value={letterRefNo}
                          onChange={(e) => setLetterRefNo(e.target.value)}
                          className="w-full text-xs font-mono px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-stone-700 mb-1">
                            Letter Dispatch Date
                          </label>
                          <input
                            type="text"
                            value={letterDate}
                            onChange={(e) => setLetterDate(e.target.value)}
                            className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-700 mb-1">
                            RPC Meeting Date
                          </label>
                          <input
                            type="date"
                            value={meetingDate}
                            onChange={(e) => setMeetingDate(e.target.value)}
                            className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-stone-700 mb-1">
                            Meeting Time
                          </label>
                          <input
                            type="text"
                            value={meetingTime}
                            onChange={(e) => setMeetingTime(e.target.value)}
                            className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-700 mb-1">
                            Meeting Mode
                          </label>
                          <select
                            value={meetingMode}
                            onChange={(e) => setMeetingMode(e.target.value as any)}
                            className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                          >
                            <option value="ONLINE">ONLINE Mode</option>
                            <option value="HYBRID">HYBRID Mode</option>
                            <option value="OFFLINE">PHYSICAL / OFFLINE Mode</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 mb-1">
                          Venue / Google Meet Link
                        </label>
                        <input
                          type="text"
                          value={meetingVenue}
                          onChange={(e) => setMeetingVenue(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Right: Committee Members */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 border-b border-stone-100 pb-1.5">
                        Research Progress Committee (RPC) Composition
                      </h4>

                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 mb-1">
                          Research Supervisor / Guide (Convener)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={targetStudentForLetter.guideName}
                          className="w-full text-xs px-3 py-1.5 bg-stone-100 text-stone-700 border border-stone-300 rounded cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 mb-1">
                          Internal Expert
                        </label>
                        <input
                          type="text"
                          value={internalExpert}
                          onChange={(e) => setInternalExpert(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 mb-1">
                          External Expert 1
                        </label>
                        <input
                          type="text"
                          value={externalExpert1}
                          onChange={(e) => setExternalExpert1(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 mb-1">
                          External Expert 2
                        </label>
                        <input
                          type="text"
                          value={externalExpert2}
                          onChange={(e) => setExternalExpert2(e.target.value)}
                          className="w-full text-xs px-3 py-1.5 border border-stone-300 rounded focus:ring-1 focus:ring-stone-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Execution Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-stone-100 rounded-lg border border-stone-300">
                    <div className="text-xs text-stone-600">
                      <strong>Authorization Mode:</strong> Preparing letter for SDSR institutional issuance
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExecutePrepareLetter(false)}
                        disabled={isProcessingLetter}
                        className="px-3.5 py-2 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 rounded shadow-2xs transition cursor-pointer"
                      >
                        Save as Draft for Dean Approval
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExecutePrepareLetter(true)}
                        disabled={isProcessingLetter}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded shadow-xs transition cursor-pointer"
                        title="Finalize official approved letter with Dean SDSR specimen signature seal immediately"
                      >
                        {isProcessingLetter ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Authorizing Letter...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            Generate & Finalize Approved Letter
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Live Letter Document Preview */}
                  {generatedLetterRecord && generatedLetterRecord.letterData && (
                    <div className="mt-6 border-t border-stone-200 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-bold text-stone-900">
                            Generated Approved Letter (Specimen Preview)
                          </h4>
                          <p className="text-xs text-stone-500">
                            Authorized with Dean, SDSR seal and immutable document snapshot
                          </p>
                        </div>
                      </div>

                      <div className="border border-stone-300 rounded-lg bg-stone-50 p-4 flex justify-center">
                        <OfficialRpcLetter
                          letterData={generatedLetterRecord.letterData}
                          rpcRecord={generatedLetterRecord}
                          isApproved={true}
                          showActions={true}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: UNLOAD & EXPORT HUB                                   */}
          {/* ============================================================ */}
          {activeTab === 'UNLOAD' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  SDSR Office — Multi-Sheet Unload & Institutional Export Center
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Granularly unload individual sheets, toggle loaded workbooks, export multi-sheet master registers, or download approved letter archives.
                </p>
              </div>

              {/* Granular Sheet Management & Selective Unloading */}
              {loadedSheets.length > 0 && (
                <div className="border border-stone-200 rounded-xl bg-white p-5 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        Staged Excel Sheets Management & Selective Unloading
                      </h4>
                      <p className="text-xs text-stone-500">
                        Selectively unload or toggle individual sheets from the active reconciliation memory.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUnloadAll}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded transition cursor-pointer"
                        title="Unload all files and sheets from memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Unload All Staged Sheets</span>
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-stone-100 border border-stone-200 rounded-lg overflow-hidden">
                    {loadedSheets.map((sheet) => {
                      const parentFile = loadedFiles.find((f) => f.fileId === sheet.fileId);
                      return (
                        <div
                          key={sheet.id}
                          className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                            sheet.isLoaded ? 'bg-white' : 'bg-stone-50/70 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleSheet(sheet.id)}
                              className="cursor-pointer"
                              title={sheet.isLoaded ? 'Unload sheet from matching' : 'Load sheet into matching'}
                            >
                              {sheet.isLoaded ? (
                                <ToggleRight className="w-6 h-6 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-stone-400" />
                              )}
                            </button>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-900">{sheet.sheetName}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                    sheet.isLoaded
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-stone-200 text-stone-600'
                                  }`}
                                >
                                  {sheet.isLoaded ? 'Loaded (Active)' : 'Unloaded (Excluded)'}
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-500 mt-0.5">
                                Source: {parentFile ? parentFile.fileName : 'File'} • {sheet.validRows} valid students ({sheet.totalRows} total rows)
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleToggleSheet(sheet.id)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                                sheet.isLoaded
                                  ? 'text-stone-700 bg-stone-100 hover:bg-stone-200 border-stone-300'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                              }`}
                            >
                              {sheet.isLoaded ? 'Unload Sheet' : 'Load Sheet'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUnloadSingleSheet(sheet.id)}
                              className="p-1 text-stone-400 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                              title={`Permanently unload ${sheet.sheetName} from memory`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unload & Export Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Unload Option 1: Consolidated Multi-Sheet Master Register */}
                <div className="sm:col-span-2 border-2 border-emerald-500/80 rounded-xl p-5 bg-emerald-50/20 shadow-xs flex flex-col justify-between">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-emerald-700 flex items-center justify-center text-white shadow-2xs">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            Recommended • Multi-Sheet Workbook
                          </span>
                          <h4 className="text-base font-bold text-stone-900 mt-0.5">
                            Unload Consolidated Multi-Sheet Master Register (.xlsx)
                          </h4>
                        </div>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                        Exports an institutional 4-sheet master Excel workbook:
                        <strong className="text-stone-900"> (1) Reconciled_Scholars</strong>,
                        <strong className="text-stone-900"> (2) Discrepancies_Audit</strong>,
                        <strong className="text-stone-900"> (3) New_Admissions</strong>, and
                        <strong className="text-stone-900"> (4) Approved_RPC_Letters</strong>.
                        Preserves individual tab structures and column widths.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-emerald-800">
                        <span className="bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded">
                          {matchedStudents.length} Reconciled Scholars
                        </span>
                        <span className="bg-amber-100/70 border border-amber-300 px-2 py-0.5 rounded text-amber-900">
                          {matchStats.discrepancies} Discrepancies
                        </span>
                        <span className="bg-purple-100/70 border border-purple-300 px-2 py-0.5 rounded text-purple-900">
                          {matchStats.newStudents} New Admissions
                        </span>
                        <span className="bg-blue-100/70 border border-blue-300 px-2 py-0.5 rounded text-blue-900">
                          {approvedRecordsCount} Approved Letters
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={handleExportMultiSheetWorkbook}
                        disabled={matchedStudents.length === 0}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-40 rounded-lg shadow-sm transition cursor-pointer"
                        title="Generate and download 4-sheet master workbook"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unload Multi-Sheet Register (.xlsx)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Unload Option 2: Matched Student Roster */}
                <div className="border border-stone-200 rounded-xl p-5 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Unload Matched Students Roster (.xlsx)
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Exports the current reconciliation dataset containing student matching statuses, discrepancy analysis,
                      Guide names, scheduled dates, and prepared approved letter references.
                    </p>
                    <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-1 rounded inline-block">
                      {matchedStudents.length} Students staged in memory
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100 mt-4">
                    <button
                      type="button"
                      onClick={() => exportMatchedStudentsToExcel(matchedStudents)}
                      disabled={matchedStudents.length === 0}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 rounded shadow-xs transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unload Matched Roster (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* Unload Option 3: Approved Letters Register */}
                <div className="border border-stone-200 rounded-xl p-5 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Unload Approved Letters Register (.xlsx)
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Official university register of all Ph.D. RPC letters authorized by the Dean, SDSR. Includes document
                      specimen IDs, committee composition, dates, and approval timestamps.
                    </p>
                    <div className="text-[11px] font-mono text-blue-800 bg-blue-50 px-2 py-1 rounded inline-block">
                      {approvedRecordsCount} Approved letters in database
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100 mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        exportApprovedLettersToExcel(existingRecords.filter((r) => r.status === 'APPROVED'))
                      }
                      disabled={approvedRecordsCount === 0}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-40 rounded shadow-xs transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unload Approved Letters Register (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* Unload Option 4: Master RPC Database */}
                <div className="border border-stone-200 rounded-xl p-5 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-300 flex items-center justify-center text-stone-700">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Unload Full RPC Database (.xlsx)
                    </h4>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Complete archive of all active, in-verification, returned, and approved doctoral RPC evaluations
                      currently maintained by the Office of SDSR.
                    </p>
                    <div className="text-[11px] font-mono text-stone-700 bg-stone-100 px-2 py-1 rounded inline-block">
                      {existingRecords.length} Master records in portal
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-100 mt-4">
                    <button
                      type="button"
                      onClick={() => exportAllRpcRecordsToExcel(existingRecords)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 shadow-2xs transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unload Master Records (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* Unload Option 5: Clear / Reset Loaded Workspace */}
                <div className="border border-rose-200 rounded-xl p-5 bg-rose-50/40 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-rose-950">
                      Unload All Files & Reset Staging Memory
                    </h4>
                    <p className="text-xs text-rose-800 leading-relaxed">
                      Clears all loaded files and sheets from session memory, resets student matching staging tables,
                      and prepares the workspace for loading a new Excel batch.
                    </p>
                    <div className="text-[11px] text-rose-700">
                      {loadedSheets.length > 0
                        ? `${loadedFiles.length} file(s) and ${loadedSheets.length} sheet(s) loaded`
                        : 'No active sheets loaded'}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-rose-200 mt-4">
                    <button
                      type="button"
                      onClick={handleUnloadAll}
                      disabled={loadedSheets.length === 0 && matchedStudents.length === 0}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 disabled:opacity-40 rounded shadow-2xs transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Unload All Files & Sheets</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Status Footer */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 text-xs text-stone-600">
          <div className="flex items-center gap-3">
            {loadedSheets.length > 0 ? (
              <span className="font-medium text-stone-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  <strong>{loadedFiles.length}</strong> file(s) •{' '}
                  <strong>{loadedSheets.filter((s) => s.isLoaded).length}</strong> of{' '}
                  <strong>{loadedSheets.length}</strong> active sheet(s) •{' '}
                  <strong>{matchedStudents.length}</strong> students staged
                </span>
              </span>
            ) : (
              <span className="text-stone-400">No Excel sheets loaded</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded shadow-2xs transition cursor-pointer"
            >
              Close Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

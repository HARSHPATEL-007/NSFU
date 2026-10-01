import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Scholar, RpcMember, UserProfile, MeetingMode } from '../types';
import {
  getAllScholars,
  getAllMembers,
  validateRpcSequence,
  createNewRpcRequest,
} from '../services/dataService';
import { getOrdinalText, formatDisplayDate } from '../utils/dateUtils';
import {
  ExcelRosterCandidate,
  getLoadedExcelRosterCandidates,
  getSharedLoadedFiles,
  getSharedLoadedSheets,
  quickLoadSampleRosterShared,
  parseMultipleExcelFiles,
  setSharedLoadedData,
  downloadExcelTemplate,
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
  Download,
  Sparkles,
  Database,
  ArrowRight,
  Info,
  Loader2,
  FileCheck,
  Search,
  Filter,
  BookOpen,
  Users,
  Shield,
  Layers,
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
  const [selectedDataSource, setSelectedDataSource] = useState<'EXCEL' | 'DATABASE'>('EXCEL');

  // Excel Sheet Filter & Candidate Search
  const [selectedSheetFilter, setSelectedSheetFilter] = useState<string>('ALL');
  const [candidateSearchQuery, setCandidateSearchQuery] = useState<string>('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [selectedCandidate, setSelectedCandidate] = useState<ExcelRosterCandidate | null>(null);

  // Database Scholar Form Selection
  const [selectedScholarId, setSelectedScholarId] = useState<string>('');

  // Editable Scholar Details (Auto-filled from Excel or Database)
  const [scholarName, setScholarName] = useState<string>('');
  const [enrollmentNo, setEnrollmentNo] = useState<string>('');
  const [school, setSchool] = useState<string>('School of Forensic Science');
  const [department, setDepartment] = useState<string>('Doctoral Studies and Research');
  const [researchTopic, setResearchTopic] = useState<string>('Doctoral Research Study at NFSU');
  const [registrationDate, setRegistrationDate] = useState<string>('2024-01-15');

  // Editable Guide / Supervisor Details
  const [guideName, setGuideName] = useState<string>('');
  const [guideDesignation, setGuideDesignation] = useState<string>('Professor');
  const [guideSchool, setGuideSchool] = useState<string>('School of Forensic Science');
  const [guideEmail, setGuideEmail] = useState<string>('');
  const [coGuideName, setCoGuideName] = useState<string>('');

  // RPC Stage & Scheduling Details
  const [rpcNumber, setRpcNumber] = useState<number>(1);
  const [rpcDate, setRpcDate] = useState<string>('2025-10-15');
  const [meetingTime, setMeetingTime] = useState<string>('11:30 AM IST');
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('ONLINE');
  const [venue, setVenue] = useState<string>('online mode (Google Meet)');
  const [requestDetails, setRequestDetails] = useState<string>('');

  // Committee Member 1: Internal Expert
  const [internalName, setInternalName] = useState<string>('Dr. Bhoomika Patel');
  const [internalDesignation, setInternalDesignation] = useState<string>('Associate Professor');
  const [internalDept, setInternalDept] = useState<string>('School of Pharmacy');
  const [internalCampus, setInternalCampus] = useState<string>('NFSU, Gandhinagar');

  // Committee Member 2: External Expert 1
  const [ext1Name, setExt1Name] = useState<string>('Dr. Dhiraj Bhatia');
  const [ext1Designation, setExt1Designation] = useState<string>('Associate Professor');
  const [ext1Dept, setExt1Dept] = useState<string>('Department of Biological Science');
  const [ext1Inst, setExt1Inst] = useState<string>('IIT Gandhinagar');
  const [ext1City, setExt1City] = useState<string>('Gujarat');

  // Committee Member 3: External Expert 2
  const [ext2Name, setExt2Name] = useState<string>('Prof. (Dr.) Sanjay K. Jain');
  const [ext2Designation, setExt2Designation] = useState<string>('Professor');
  const [ext2Dept, setExt2Dept] = useState<string>('Department of Pharmaceutical Sciences');
  const [ext2Inst, setExt2Inst] = useState<string>('Dr. H.S. Gour Central University');
  const [ext2City, setExt2City] = useState<string>('Sagar, M.P.');

  // Sequence Validation State
  const [sequenceCheck, setSequenceCheck] = useState<{
    checked: boolean;
    isValid: boolean;
    permissible: number;
    message: string;
  }>({ checked: false, isValid: true, permissible: 1, message: '' });

  // Loading & Notice States
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
          if (form) form.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, sequenceCheck.isValid, onClose]);

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
          fillFormFromCandidate(candidates[0], scholars, members);
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

      // Initialize default experts from members
      const defaultInternal = mList.find((m) => m.memberType === 'INTERNAL');
      const defaultExt1 = mList.find((m) => m.memberType === 'EXTERNAL_1');
      const defaultExt2 = mList.find((m) => m.memberType === 'EXTERNAL_2');

      if (defaultInternal) {
        setInternalName(defaultInternal.name);
        setInternalDesignation(defaultInternal.designation || 'Associate Professor');
        setInternalDept(defaultInternal.department || 'School of Forensic Science');
        setInternalCampus(defaultInternal.location || 'NFSU, Gandhinagar');
      }
      if (defaultExt1) {
        setExt1Name(defaultExt1.name);
        setExt1Designation(defaultExt1.designation || 'Associate Professor');
        setExt1Dept(defaultExt1.department || 'External Department');
        setExt1Inst(defaultExt1.schoolOrInstitution || 'External University');
        setExt1City(defaultExt1.location || 'Gujarat');
      }
      if (defaultExt2) {
        setExt2Name(defaultExt2.name);
        setExt2Designation(defaultExt2.designation || 'Professor');
        setExt2Dept(defaultExt2.department || 'External Department');
        setExt2Inst(defaultExt2.schoolOrInstitution || 'External University');
        setExt2City(defaultExt2.location || 'India');
      }

      // If Excel candidates are available, default to Excel fill mode
      if (candidates.length > 0) {
        setSelectedDataSource('EXCEL');
        fillFormFromCandidate(candidates[0], sList, mList);
      } else if (sList.length > 0) {
        const first = sList[0];
        setSelectedScholarId(first.id);
        fillFormFromScholar(first);
      }
    } catch (err: any) {
      console.warn('Error loading initial modal data:', err);
    }
  };

  // Get distinct sheet names from loaded Excel files
  const availableSheetNames = useMemo(() => {
    const sheets = getSharedLoadedSheets().filter((s) => s.isLoaded);
    const names = new Set<string>();
    sheets.forEach((s) => names.add(s.sheetName));
    return Array.from(names);
  }, [excelCandidates]);

  // Filtered candidate list based on selected sheet and search query
  const filteredCandidates = useMemo(() => {
    return excelCandidates.filter((c) => {
      const matchSheet = selectedSheetFilter === 'ALL' || c.sourceSheetName === selectedSheetFilter;
      if (!matchSheet) return false;

      if (!candidateSearchQuery.trim()) return true;
      const q = candidateSearchQuery.toLowerCase().trim();
      return (
        c.scholarName.toLowerCase().includes(q) ||
        c.enrollmentNo.toLowerCase().includes(q) ||
        c.guideName.toLowerCase().includes(q) ||
        c.school.toLowerCase().includes(q)
      );
    });
  }, [excelCandidates, selectedSheetFilter, candidateSearchQuery]);

  // Fill form from an Excel candidate
  const fillFormFromCandidate = (
    cand: ExcelRosterCandidate,
    currentScholars: Scholar[] = scholars,
    currentMembers: RpcMember[] = members
  ) => {
    setSelectedCandidateId(cand.id);
    setSelectedCandidate(cand);

    // Scholar Details
    setScholarName(cand.scholarName);
    setEnrollmentNo(cand.enrollmentNo);
    setSchool(cand.school || 'School of Forensic Science');
    setDepartment(cand.department || cand.school || 'Doctoral Studies and Research');
    setResearchTopic(cand.researchTopic || cand.notes || 'Doctoral Research Study at NFSU');
    setRegistrationDate(new Date().toISOString().split('T')[0]);

    // Guide Details
    setGuideName(cand.guideName);
    setGuideDesignation(cand.guideDesignation || 'Professor');
    setGuideSchool(cand.guideSchool || cand.school);
    setGuideEmail(
      cand.guideEmail || `${cand.guideName.toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`
    );
    setCoGuideName(cand.coGuideName || '');

    // RPC Evaluation & Scheduling Details
    setRpcNumber(cand.rpcNumber || 1);
    setRpcDate(cand.rpcDate || new Date().toISOString().split('T')[0]);
    setMeetingTime(cand.meetingTime || '11:30 AM IST');
    setMeetingMode(cand.meetingMode || 'ONLINE');
    setVenue(cand.venue || 'online mode (Google Meet)');
    setRequestDetails(
      cand.notes ||
        `${cand.rpcNumber}th RPC evaluation for Ph.D. Scholar ${cand.scholarName} (${cand.school}).`
    );

    // Auto-fill Committee Experts directly from the Excel sheet if present
    if (cand.internalExpertName) {
      setInternalName(cand.internalExpertName);
      if (cand.internalExpertDesignation) setInternalDesignation(cand.internalExpertDesignation);
      if (cand.internalExpertDepartment || cand.internalExpertDept) {
        setInternalDept(cand.internalExpertDepartment || cand.internalExpertDept || '');
      }
      if (cand.internalExpertLocation || cand.internalExpertCampus) {
        setInternalCampus(cand.internalExpertLocation || cand.internalExpertCampus || 'NFSU, Gandhinagar');
      }
    }
    if (cand.externalExpert1Name) {
      setExt1Name(cand.externalExpert1Name);
      if (cand.externalExpert1Designation) setExt1Designation(cand.externalExpert1Designation);
      if (cand.externalExpert1Department || cand.externalExpert1Dept) {
        setExt1Dept(cand.externalExpert1Department || cand.externalExpert1Dept || '');
      }
      if (cand.externalExpert1Institution || cand.externalExpert1Inst) {
        setExt1Inst(cand.externalExpert1Institution || cand.externalExpert1Inst || 'External University');
      } else if (cand.externalExpert1Department) {
        setExt1Inst(cand.externalExpert1Department);
      }
      if (cand.externalExpert1Location || cand.externalExpert1City) {
        setExt1City(cand.externalExpert1Location || cand.externalExpert1City || 'India');
      }
    }
    if (cand.externalExpert2Name) {
      setExt2Name(cand.externalExpert2Name);
      if (cand.externalExpert2Designation) setExt2Designation(cand.externalExpert2Designation);
      if (cand.externalExpert2Department || cand.externalExpert2Dept) {
        setExt2Dept(cand.externalExpert2Department || cand.externalExpert2Dept || '');
      }
      if (cand.externalExpert2Institution || cand.externalExpert2Inst) {
        setExt2Inst(cand.externalExpert2Institution || cand.externalExpert2Inst || 'External University');
      } else if (cand.externalExpert2Department) {
        setExt2Inst(cand.externalExpert2Department);
      }
      if (cand.externalExpert2Location || cand.externalExpert2City) {
        setExt2City(cand.externalExpert2Location || cand.externalExpert2City || 'India');
      }
    }

    // Sequence Validation
    if (cand.matchedScholarId) {
      setSelectedScholarId(cand.matchedScholarId);
      checkSequence(cand.matchedScholarId, cand.rpcNumber || 1);
    } else {
      setSelectedScholarId('');
      setSequenceCheck({
        checked: true,
        isValid: true,
        permissible: cand.rpcNumber || 1,
        message: `New scholar from Excel roster. Initiating RPC ${cand.rpcNumber || 1}.`,
      });
    }

    setExcelSuccessNotice(
      `Auto-filled from Excel: Sheet "${cand.sourceSheetName}" (${cand.scholarName} — RPC ${cand.rpcNumber || 1})`
    );
    setTimeout(() => setExcelSuccessNotice(null), 4000);
  };

  // Fill form from a Database Scholar
  const fillFormFromScholar = (sch: Scholar) => {
    setSelectedScholarId(sch.id);
    setSelectedCandidate(null);
    setSelectedCandidateId('');

    setScholarName(sch.name);
    setEnrollmentNo(sch.enrollmentNo);
    setSchool(sch.school);
    setDepartment(sch.department || sch.school);
    setResearchTopic(sch.researchTopic || 'Doctoral Research Study at NFSU');
    setRegistrationDate(sch.registrationDate);

    setGuideName(sch.guideName);
    setGuideDesignation(sch.guideDesignation || 'Professor');
    setGuideSchool(sch.guideSchool || sch.school);
    setGuideEmail(sch.guideEmail || '');
    setCoGuideName(sch.coGuideName || '');

    const nextRpc = sch.currentRpcNo || 1;
    setRpcNumber(nextRpc);
    setRpcDate(new Date().toISOString().split('T')[0]);
    setMeetingTime('11:30 AM IST');
    setMeetingMode('ONLINE');
    setVenue('online mode (Google Meet)');
    setRequestDetails(`${nextRpc}th RPC evaluation for Ph.D. Scholar ${sch.name}.`);

    checkSequence(sch.id, nextRpc);
  };

  const checkSequence = async (scholarId: string, rpcNum: number) => {
    try {
      const res = await validateRpcSequence(scholarId, rpcNum);
      if (!rpcNum) {
        setRpcNumber(res.permissibleRpcNumber);
      }
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

  // Handle uploading custom Excel file
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
        fillFormFromCandidate(candidates[0]);
      }
    } catch (err: any) {
      console.error('Excel file reading error:', err);
      setErrorMessage(err.message || 'Failed to read Excel file. Please check file format.');
    } finally {
      setIsUploadingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        fillFormFromCandidate(candidates[0]);
      }
    } catch (err: any) {
      console.error('Error loading sample roster:', err);
      setErrorMessage(err.message || 'Failed to load sample roster.');
    } finally {
      setIsUploadingExcel(false);
    }
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (!scholarName.trim() || !enrollmentNo.trim()) {
        throw new Error('Please provide both Scholar Name and Enrollment Number.');
      }
      if (!guideName.trim()) {
        throw new Error('Please provide the Research Supervisor / Guide Name.');
      }
      if (!internalName.trim() || !ext1Name.trim() || !ext2Name.trim()) {
        throw new Error('Please fill all required committee members (Internal Expert, External 1, External 2).');
      }

      let targetScholar: Scholar;
      let effectiveScholarId: string;

      if (selectedDataSource === 'EXCEL') {
        if (selectedCandidate?.matchedScholarId) {
          const dbSch = scholars.find((s) => s.id === selectedCandidate.matchedScholarId);
          if (dbSch) {
            targetScholar = {
              ...dbSch,
              name: scholarName,
              enrollmentNo,
              school,
              department,
              guideName,
              guideDesignation,
              guideSchool,
              guideEmail,
              coGuideName: coGuideName || undefined,
              researchTopic,
            };
            effectiveScholarId = dbSch.id;
          } else {
            const newId = `sch-${enrollmentNo.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now()}`;
            targetScholar = {
              id: newId,
              name: scholarName,
              enrollmentNo,
              school,
              department: department || school,
              guideName,
              guideDesignation: guideDesignation || 'Professor',
              guideEmail: guideEmail || `${guideName.toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`,
              guideSchool: guideSchool || school,
              coGuideName: coGuideName || undefined,
              registrationDate: registrationDate || new Date().toISOString().split('T')[0],
              researchTopic: researchTopic || 'Doctoral Research Study at NFSU',
              currentRpcNo: rpcNumber,
              status: 'ACTIVE',
              contactDetails: {
                email: `${enrollmentNo.toLowerCase()}@nfsu.ac.in`,
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
          // Construct new scholar object from Excel filled values
          const newId = `sch-${enrollmentNo.toLowerCase().replace(/[^a-z0-9]/g, '') || Date.now()}`;
          targetScholar = {
            id: newId,
            name: scholarName,
            enrollmentNo,
            school,
            department: department || school,
            guideName,
            guideDesignation: guideDesignation || 'Professor',
            guideEmail: guideEmail || `${guideName.toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`,
            guideSchool: guideSchool || school,
            coGuideName: coGuideName || undefined,
            registrationDate: registrationDate || new Date().toISOString().split('T')[0],
            researchTopic: researchTopic || 'Doctoral Research Study at NFSU',
            currentRpcNo: rpcNumber,
            status: 'ACTIVE',
            contactDetails: {
              email: `${enrollmentNo.toLowerCase()}@nfsu.ac.in`,
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
        if (!dbSch) throw new Error('Please select a registered scholar from the database.');
        targetScholar = {
          ...dbSch,
          name: scholarName || dbSch.name,
          enrollmentNo: enrollmentNo || dbSch.enrollmentNo,
          school: school || dbSch.school,
          department: department || dbSch.department,
          guideName: guideName || dbSch.guideName,
          guideDesignation: guideDesignation || dbSch.guideDesignation,
          researchTopic: researchTopic || dbSch.researchTopic,
        };
        effectiveScholarId = dbSch.id;
      }

      // Build Committee Members exactly as specified in the form (filled from Excel or customized)
      const guideMember: RpcMember = {
        id: `guide-${effectiveScholarId}`,
        name: guideName,
        designation: guideDesignation || 'Professor',
        department: department || school,
        schoolOrInstitution: guideSchool || school,
        location: 'NFSU Gandhinagar',
        email: guideEmail || `${guideName.toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`,
        memberType: 'GUIDE',
        addressLine1: guideDesignation || 'Professor',
        addressLine2: guideSchool || school,
        addressLine3: 'NFSU, Gandhinagar',
      };

      const internalMember: RpcMember = {
        id: `internal-${effectiveScholarId}-${Date.now()}`,
        name: internalName,
        designation: internalDesignation || 'Associate Professor',
        department: internalDept || department || school,
        schoolOrInstitution: school,
        location: internalCampus || 'NFSU, Gandhinagar',
        email: `${internalName.toLowerCase().replace(/[^a-z]/g, '.')}@nfsu.ac.in`,
        memberType: 'INTERNAL',
        addressLine1: internalDesignation || 'Associate Professor',
        addressLine2: internalDept || school,
        addressLine3: internalCampus || 'NFSU, Gandhinagar',
      };

      const external1Member: RpcMember = {
        id: `ext1-${effectiveScholarId}-${Date.now()}`,
        name: ext1Name,
        designation: ext1Designation || 'Associate Professor',
        department: ext1Dept || 'External Department',
        schoolOrInstitution: ext1Inst || 'External University / Institution',
        location: ext1City || 'External Location',
        email: `${ext1Name.toLowerCase().replace(/[^a-z]/g, '.')}@external.edu`,
        memberType: 'EXTERNAL_1',
        addressLine1: ext1Designation || 'Associate Professor',
        addressLine2: ext1Dept || ext1Inst || 'External University',
        addressLine3: ext1City || 'External Location',
      };

      const external2Member: RpcMember = {
        id: `ext2-${effectiveScholarId}-${Date.now()}`,
        name: ext2Name,
        designation: ext2Designation || 'Professor',
        department: ext2Dept || 'External Department',
        schoolOrInstitution: ext2Inst || 'External University / Institution',
        location: ext2City || 'External Location',
        email: `${ext2Name.toLowerCase().replace(/[^a-z]/g, '.')}@external.edu`,
        memberType: 'EXTERNAL_2',
        addressLine1: ext2Designation || 'Professor',
        addressLine2: ext2Dept || ext2Inst || 'External University',
        addressLine3: ext2City || 'External Location',
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
          internalExpert: internalMember,
          externalExpert1: external1Member,
          externalExpert2: external2Member,
        },
        requestDetails || `${rpcNumber}th Research Progress Committee (RPC) Meeting request.`,
        currentUser,
        selectedDataSource === 'EXCEL' && !selectedCandidate?.matchedScholarId ? targetScholar : undefined
      );

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
  const formattedRefPreview = `NFSU/SDSR/RPC/${rpcNumber < 10 ? `0${rpcNumber}` : rpcNumber}/25`;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-stone-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
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
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#15244C] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              RPC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">+ New RPC Request</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200">
                  {formattedRefPreview}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                SDSR Office • Auto-fill request format from official Excel data sheets or registered roster
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

        {/* Top Control Bar: Source Switcher & Excel Action Controls */}
        <div className="px-6 py-3 bg-stone-100/80 border-b border-stone-200 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Source Toggle */}
            <div className="inline-flex p-1 bg-white rounded-lg border border-stone-300 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedDataSource('EXCEL');
                  if (excelCandidates.length > 0 && !selectedCandidateId) {
                    fillFormFromCandidate(excelCandidates[0]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  selectedDataSource === 'EXCEL'
                    ? 'bg-[#15244C] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Fill from Excel Data Sheets ({excelCandidates.length})</span>
                {excelCandidates.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedDataSource('DATABASE');
                  if (scholars.length > 0 && !selectedScholarId) {
                    fillFormFromScholar(scholars[0]);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  selectedDataSource === 'DATABASE'
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Registered Scholars ({scholars.length})</span>
              </button>
            </div>

            {/* Quick Action Buttons for Excel */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingExcel}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-md shadow-2xs transition cursor-pointer disabled:opacity-60"
                title="Upload official Excel roster file (.xlsx, .xls, .csv)"
              >
                {isUploadingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-blue-700" />
                )}
                <span>Upload Excel</span>
              </button>

              <button
                type="button"
                onClick={handleQuickLoadSampleRoster}
                disabled={isUploadingExcel}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md shadow-2xs transition cursor-pointer disabled:opacity-60"
                title="Quickly load sample multi-sheet doctoral roster (SPH, SFS, Registrations)"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sample Roster</span>
              </button>

              <button
                type="button"
                onClick={() => downloadExcelTemplate('rpc_requests')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-600 bg-white hover:bg-stone-50 border border-stone-200 rounded-md shadow-2xs transition cursor-pointer"
                title="Download standard Excel template with all RPC request columns"
              >
                <Download className="w-3.5 h-3.5 text-stone-500" />
                <span>Template</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
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
          {/* EXCEL SHEET SELECTOR & CANDIDATE SEARCH                        */}
          {/* ============================================================== */}
          {selectedDataSource === 'EXCEL' && (
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#15244C]" />
                  <span className="text-xs font-bold text-[#15244C] uppercase tracking-wide">
                    Loaded Excel Data Sheets
                  </span>
                  <span className="text-[11px] font-semibold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full">
                    {excelCandidates.length} candidate(s)
                  </span>
                </div>

                {/* Multi-Sheet Selector */}
                {availableSheetNames.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-600 font-medium flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-stone-500" />
                      Sheet:
                    </span>
                    <select
                      value={selectedSheetFilter}
                      onChange={(e) => setSelectedSheetFilter(e.target.value)}
                      id="select-excel-sheet"
                      className="text-xs rounded-md border border-blue-300 bg-white px-2.5 py-1 text-stone-800 font-semibold focus:outline-hidden"
                    >
                      <option value="ALL">All Sheets ({excelCandidates.length})</option>
                      {availableSheetNames.map((sheetName) => {
                        const count = excelCandidates.filter((c) => c.sourceSheetName === sheetName).length;
                        return (
                          <option key={sheetName} value={sheetName}>
                            {sheetName} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {excelCandidates.length === 0 ? (
                /* Empty Excel State */
                <div className="p-5 border-2 border-dashed border-blue-300 rounded-lg text-center bg-white space-y-2.5">
                  <FileSpreadsheet className="w-8 h-8 text-blue-400 mx-auto" />
                  <div>
                    <h3 className="text-xs font-bold text-stone-900">No Excel Roster Data Loaded Yet</h3>
                    <p className="text-[11px] text-stone-500 max-w-md mx-auto mt-0.5">
                      Upload an official roster spreadsheet (.xlsx, .xls, .csv) or click "Sample Roster" to load test candidates from SPH, SFS, and New Registrations sheets.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded-md shadow-xs cursor-pointer"
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
                      Quick Load Sample Multi-Sheet Roster
                    </button>
                  </div>
                </div>
              ) : (
                /* Candidate Selection and Search */
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search candidate by name, enrollment, or guide..."
                        value={candidateSearchQuery}
                        onChange={(e) => setCandidateSearchQuery(e.target.value)}
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-md border border-stone-300 bg-white text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Candidate Dropdown */}
                    <div className="flex-1">
                      <select
                        value={selectedCandidateId}
                        onChange={(e) => {
                          const cand = excelCandidates.find((c) => c.id === e.target.value);
                          if (cand) fillFormFromCandidate(cand);
                        }}
                        id="select-excel-candidate"
                        className="w-full text-xs rounded-md border border-stone-300 p-2 bg-white text-stone-900 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        {filteredCandidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.scholarName} ({c.enrollmentNo || 'No Enroll'}) • [RPC {c.rpcNumber || 1}] — {c.sourceSheetName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Auto-filled details banner */}
                  {selectedCandidate && (
                    <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#15244C] text-[13px] flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Details Auto-Filled from Sheet: <em>{selectedCandidate.sourceSheetName}</em>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#15244C] text-white">
                          File: {selectedCandidate.sourceFileName}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-stone-700 pt-1 border-t border-stone-100">
                        <div>
                          <span className="text-stone-500">Scholar: </span>
                          <strong className="text-stone-900">{selectedCandidate.scholarName}</strong>
                        </div>
                        <div>
                          <span className="text-stone-500">Enrollment: </span>
                          <strong className="text-stone-900">{selectedCandidate.enrollmentNo || 'New'}</strong>
                        </div>
                        <div>
                          <span className="text-stone-500">Guide: </span>
                          <strong className="text-stone-900">{selectedCandidate.guideName}</strong>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between pt-1 text-[11px] text-stone-600">
                        <span>
                          Meeting: <strong>{rpcDate}</strong> at <strong>{meetingTime}</strong> ({meetingMode})
                        </span>
                        <span>
                          Experts: <strong>{internalName}</strong>, <strong>{ext1Name}</strong>, <strong>{ext2Name}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* DATABASE SCHOLAR SELECTOR                                      */}
          {/* ============================================================== */}
          {selectedDataSource === 'DATABASE' && (
            <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
              <label className="block text-xs font-bold text-stone-800">
                Select Ph.D. Research Scholar (from University Database) *
              </label>
              <select
                value={selectedScholarId}
                onChange={(e) => {
                  const sch = scholars.find((s) => s.id === e.target.value);
                  if (sch) fillFormFromScholar(sch);
                }}
                id="select-scholar"
                className="w-full text-xs rounded-md border border-stone-300 p-2.5 bg-white text-stone-900 font-medium focus:outline-hidden focus:ring-1 focus:ring-stone-500"
                required
              >
                {scholars.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.enrollmentNo}) — {s.school} • [Current: RPC {s.currentRpcNo || 1}]
                  </option>
                ))}
              </select>

              {currentDbScholar && (
                <div className="p-2.5 bg-white rounded-md border border-stone-200 text-xs flex justify-between items-center text-stone-600">
                  <div>
                    Supervisor: <strong>{currentDbScholar.guideName}</strong> ({currentDbScholar.school})
                  </div>
                  <div>
                    Sequential Next: <strong className="text-emerald-700">RPC {sequenceCheck.permissible}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* FORM: NEW RPC REQUEST FORMAT (ALL EDITABLE DETAILS)            */}
          {/* ============================================================== */}
          <form id="form-new-rpc" onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Scholar Information */}
            <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 uppercase tracking-wide border-b border-stone-100 pb-1.5">
                <User className="w-3.5 h-3.5 text-blue-700" />
                <span>1. Scholar Identification & Academic Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Scholar Full Name *
                  </label>
                  <input
                    type="text"
                    value={scholarName}
                    onChange={(e) => setScholarName(e.target.value)}
                    id="input-scholar-name"
                    required
                    placeholder="e.g. MS. DEVANSHI LUNAGARIYA"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-semibold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Enrollment / Registration No. *
                  </label>
                  <input
                    type="text"
                    value={enrollmentNo}
                    onChange={(e) => setEnrollmentNo(e.target.value)}
                    id="input-scholar-enrollment"
                    required
                    placeholder="e.g. 240112006033"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Enrolled School / Institute *
                  </label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    id="input-scholar-school"
                    required
                    placeholder="e.g. School of Pharmacy / School of Forensic Science"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Department / Discipline
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    id="input-scholar-dept"
                    placeholder="e.g. Pharmaceutical Quality Assurance / Forensic Toxicology"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Research Topic / Ph.D. Synopsis Title
                </label>
                <input
                  type="text"
                  value={researchTopic}
                  onChange={(e) => setResearchTopic(e.target.value)}
                  id="input-scholar-topic"
                  placeholder="e.g. Design and Analytical Evaluation of Novel Targeted Nanocarriers..."
                  className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Section 2: Research Supervisor / Guide Details */}
            <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 uppercase tracking-wide border-b border-stone-100 pb-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                <span>2. Research Supervisor / Guide Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Guide / Supervisor Name *
                  </label>
                  <input
                    type="text"
                    value={guideName}
                    onChange={(e) => setGuideName(e.target.value)}
                    id="input-guide-name"
                    required
                    placeholder="e.g. Prof. (Dr.) Manjunath Ghate"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Guide Designation
                  </label>
                  <input
                    type="text"
                    value={guideDesignation}
                    onChange={(e) => setGuideDesignation(e.target.value)}
                    id="input-guide-designation"
                    placeholder="e.g. Professor & Director / Associate Professor"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Guide School / Department
                  </label>
                  <input
                    type="text"
                    value={guideSchool}
                    onChange={(e) => setGuideSchool(e.target.value)}
                    id="input-guide-school"
                    placeholder="e.g. School of Pharmacy"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Guide Email Address
                  </label>
                  <input
                    type="email"
                    value={guideEmail}
                    onChange={(e) => setGuideEmail(e.target.value)}
                    id="input-guide-email"
                    placeholder="e.g. manjunath.ghate@nfsu.ac.in"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Co-Guide / Co-Supervisor Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={coGuideName}
                    onChange={(e) => setCoGuideName(e.target.value)}
                    id="input-co-guide-name"
                    placeholder="e.g. Dr. Bhoomika Patel (if applicable)"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: RPC Evaluation Stage & Scheduling Details */}
            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 uppercase tracking-wide">
                  <Clock className="w-3.5 h-3.5 text-blue-700" />
                  <span>3. Evaluation Stage & Meeting Schedule</span>
                </div>

                {/* RPC Stage input supporting any digits from thousands */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-900">RPC Stage:</span>
                  <div className="flex items-center gap-1 bg-white border border-blue-300 rounded-md px-2 py-0.5 shadow-2xs">
                    <span className="text-xs font-bold text-blue-900">RPC</span>
                    <input
                      id="input-new-rpc-number"
                      type="number"
                      min="1"
                      value={rpcNumber}
                      onChange={(e) => setRpcNumber(parseInt(e.target.value, 10) || 1)}
                      className="w-16 text-xs font-bold text-stone-900 bg-transparent text-center focus:outline-hidden"
                      placeholder="e.g. 1000"
                      title="Enter any RPC digits (supports thousands e.g. 1000)"
                    />
                    <span className="text-[11px] text-blue-800 font-medium">
                      ({getOrdinalText(rpcNumber)})
                    </span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1">
                    {[1, 2, 3, 4, 100, 1000].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRpcNumber(num)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border cursor-pointer ${
                          rpcNumber === num
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {sequenceCheck.checked && sequenceCheck.permissible !== rpcNumber && (
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                  Notice: Standard sequence from records is RPC {sequenceCheck.permissible}. You are initiating RPC {rpcNumber} via SDSR Office administrative override.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    <span>Scheduled Date *</span>
                  </label>
                  <input
                    type="date"
                    value={rpcDate}
                    onChange={(e) => setRpcDate(e.target.value)}
                    id="input-rpc-date"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 bg-white focus:outline-hidden"
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
                    placeholder="e.g. 11:30 AM IST / 02:30 PM"
                    id="input-rpc-time"
                    className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 bg-white focus:outline-hidden"
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
                    className="w-full text-xs rounded-md border border-stone-300 p-2 bg-white text-stone-900 focus:outline-hidden"
                  >
                    <option value="ONLINE">Online Mode</option>
                    <option value="OFFLINE">Offline (In-Person)</option>
                    <option value="HYBRID">Hybrid Mode</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Venue or Meeting Link *
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Google Meet: meet.google.com/sph-rpc-01 / Conference Room 102"
                  id="input-rpc-venue"
                  className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 bg-white focus:outline-hidden"
                  required
                />
              </div>
            </div>

            {/* Section 4: Committee Members (Internal & External Experts) */}
            <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 uppercase tracking-wide">
                  <Users className="w-3.5 h-3.5 text-blue-700" />
                  <span>4. Proposed Committee Members (Auto-Filled & Editable)</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-medium">
                  Preserves details from Excel
                </span>
              </div>

              {/* Internal Expert */}
              <div className="p-3 bg-stone-50/70 border border-stone-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-900">
                    Internal Expert (NFSU Faculty Member) *
                  </label>
                  {members.filter((m) => m.memberType === 'INTERNAL').length > 0 && (
                    <select
                      onChange={(e) => {
                        const m = members.find((mem) => mem.id === e.target.value);
                        if (m) {
                          setInternalName(m.name);
                          setInternalDesignation(m.designation || 'Associate Professor');
                          setInternalDept(m.department || 'NFSU');
                          setInternalCampus(m.location || 'NFSU, Gandhinagar');
                        }
                      }}
                      className="text-[11px] rounded border border-stone-300 bg-white px-2 py-0.5 text-stone-700"
                    >
                      <option value="">Quick Presets...</option>
                      {members
                        .filter((m) => m.memberType === 'INTERNAL')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.designation})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={internalName}
                    onChange={(e) => setInternalName(e.target.value)}
                    placeholder="Expert Name (e.g. Dr. Bhoomika Patel)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900 font-medium"
                    required
                  />
                  <input
                    type="text"
                    value={internalDesignation}
                    onChange={(e) => setInternalDesignation(e.target.value)}
                    placeholder="Designation (e.g. Associate Professor & Dean I/C)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={internalDept}
                    onChange={(e) => setInternalDept(e.target.value)}
                    placeholder="Department / School (e.g. School of Pharmacy)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                  <input
                    type="text"
                    value={internalCampus}
                    onChange={(e) => setInternalCampus(e.target.value)}
                    placeholder="Campus / Location (e.g. NFSU, Gandhinagar)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                </div>
              </div>

              {/* External Expert 1 */}
              <div className="p-3 bg-stone-50/70 border border-stone-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-900">
                    External Expert 1 (External Academic / Subject Expert) *
                  </label>
                  {members.filter((m) => m.memberType === 'EXTERNAL_1').length > 0 && (
                    <select
                      onChange={(e) => {
                        const m = members.find((mem) => mem.id === e.target.value);
                        if (m) {
                          setExt1Name(m.name);
                          setExt1Designation(m.designation || 'Associate Professor');
                          setExt1Dept(m.department || 'External Department');
                          setExt1Inst(m.schoolOrInstitution || 'External University');
                          setExt1City(m.location || 'Gujarat');
                        }
                      }}
                      className="text-[11px] rounded border border-stone-300 bg-white px-2 py-0.5 text-stone-700"
                    >
                      <option value="">Quick Presets...</option>
                      {members
                        .filter((m) => m.memberType === 'EXTERNAL_1')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.schoolOrInstitution})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ext1Name}
                    onChange={(e) => setExt1Name(e.target.value)}
                    placeholder="Expert Name (e.g. Dr. Dhiraj Bhatia)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900 font-medium"
                    required
                  />
                  <input
                    type="text"
                    value={ext1Designation}
                    onChange={(e) => setExt1Designation(e.target.value)}
                    placeholder="Designation (e.g. Associate Professor & INYAS-INSA Member)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={ext1Dept}
                    onChange={(e) => setExt1Dept(e.target.value)}
                    placeholder="Department (e.g. Biological Science & Eng.)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                  <input
                    type="text"
                    value={ext1Inst}
                    onChange={(e) => setExt1Inst(e.target.value)}
                    placeholder="University / Institute (e.g. IIT Gandhinagar)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                  <input
                    type="text"
                    value={ext1City}
                    onChange={(e) => setExt1City(e.target.value)}
                    placeholder="Location / City (e.g. Gujarat)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                </div>
              </div>

              {/* External Expert 2 */}
              <div className="p-3 bg-stone-50/70 border border-stone-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-900">
                    External Expert 2 (External Academic / Industry Expert) *
                  </label>
                  {members.filter((m) => m.memberType === 'EXTERNAL_2').length > 0 && (
                    <select
                      onChange={(e) => {
                        const m = members.find((mem) => mem.id === e.target.value);
                        if (m) {
                          setExt2Name(m.name);
                          setExt2Designation(m.designation || 'Professor');
                          setExt2Dept(m.department || 'External Department');
                          setExt2Inst(m.schoolOrInstitution || 'External University');
                          setExt2City(m.location || 'India');
                        }
                      }}
                      className="text-[11px] rounded border border-stone-300 bg-white px-2 py-0.5 text-stone-700"
                    >
                      <option value="">Quick Presets...</option>
                      {members
                        .filter((m) => m.memberType === 'EXTERNAL_2')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.schoolOrInstitution})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ext2Name}
                    onChange={(e) => setExt2Name(e.target.value)}
                    placeholder="Expert Name (e.g. Prof. (Dr.) Sanjay K. Jain)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900 font-medium"
                    required
                  />
                  <input
                    type="text"
                    value={ext2Designation}
                    onChange={(e) => setExt2Designation(e.target.value)}
                    placeholder="Designation (e.g. Professor & Dean)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={ext2Dept}
                    onChange={(e) => setExt2Dept(e.target.value)}
                    placeholder="Department (e.g. Pharmaceutical Sciences)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                  <input
                    type="text"
                    value={ext2Inst}
                    onChange={(e) => setExt2Inst(e.target.value)}
                    placeholder="University / Institute (e.g. Central University of Gujarat)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                  <input
                    type="text"
                    value={ext2City}
                    onChange={(e) => setExt2City(e.target.value)}
                    placeholder="Location / City (e.g. Gandhinagar)"
                    className="text-xs rounded border border-stone-300 p-1.5 bg-white text-stone-900"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Request Synopsis & Notes */}
            <div className="p-4 bg-white border border-stone-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-stone-900">
                Request Notes / Synopsis / Progress Verification Remarks
              </label>
              <textarea
                value={requestDetails}
                onChange={(e) => setRequestDetails(e.target.value)}
                rows={2}
                id="input-rpc-notes"
                placeholder="e.g. Research progress synopsis received and verified by Guide for progress evaluation."
                className="w-full text-xs rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden"
              />
            </div>

            {/* Section 6: Official Reference & Subject Preview */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between text-stone-500 font-mono text-[11px]">
                <span>Document Ref: <strong>{formattedRefPreview}</strong></span>
                <span>Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong></span>
              </div>
              <div className="text-stone-700">
                <strong>Letter Subject:</strong>{' '}
                <span className="italic">
                  {getOrdinalText(rpcNumber)} Meeting of the Research Progress Committee (RPC) for Ph.D. Scholar {scholarName || 'Registered Scholar'} under {guideName || 'Guide'}, NFSU.
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-stone-200">
              <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-stone-400" />
                <span>SDSR Office Administrative Authority • Press Ctrl+Enter to submit</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-md border border-stone-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  id="btn-submit-new-rpc"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating RPC Request...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {selectedDataSource === 'EXCEL'
                          ? 'Create RPC Request from Excel Data'
                          : 'Create RPC Request'}
                      </span>
                      <kbd className="hidden sm:inline-block font-mono text-[10px] bg-stone-700 text-stone-200 border border-stone-600 px-1 py-0.2 rounded">
                        Ctrl+↵
                      </kbd>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

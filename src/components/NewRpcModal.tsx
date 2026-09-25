import React, { useState, useEffect } from 'react';
import { Scholar, RpcMember, UserProfile, MeetingMode } from '../types';
import {
  getAllScholars,
  getAllMembers,
  validateRpcSequence,
  createNewRpcRequest,
} from '../services/dataService';
import { X, Calendar, Clock, User, AlertCircle, CheckCircle2, Building } from 'lucide-react';

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
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [members, setMembers] = useState<RpcMember[]>([]);
  const [selectedScholarId, setSelectedScholarId] = useState<string>('');
  const [rpcNumber, setRpcNumber] = useState<number>(1);
  const [rpcDate, setRpcDate] = useState<string>('2025-10-15');
  const [meetingTime, setMeetingTime] = useState<string>('11:30 AM');
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('ONLINE');
  const [venue, setVenue] = useState<string>('online mode (Google Meet)');
  const [requestDetails, setRequestDetails] = useState<string>('');

  // Selected members
  const [selectedInternalId, setSelectedInternalId] = useState<string>('');
  const [selectedExternal1Id, setSelectedExternal1Id] = useState<string>('');
  const [selectedExternal2Id, setSelectedExternal2Id] = useState<string>('');

  // Sequence Validation state
  const [sequenceCheck, setSequenceCheck] = useState<{
    checked: boolean;
    isValid: boolean;
    permissible: number;
    message: string;
  }>({ checked: false, isValid: true, permissible: 1, message: '' });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    const sList = await getAllScholars();
    const mList = await getAllMembers();
    setScholars(sList);
    setMembers(mList);

    if (sList.length > 0) {
      const first = sList[0];
      setSelectedScholarId(first.id);
      checkSequence(first.id, first.currentRpcNo || 1);
    }

    // Set default members
    const internal = mList.find((m) => m.memberType === 'INTERNAL');
    const ext1 = mList.find((m) => m.memberType === 'EXTERNAL_1');
    const ext2 = mList.find((m) => m.memberType === 'EXTERNAL_2');

    if (internal) setSelectedInternalId(internal.id);
    if (ext1) setSelectedExternal1Id(ext1.id);
    if (ext2) setSelectedExternal2Id(ext2.id);
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

  const handleScholarChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const schId = e.target.value;
    setSelectedScholarId(schId);
    const sch = scholars.find((s) => s.id === schId);
    if (sch) {
      checkSequence(sch.id, sch.currentRpcNo || 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const scholar = scholars.find((s) => s.id === selectedScholarId);
      if (!scholar) throw new Error('Please select a scholar.');

      const internalExp = members.find((m) => m.id === selectedInternalId);
      const ext1Exp = members.find((m) => m.id === selectedExternal1Id);
      const ext2Exp = members.find((m) => m.id === selectedExternal2Id);

      if (!internalExp || !ext1Exp || !ext2Exp) {
        throw new Error('Please assign all required committee members (Internal, External 1, External 2).');
      }

      // Guide is retrieved from scholar record
      const guideMember: RpcMember = {
        id: `guide-${scholar.id}`,
        name: scholar.guideName,
        designation: scholar.guideDesignation,
        department: scholar.department,
        schoolOrInstitution: scholar.guideSchool || scholar.school,
        location: 'NFSU Gandhinagar',
        email: scholar.guideEmail,
        memberType: 'GUIDE',
        addressLine1: scholar.guideDesignation,
        addressLine2: scholar.guideSchool || scholar.school,
        addressLine3: 'NFSU, Gandhinagar',
      };

      const newRecord = await createNewRpcRequest(
        scholar.id,
        sequenceCheck.permissible,
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
        requestDetails || `${sequenceCheck.permissible}th Research Progress Committee (RPC) Meeting request.`,
        currentUser
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

  const currentScholar = scholars.find((s) => s.id === selectedScholarId);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-stone-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div>
            <h2 className="text-base font-bold text-stone-900">+ New RPC Request</h2>
            <p className="text-xs text-stone-500">
              Office of SDSR — Ph.D. Research Progress Committee Processing
            </p>
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

        {/* Modal Body */}
        <form id="form-new-rpc" onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Scholar Selection */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Select Ph.D. Research Scholar *
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
          {currentScholar && (
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs space-y-1">
              <div className="flex justify-between items-center text-stone-600">
                <span>Supervisor / Guide:</span>
                <span className="font-semibold text-stone-900">{currentScholar.guideName}</span>
              </div>
              <div className="flex justify-between items-center text-stone-600">
                <span>Enrolled School:</span>
                <span className="font-medium text-stone-800">{currentScholar.school}</span>
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

          {/* Date, Time and Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                RPC Date *
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
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Meeting Time *
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

          {/* Venue / Link */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Venue or Meeting Platform
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Online MS Teams / SDSR Committee Room 102"
              id="input-rpc-venue"
              className="w-full text-sm rounded-md border border-stone-300 p-2 text-stone-900 focus:outline-hidden"
            />
          </div>

          {/* Proposed Members Selection */}
          <div className="pt-2 border-t border-stone-200">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">
              Proposed Committee Members
            </h3>

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

          {/* Request Details */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Request Notes / Ph.D. Cell Reference Details
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
              disabled={loading}
              id="btn-submit-new-rpc"
              title="Initiate RPC Request (Ctrl+Enter / Cmd+Enter)"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-md shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Creating Request...' : 'Initiate RPC Request'}</span>
              <kbd className="hidden sm:inline-block font-mono text-[10px] bg-stone-700 text-stone-200 border border-stone-600 px-1 py-0.2 rounded">
                Ctrl+↵
              </kbd>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

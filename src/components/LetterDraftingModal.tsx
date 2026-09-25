import React, { useState, useEffect } from 'react';
import { RpcRecord, OfficialLetterData, UserProfile } from '../types';
import { OfficialRpcLetter } from './OfficialRpcLetter';
import { saveDraftLetter, validateForForwarding } from '../services/dataService';
import { X, Save, Send, Download, Check, AlertCircle, Edit3, Eye, Loader2, Printer } from 'lucide-react';
import { downloadLetterElementAsPdf, generateLetterPdfFilename } from '../utils/pdfExport';

interface LetterDraftingModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RpcRecord;
  currentUser: UserProfile;
  onSaveSuccess: (updatedRecord: RpcRecord) => void;
  onForwardToDeanClick: () => void;
}

export const LetterDraftingModal: React.FC<LetterDraftingModalProps> = ({
  isOpen,
  onClose,
  record,
  currentUser,
  onSaveSuccess,
  onForwardToDeanClick,
}) => {
  // Controlled template dynamic fields
  const [formData, setFormData] = useState<OfficialLetterData>(
    record.letterData || {
      refNo: `NFSU/SDSR/RPC/0${record.rpcNumber}/25`,
      date: new Date().toLocaleDateString('en-GB'),
      schoolName: record.school,
      schoolCampus: 'Gandhinagr',
      guideName: record.rpcMembers?.guide?.name || '',
      guideDesignation: record.rpcMembers?.guide?.designation || '',
      guideSchool: record.rpcMembers?.guide?.schoolOrInstitution || record.school,
      internalExpertName: record.rpcMembers?.internalExpert?.name || '',
      internalExpertDesignation: record.rpcMembers?.internalExpert?.designation || '',
      internalExpertDept: record.rpcMembers?.internalExpert?.department || '',
      internalExpertCampus: record.rpcMembers?.internalExpert?.location || 'NFSU, Gandhinagar',
      externalExpert1Name: record.rpcMembers?.externalExpert1?.name || '',
      externalExpert1Designation: record.rpcMembers?.externalExpert1?.designation || '',
      externalExpert1Dept: record.rpcMembers?.externalExpert1?.department || '',
      externalExpert1Inst: record.rpcMembers?.externalExpert1?.schoolOrInstitution || '',
      externalExpert1City: record.rpcMembers?.externalExpert1?.location || '',
      externalExpert2Name: record.rpcMembers?.externalExpert2?.name || '',
      externalExpert2Designation: record.rpcMembers?.externalExpert2?.designation || '',
      externalExpert2Dept: record.rpcMembers?.externalExpert2?.department || '',
      externalExpert2Inst: record.rpcMembers?.externalExpert2?.schoolOrInstitution || '',
      externalExpert2City: record.rpcMembers?.externalExpert2?.location || '',
      subject: `${record.rpcNumber === 1 ? '1st' : record.rpcNumber === 2 ? '2nd' : record.rpcNumber === 3 ? '3rd' : `${record.rpcNumber}th`} Meeting of the Research Progress Committee (RPC) for Ph.D. Scholar Registered under ${record.rpcMembers?.guide?.name || ''}, ${record.rpcMembers?.guide?.designation || ''}, NFSU.`,
      meetingDateText: record.rpcDate ? new Date(record.rpcDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be confirmed',
      meetingTimeText: record.meetingTime || '11:00 AM',
      meetingModeText: record.meetingMode === 'ONLINE' ? 'online mode' : record.meetingMode === 'HYBRID' ? 'hybrid mode' : 'physical mode',
      meetingVenue: record.venue || '',
      scholarName: record.scholarName,
      rpcOrdinal: record.rpcNumber === 1 ? '1st' : record.rpcNumber === 2 ? '2nd' : record.rpcNumber === 3 ? '3rd' : `${record.rpcNumber}th`,
      copyTo: ['Associate Dean- SDSR'],
    }
  );

  const isLocked = record.status === 'PENDING_DEAN_APPROVAL' || record.status === 'APPROVED';

  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'edit'>('preview');
  const [saving, setSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Keyboard shortcut handler for Esc (close) and Ctrl+S / Cmd+S (save draft)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Ctrl+S or Cmd+S to save draft
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!isLocked && !saving) {
          handleSaveDraft();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLocked, saving, formData, record.id, currentUser]);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    const el = document.getElementById('nfsu-official-letter-sheet');
    if (!el || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const filename = generateLetterPdfFilename(record, formData);
      await downloadLetterElementAsPdf(el, filename, record);
    } catch (err) {
      console.error('Failed to export letter as PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleFieldChange = (field: keyof OfficialLetterData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setErrorMessage('');
    try {
      const updated = await saveDraftLetter(record.id, formData, currentUser);
      onSaveSuccess(updated);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save draft letter.');
    } finally {
      setSaving(false);
    }
  };

  const handleForwardClick = () => {
    // Validate mandatory fields
    const val = validateForForwarding({ ...record, letterData: formData });
    if (!val.isValid) {
      setErrorMessage(`Cannot forward to Dean. Please complete: ${val.errors.join('; ')}`);
      return;
    }
    onForwardToDeanClick();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="bg-stone-100 rounded-xl shadow-2xl max-w-5xl w-full border border-stone-300 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 bg-white border-b border-stone-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900">
                Official Institutional RPC Letter
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-mono">
                Ref: {formData.refNo}
              </span>
            </div>
            <p className="text-xs text-stone-500">
              National Forensic Sciences University — Controlled Official Template
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Subtab Toggle (Preview / Edit Fields) */}
            <div className="flex rounded-md bg-stone-100 p-0.5 border border-stone-300 text-xs">
              <button
                type="button"
                onClick={() => setActiveSubTab('preview')}
                className={`flex items-center gap-1 px-3 py-1 rounded font-medium transition ${
                  activeSubTab === 'preview' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Letter Preview
              </button>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab('edit')}
                  className={`flex items-center gap-1 px-3 py-1 rounded font-medium transition ${
                    activeSubTab === 'edit' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Letter Fields
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 text-stone-400 hover:text-stone-700 p-1.5 rounded transition cursor-pointer"
              aria-label="Close"
              title="Close modal (Esc)"
            >
              <kbd className="hidden sm:inline-block text-[10px] bg-stone-100 text-stone-500 border border-stone-300 px-1.5 py-0.5 rounded font-mono font-normal">
                Esc
              </kbd>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notices */}
        {saveSuccessNotice && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            Draft letter saved successfully from controlled template!
          </div>
        )}

        {errorMessage && (
          <div className="px-6 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            {errorMessage}
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center bg-stone-200/60">
          {activeSubTab === 'preview' ? (
            <div className="w-full flex justify-center">
              <OfficialRpcLetter
                letterData={formData}
                rpcRecord={record}
                isApproved={record.status === 'APPROVED'}
                showActions={false}
              />
            </div>
          ) : (
            /* Edit Controlled Dynamic Fields */
            <div className="w-full max-w-3xl bg-white p-6 rounded-lg border border-stone-300 shadow-xs space-y-4">
              <div className="border-b border-stone-200 pb-2">
                <h3 className="text-sm font-bold text-stone-900">
                  Institutional Template Dynamic Fields
                </h3>
                <p className="text-xs text-stone-500">
                  Values are bound to university database records to prevent unauthorized deviations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Official Reference Number *
                  </label>
                  <input
                    type="text"
                    value={formData.refNo}
                    onChange={(e) => handleFieldChange('refNo', e.target.value)}
                    className="w-full text-xs font-mono p-2 border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Dispatch / Letter Date *
                  </label>
                  <input
                    type="text"
                    value={formData.date}
                    onChange={(e) => handleFieldChange('date', e.target.value)}
                    className="w-full text-xs p-2 border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Meeting Scheduled Date Text *
                  </label>
                  <input
                    type="text"
                    value={formData.meetingDateText}
                    onChange={(e) => handleFieldChange('meetingDateText', e.target.value)}
                    className="w-full text-xs p-2 border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Meeting Time Text *
                  </label>
                  <input
                    type="text"
                    value={formData.meetingTimeText}
                    onChange={(e) => handleFieldChange('meetingTimeText', e.target.value)}
                    className="w-full text-xs p-2 border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Meeting Mode Text *
                  </label>
                  <input
                    type="text"
                    value={formData.meetingModeText}
                    onChange={(e) => handleFieldChange('meetingModeText', e.target.value)}
                    className="w-full text-xs p-2 border border-stone-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Venue / Meeting Room / Online Link
                  </label>
                  <input
                    type="text"
                    value={formData.meetingVenue || ''}
                    onChange={(e) => handleFieldChange('meetingVenue', e.target.value)}
                    className="w-full text-xs p-2 border border-stone-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Subject Line *
                </label>
                <textarea
                  value={formData.subject}
                  onChange={(e) => handleFieldChange('subject', e.target.value)}
                  rows={2}
                  className="w-full text-xs p-2 border border-stone-300 rounded"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-stone-500 flex flex-wrap items-center gap-2.5">
            {isLocked ? (
              <span className="text-amber-800 font-medium">
                Document is locked in current status ({record.status}).
              </span>
            ) : (
              <span>Template updates are audited in SDSR activity logs.</span>
            )}
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-stone-500 bg-stone-50 px-2 py-0.5 rounded border border-stone-200 font-medium">
              <span className="text-stone-400">Shortcuts:</span>
              <kbd className="font-mono font-semibold text-stone-700 bg-white px-1.5 py-0.5 rounded border border-stone-300 text-[10px]">
                Ctrl+S
              </kbd>
              <span>Save</span>
              <span className="text-stone-300">•</span>
              <kbd className="font-mono font-semibold text-stone-700 bg-white px-1.5 py-0.5 rounded border border-stone-300 text-[10px]">
                Esc
              </kbd>
              <span>Close</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              id="btn-download-draft-pdf"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 rounded border border-stone-300 shadow-xs transition cursor-pointer disabled:opacity-60"
              title="Download letter as PDF via jsPDF"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download as PDF
                </>
              )}
            </button>

            <button
              onClick={() => window.print()}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-300 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            {!isLocked && (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  id="btn-save-draft-letter"
                  type="button"
                  title="Save draft (Ctrl+S / Cmd+S)"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-stone-800 bg-white hover:bg-stone-50 rounded border border-stone-400 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 text-stone-600" />
                  <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                  <kbd className="hidden sm:inline-block font-mono text-[10px] text-stone-500 bg-stone-100 px-1 py-0.5 rounded border border-stone-300">
                    Ctrl+S
                  </kbd>
                </button>

                {currentUser.role === 'SDSR_OFFICE' && (
                  <button
                    onClick={handleForwardClick}
                    id="btn-forward-dean-modal"
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-black rounded shadow-xs transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Forward to Dean, SDSR
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

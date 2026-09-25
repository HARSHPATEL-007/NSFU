import React, { useState, useEffect } from 'react';
import { UserProfile, RpcRecord, Scholar } from './types';
import { DEMO_USERS } from './data/initialDemoData';
import {
  initializeDatabase,
  getAllRpcRecords,
  getRpcRecordById,
  getAllScholars,
  getScholarRpcHistory,
} from './services/dataService';
import { SDSRNavbar } from './components/SDSRNavbar';
import { OfficeDashboard } from './components/OfficeDashboard';
import { DeanDashboard } from './components/DeanDashboard';
import { ScholarWorkspace } from './components/ScholarWorkspace';
import { DeanReviewScreen } from './components/DeanReviewScreen';
import { NewRpcModal } from './components/NewRpcModal';
import { LetterDraftingModal } from './components/LetterDraftingModal';
import { ForwardConfirmationModal } from './components/ForwardConfirmationModal';
import { LetterViewerModal } from './components/LetterViewerModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { LoginScreen } from './components/LoginScreen';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const STORAGE_KEY_USER = 'nfsu_sdsr_active_user';

export default function App() {
  // Active User Profile: Separate two login portals, null if not logged in
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id === 'user-office-1' || parsed.id === 'user-dean-1')) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read user session:', e);
    }
    return null;
  });

  // Data records
  const [records, setRecords] = useState<RpcRecord[]>([]);
  const [scholars, setScholars] = useState<Scholar[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view navigation: 'dashboard' | 'workspace' | 'dean-review'
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'dean-review'>('dashboard');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // Modals state
  const [isNewRpcModalOpen, setIsNewRpcModalOpen] = useState(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [draftingRecord, setDraftingRecord] = useState<RpcRecord | null>(null);
  const [forwardingRecord, setForwardingRecord] = useState<RpcRecord | null>(null);
  const [viewingLetterState, setViewingLetterState] = useState<{ record: RpcRecord; autoDownload?: boolean } | null>(null);

  const handleOpenLetterModal = (rec: RpcRecord, autoDownload = false) => {
    setViewingLetterState({ record: rec, autoDownload });
  };

  // Global Toast / Notice
  const [toastNotice, setToastNotice] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToastNotice({ message, type });
    setTimeout(() => setToastNotice(null), 4000);
  };

  useEffect(() => {
    bootApp();
  }, []);

  const bootApp = async () => {
    setLoading(true);
    try {
      await initializeDatabase();
      const recs = await getAllRpcRecords();
      const schs = await getAllScholars();
      setRecords(recs);
      setScholars(schs);
    } catch (err) {
      console.warn('Error during boot:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    const recs = await getAllRpcRecords();
    const schs = await getAllScholars();
    setRecords(recs);
    setScholars(schs);
  };

  // Login handler for the two distinct portals
  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch (e) {
      console.warn('Could not save user session:', e);
    }
    setCurrentView('dashboard');
    setSelectedRecordId(null);
    showToast(
      `Logged in to ${user.role === 'DEAN_SDSR' ? 'Dean, SDSR Approval Portal' : 'SDSR Office Portal'}`,
      'success'
    );
  };

  // Sign out handler (No role switching permitted during active session)
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch (e) {
      console.warn('Could not clear user session:', e);
    }
    setCurrentView('dashboard');
    setSelectedRecordId(null);
    showToast('Signed out of portal session.', 'info');
  };

  // SDSR Office: Open record in Scholar Workspace
  const handleOpenRecordInWorkspace = (recordId: string) => {
    setSelectedRecordId(recordId);
    if (currentUser?.role === 'DEAN_SDSR') {
      setCurrentView('dean-review');
    } else {
      setCurrentView('workspace');
    }
  };

  // Dean: Review record
  const handleDeanReviewRecord = (recordId: string) => {
    setSelectedRecordId(recordId);
    setCurrentView('dean-review');
  };

  // Successfully created new RPC request
  const handleNewRpcCreated = async (newId: string) => {
    await refreshData();
    setSelectedRecordId(newId);
    setCurrentView('workspace');
    showToast('New RPC request initiated successfully and loaded into Scholar Workspace.');
  };

  // Successfully forwarded to Dean
  const handleForwardSuccess = async (updated: RpcRecord) => {
    await refreshData();
    if (selectedRecordId === updated.id) {
      // Refresh record in workspace
    }
    showToast(`RPC ${updated.rpcNumber} for ${updated.scholarName} forwarded to Dean, SDSR for approval.`);
  };

  // Successfully saved letter draft
  const handleLetterSaved = async (updated: RpcRecord) => {
    await refreshData();
    setDraftingRecord(updated);
    showToast(`Official letter draft saved for RPC ${updated.rpcNumber}.`);
  };

  // Dean action completed (Approve or Return)
  const handleDeanActionComplete = async (updated: RpcRecord) => {
    await refreshData();
    if (updated.status === 'APPROVED') {
      showToast(`RPC ${updated.rpcNumber} officially approved! Document Ref: ${updated.approvedDocumentReference}`);
    } else if (updated.status === 'RETURNED_FOR_CORRECTION') {
      showToast(`RPC ${updated.rpcNumber} returned to SDSR Office for correction.`, 'info');
    }
    setCurrentView('dashboard');
  };

  // If user is not authenticated, display the dedicated Login Portal with two separate logins
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans antialiased">
        {toastNotice && (
          <div className="fixed top-6 right-6 z-50 transition transform duration-200">
            <div
              className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2.5 text-xs font-semibold ${
                toastNotice.type === 'success'
                  ? 'bg-emerald-900 text-white border-emerald-700'
                  : 'bg-stone-900 text-white border-stone-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastNotice.message}</span>
            </div>
          </div>
        )}
        <LoginScreen onLogin={handleLogin} />
      </div>
    );
  }

  const selectedRecord = records.find((r) => r.id === selectedRecordId) || null;
  const selectedScholar = selectedRecord
    ? scholars.find((s) => s.id === selectedRecord.scholarId)
    : null;
  const allScholarRecords = selectedRecord
    ? records.filter((r) => r.scholarId === selectedRecord.scholarId).sort((a, b) => a.rpcNumber - b.rpcNumber)
    : [];

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 flex flex-col font-sans antialiased selection:bg-stone-300">
      {/* Universal Top Institutional Navbar */}
      <SDSRNavbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onNavigateHome={() => setCurrentView('dashboard')}
      />

      {/* Floating Toast Notification */}
      {toastNotice && (
        <div className="fixed top-20 right-6 z-50 transition transform duration-200">
          <div
            className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2.5 text-xs font-semibold ${
              toastNotice.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : 'bg-stone-900 text-white border-stone-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastNotice.message}</span>
          </div>
        </div>
      )}

      {/* Main App Content Viewport */}
      <main className="flex-1">
        {loading ? (
          <div className="max-w-7xl mx-auto px-4 py-16 text-center text-stone-500 text-xs">
            Loading National Forensic Sciences University SDSR Portal...
          </div>
        ) : (
          <>
            {/* 1. DASHBOARD VIEW */}
            {currentView === 'dashboard' && (
              <>
                {currentUser.role === 'SDSR_OFFICE' ? (
                  <OfficeDashboard
                    records={records}
                    onOpenRecord={handleOpenRecordInWorkspace}
                    onNewRequest={() => setIsNewRpcModalOpen(true)}
                    currentUser={currentUser}
                    onViewLetterModal={handleOpenLetterModal}
                    onOpenExcelImport={() => setIsExcelImportModalOpen(true)}
                    onRefreshData={refreshData}
                  />
                ) : (
                  <DeanDashboard
                    records={records}
                    onReviewRecord={handleDeanReviewRecord}
                    currentUser={currentUser}
                  />
                )}
              </>
            )}

            {/* 2. SCHOLAR RPC WORKSPACE (SDSR OFFICE) */}
            {currentView === 'workspace' && selectedRecord && (
              <ScholarWorkspace
                record={selectedRecord}
                currentUser={currentUser}
                onBackToDashboard={() => setCurrentView('dashboard')}
                onOpenDraftLetter={(rec) => setDraftingRecord(rec)}
                onOpenForwardModal={(rec) => setForwardingRecord(rec)}
                onViewLetterModal={handleOpenLetterModal}
                onRecordUpdated={(updated) => {
                  refreshData();
                }}
              />
            )}

            {/* 3. DEAN REVIEW SCREEN */}
            {currentView === 'dean-review' && selectedRecord && (
              <DeanReviewScreen
                record={selectedRecord}
                scholar={selectedScholar || undefined}
                allScholarRecords={allScholarRecords}
                currentUser={currentUser}
                onBack={() => setCurrentView('dashboard')}
                onActionComplete={handleDeanActionComplete}
              />
            )}
          </>
        )}
      </main>

      {/* MODALS */}

      {/* + New RPC Request Modal */}
      <NewRpcModal
        isOpen={isNewRpcModalOpen}
        onClose={() => setIsNewRpcModalOpen(false)}
        currentUser={currentUser}
        onSuccess={handleNewRpcCreated}
      />

      {/* Draft Letter Modal */}
      {draftingRecord && (
        <LetterDraftingModal
          isOpen={true}
          onClose={() => setDraftingRecord(null)}
          record={draftingRecord}
          currentUser={currentUser}
          onSaveSuccess={handleLetterSaved}
          onForwardToDeanClick={() => {
            const rec = draftingRecord;
            setDraftingRecord(null);
            setForwardingRecord(rec);
          }}
        />
      )}

      {/* Forward Confirmation Modal */}
      {forwardingRecord && (
        <ForwardConfirmationModal
          isOpen={true}
          onClose={() => setForwardingRecord(null)}
          record={forwardingRecord}
          currentUser={currentUser}
          onSuccess={handleForwardSuccess}
        />
      )}

      {/* Letter Viewer / Print Modal */}
      {viewingLetterState && (
        <LetterViewerModal
          isOpen={true}
          onClose={() => setViewingLetterState(null)}
          record={viewingLetterState.record}
          autoDownload={viewingLetterState.autoDownload}
        />
      )}

      {/* Excel File Load & Unload Operations for SDSR Office */}
      <ExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        currentUser={currentUser}
        existingScholars={scholars}
        existingRecords={records}
        onViewLetterModal={handleOpenLetterModal}
        onImportComplete={async (summary) => {
          await refreshData();
          showToast(
            `Excel operation successful: ${summary.scholarsAdded} scholars added, ${summary.scholarsUpdated} updated, ${summary.rpcAdded} RPC records processed.`,
            'success'
          );
        }}
      />

      {/* Institutional Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 mt-8 print:hidden text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            National Forensic Sciences University • School of Doctoral Studies and Research (SDSR)
          </div>
          <div className="flex items-center gap-3">
            <span>Gandhinagar Campus</span>
            <span>•</span>
            <span className="font-mono text-[11px]">System Status: Connected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

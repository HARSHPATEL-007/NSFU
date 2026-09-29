import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { Shield, UserCheck, LogOut, Building2, Database, CheckCircle2, Save, Loader2 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { NFSUEmblem } from './NFSULogo';
import { saveAllPortalWork } from '../services/dataService';

interface SDSRNavbarProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onNavigateHome?: () => void;
  isDbConnected?: boolean;
}

export const SDSRNavbar: React.FC<SDSRNavbarProps> = ({
  currentUser,
  onLogout,
  onNavigateHome,
  isDbConnected = true,
}) => {
  const isDean = currentUser.role === 'DEAN_SDSR';
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [lastSavedText, setLastSavedText] = useState('All work saved');

  useEffect(() => {
    const handleSaved = (e: any) => {
      setSaveStatus('saved');
      setLastSavedText('All work saved');
    };
    const handleChanged = () => {
      setSaveStatus('saved');
    };
    window.addEventListener('nfsu-portal-work-saved', handleSaved);
    window.addEventListener('nfsu-portal-data-changed', handleChanged);
    return () => {
      window.removeEventListener('nfsu-portal-work-saved', handleSaved);
      window.removeEventListener('nfsu-portal-data-changed', handleChanged);
    };
  }, []);

  const handleForceSave = async () => {
    setSaveStatus('saving');
    await saveAllPortalWork();
    setTimeout(() => {
      setSaveStatus('saved');
      setLastSavedText(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    }, 400);
  };

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Portal Identity */}
          <div
            onClick={onNavigateHome}
            id="portal-brand-header"
            className="flex items-center gap-3 cursor-pointer group select-none"
            role="button"
            tabIndex={0}
          >
            {/* Official NFSU Crest Shield Logo */}
            <div className="w-10 h-12 flex items-center justify-center shrink-0 drop-shadow-xs">
              <NFSUEmblem id="navbar-nfsu-logo" className="w-9 h-11" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  National Forensic Sciences University
                </span>
                <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-stone-300"></span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleForceSave();
                  }}
                  id="navbar-save-status-badge"
                  title="Click to immediately sync & save every work on portal"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300 transition cursor-pointer select-none"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="w-3 h-3 text-emerald-600 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{lastSavedText}</span>
                    </>
                  )}
                </button>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-stone-900 group-hover:text-stone-700 transition leading-tight">
                SDSR RPC Processing Portal
              </h1>
            </div>
          </div>

          {/* User Profile & Role Switcher */}
          <div className="flex items-center gap-3">
            {/* Active User Card */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-stone-900 leading-tight">
                {currentUser.displayName}
              </span>
              <span className="text-[11px] text-stone-500 leading-tight">
                {currentUser.designation}
              </span>
            </div>

            {/* Role Badge */}
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                isDean
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}
            >
              {isDean ? (
                <Shield className="w-3.5 h-3.5 text-purple-600" />
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className="font-medium">
                {isDean ? 'Dean, SDSR' : 'SDSR Office'}
              </span>
            </div>

            {/* Dark & Night Mode Switch Toggle */}
            <ThemeToggle id="navbar-theme-toggle" />

            {/* Sign Out Button */}
            <button
              onClick={onLogout}
              id="btn-logout"
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-red-700 bg-stone-100 hover:bg-red-50 active:bg-red-100 rounded-md border border-stone-300 hover:border-red-200 transition shadow-2xs cursor-pointer"
              title="Sign Out of Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

import React, { useState } from 'react';
import { UserProfile } from '../types';
import { DEMO_USERS } from '../data/initialDemoData';
import { Shield, UserCheck, LogIn, Building2, ShieldCheck, ArrowRight, School } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { NFSUEmblem, NFSULogoFull } from './NFSULogo';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'SEPARATE_CARDS' | 'OFFICE_TAB' | 'DEAN_TAB'>('SEPARATE_CARDS');
  const [officePassword, setOfficePassword] = useState('');
  const [deanPassword, setDeanPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const officeUser = DEMO_USERS[0]; // SDSR Office
  const deanUser = DEMO_USERS[1];   // Dean, SDSR

  const handleOfficeLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    onLogin(officeUser);
  };

  const handleDeanLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    onLogin(deanUser);
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between selection:bg-stone-300">
      {/* Top Banner */}
      <header className="bg-white border-b border-stone-200 py-3 px-6 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NFSUEmblem id="login-header-nfsu-crest" className="w-10 h-12" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                National Forensic Sciences University
              </div>
              <div className="text-sm font-bold text-stone-900">
                School of Doctoral Studies & Research (SDSR)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle id="login-theme-toggle" />
          </div>
        </div>
      </header>

      {/* Main Login Body */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl">
          {/* Header text with Official NFSU Logo */}
          <div className="text-center mb-8 flex flex-col items-center">
            {/* Centered NFSU Crest Badge */}
            <div className="mb-4 flex flex-col items-center">
              <NFSUEmblem id="login-center-crest" className="w-16 h-20 drop-shadow-md mb-2" />
              <span className="text-[11px] font-bold text-red-800 dark:text-red-400 font-serif tracking-wide uppercase">
                Knowledge | Wisdom | Fulfilment
              </span>
              <span className="text-[10px] text-stone-500 font-medium">
                An Institution of National Importance (Ministry of Home Affairs, Govt. of India)
              </span>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold mb-3">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Ph.D. Research Progress Committee (RPC) Processing Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              Select Authorized Portal Login
            </h1>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg max-w-md mx-auto text-center">
              {errorMsg}
            </div>
          )}

          {/* Two Separate Login Portals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PORTAL 1: SDSR OFFICE */}
            <div className="bg-white rounded-xl border border-stone-300 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Operational Portal
                  </span>
                  <span className="text-[11px] font-mono text-stone-600 font-medium">Portal 01</span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                    SO
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">SDSR Office Login</h2>
                    <div className="text-xs text-stone-500">Dealing Assistant / Section Officer</div>
                  </div>
                </div>

                <div className="bg-stone-50 rounded-lg p-3 border border-stone-200 mb-5 text-xs text-stone-700 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Authorized Email:</span>
                    <span className="font-mono font-medium text-stone-800">{officeUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Department:</span>
                    <span className="font-medium text-stone-800">SDSR Administration</span>
                  </div>
                </div>

                <div className="text-xs text-stone-600 mb-4">
                  <div className="font-semibold text-stone-700 mb-2">Portal Privileges:</div>
                  <ul className="space-y-1.5 list-disc list-inside text-stone-600">
                    <li>Create & schedule scholar RPC meetings</li>
                    <li>Draft official RPC notification letters</li>
                    <li>Forward verified files for Dean's digital signature</li>
                    <li>Bulk import scholar RPC data via Excel</li>
                    <li>View & download final signed approvals</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 pt-0 mt-auto">
                <button
                  onClick={() => handleOfficeLogin()}
                  id="btn-login-sdsr-office"
                  type="button"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-sm font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to SDSR Office</span>
                  <ArrowRight className="w-4 h-4 ml-1 opacity-80" />
                </button>
              </div>
            </div>

            {/* PORTAL 2: DEAN, SDSR */}
            <div className="bg-white rounded-xl border border-stone-300 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    Executive Approval Portal
                  </span>
                  <span className="text-[11px] font-mono text-stone-600 font-medium">Portal 02</span>
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                    DS
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">Dean, SDSR Login</h2>
                    <div className="text-xs text-stone-500">School of Doctoral Studies & Research</div>
                  </div>
                </div>

                <div className="bg-stone-50 rounded-lg p-3 border border-stone-200 mb-5 text-xs text-stone-700 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Authorized Email:</span>
                    <span className="font-mono font-medium text-stone-800">{deanUser.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Authority:</span>
                    <span className="font-medium text-stone-800">Final Digital Sign-off</span>
                  </div>
                </div>

                <div className="text-xs text-stone-600 mb-4">
                  <div className="font-semibold text-stone-700 mb-2">Portal Privileges:</div>
                  <ul className="space-y-1.5 list-disc list-inside text-stone-600">
                    <li>Exclusive approval queue for forwarded RPCs</li>
                    <li>Digital signature & official institutional seal</li>
                    <li>Return requests for correction with remarks</li>
                    <li>Generate immutable approved document snapshots</li>
                    <li>University-wide doctoral analytics overview</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 pt-0 mt-auto">
                <button
                  onClick={() => handleDeanLogin()}
                  id="btn-login-dean-sdsr"
                  type="button"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stone-900 hover:bg-black active:bg-stone-800 text-white text-sm font-semibold rounded-lg shadow-xs transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-purple-300" />
                  <span>Sign In as Dean, SDSR</span>
                  <ArrowRight className="w-4 h-4 ml-1 opacity-80" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Footer */}
      <footer className="bg-stone-200 border-t border-stone-300 py-3 text-center text-xs text-stone-600">
        <div>National Forensic Sciences University • Gandhinagar Campus, Sector 9, Gandhinagar - 382007, Gujarat, India</div>
        <div className="text-[11px] text-stone-500 mt-0.5">School of Doctoral Studies & Research (SDSR) Portal • Confidential & Institutional Use Only</div>
      </footer>
    </div>
  );
};

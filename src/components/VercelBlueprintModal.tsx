import React, { useState } from 'react';
import { Check, Copy, Database, FolderKanban, KeyRound, Terminal, X } from 'lucide-react';
import {
  SERVICE_ACCOUNT_SETUP_STEPS,
  VERCEL_SERVERLESS_FILES,
} from '../utils/vercelBlueprintCode';

interface VercelBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionMode: 'GOOGLE_SERVICE_ACCOUNT_LIVE' | 'HYBRID_AUDIT_SANDBOX';
  serviceAccountEmail: string;
  googleSheetId: string;
  googleDriveParentFolderId: string;
}

export const VercelBlueprintModal: React.FC<VercelBlueprintModalProps> = ({
  isOpen,
  onClose,
  connectionMode,
  serviceAccountEmail,
  googleSheetId,
  googleDriveParentFolderId,
}) => {
  const [activeFileId, setActiveFileId] = useState<string>(
    VERCEL_SERVERLESS_FILES[0].id
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeFile =
    VERCEL_SERVERLESS_FILES.find((f) => f.id === activeFileId) ||
    VERCEL_SERVERLESS_FILES[0];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Terminal className="h-4 w-4 text-blue-400" />
              <span>Arsitektur Serverless Vercel + Node.js (`googleapis`)</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                Mode Saat Ini:{' '}
                {connectionMode === 'GOOGLE_SERVICE_ACCOUNT_LIVE'
                  ? 'LIVE GOOGLE SERVICE ACCOUNT'
                  : 'HYBRID SANDBOX + SIAP DEPLOY VERCEL'}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">
              Kode Lengkap Backend Vercel Serverless &amp; Konfigurasi Google Service Account
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
          {/* Left Column: Setup Guide & Architecture */}
          <div className="border-b border-slate-200 bg-slate-50 p-6 lg:col-span-5 lg:border-r lg:border-b-0">
            <h3 className="text-sm font-bold text-slate-900">
              Panduan Konfigurasi Kredensial Google Service Account (Tanpa Apps Script)
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Seluruh dokumen peserta wajib masuk otomatis ke Google Drive resmi milik
              panitia menggunakan Service Account agar 100% audit-ready untuk BPK/Inspektorat.
            </p>

            <div className="mt-4 space-y-3">
              {SERVICE_ACCOUNT_SETUP_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-lg border border-slate-200 bg-white p-3.5"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {item.step}.
                    </span>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>

            {/* Active Environment Binding Summary */}
            <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <KeyRound className="h-4 w-4 text-blue-700" />
                <span>Parameter Target Integrasi Google Cloud</span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500">Service Account:</span>
                  <span className="font-mono text-[11px] font-medium text-slate-800 break-all text-right">
                    {serviceAccountEmail}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Database className="h-3.5 w-3.5" /> Sheet Database ID:
                  </span>
                  <span className="font-mono text-[11px] font-medium text-slate-800">
                    {googleSheetId}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-slate-500">
                    <FolderKanban className="h-3.5 w-3.5" /> Folder Drive Panitia:
                  </span>
                  <span className="font-mono text-[11px] font-medium text-slate-800">
                    {googleDriveParentFolderId}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Serverless Code Viewer */}
          <div className="flex flex-col bg-slate-950 text-slate-100 lg:col-span-7">
            {/* File Selector Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 bg-slate-900 px-4 py-3">
              {VERCEL_SERVERLESS_FILES.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setActiveFileId(file.id)}
                  className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeFile.id === file.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {file.fileName}
                </button>
              ))}
            </div>

            {/* File Description & Copy Bar */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/60 px-5 py-3">
              <div>
                <div className="text-xs font-bold text-white">{activeFile.title}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {activeFile.description}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(activeFile.code, activeFile.id)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedId === activeFile.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>

            {/* Source Code Block */}
            <pre className="flex-1 overflow-auto p-5 font-mono text-xs leading-relaxed text-slate-200">
              <code>{activeFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { Code2 } from 'lucide-react';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DokumentasiModule } from './components/DokumentasiModule';
import { PesertaModule } from './components/PesertaModule';
import { PptkExecutiveModule } from './components/PptkExecutiveModule';
import { ProxyPanitiaModule } from './components/ProxyPanitiaModule';
import { VercelBlueprintModal } from './components/VercelBlueprintModal';
import { VerifikatorSpjModule } from './components/VerifikatorSpjModule';
import {
  ActivityConfig,
  AppModule,
  DocumentStatus,
  ParticipantRecord,
  PhotoCategory,
  SimKantorState,
  SpeakerRecord,
  SpprItem,
} from './types/simkantor';
import { PrintableDocumentPayload } from './utils/pdfGenerator';

export default function App() {
  const [state, setState] = useState<SimKantorState | null>(null);
  const [activeModule, setActiveModule] = useState<AppModule>(AppModule.PESERTA);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('pst-002');
  const [previewDoc, setPreviewDoc] = useState<PrintableDocumentPayload | null>(null);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchState();
  }, []);

  const fetchState = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/simkantor/state');
      if (!res.ok) throw new Error('Gagal memuat data SIM-KANTOR dari server.');
      const data = (await res.json()) as SimKantorState;
      setState(data);
      if (data.participants.length > 0 && !selectedParticipantId) {
        setSelectedParticipantId(data.participants[0].id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async (
    participantId: string,
    dayIndex: number,
    isProxy = false,
    proxyOfficerName?: string
  ) => {
    const res = await fetch('/api/simkantor/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId,
        dayIndex,
        lokasi: state?.config.lokasiKegiatan,
        koordinat: '-6.1538, 106.8499',
        isProxy,
        proxyOfficerName,
      }),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  const handleSaveBiodata = async (
    payload: Partial<ParticipantRecord>
  ): Promise<string | undefined> => {
    const res = await fetch('/api/simkantor/participant/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
    return data.participantId;
  };

  const handleUploadDocument = async (payload: {
    participantId: string;
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport' | 'buktiBayarSusulan';
    dataUrl: string;
    originalSizeKB: number;
    compressedSizeKB: number;
    uploadedBy: string;
    isProxy: boolean;
    isLateFinanceUpload?: boolean;
    auditNote?: string;
    nominalTransport?: number;
  }) => {
    const res = await fetch('/api/simkantor/participant/upload-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  const handleSaveSppr = async (participantId: string, items: SpprItem[]) => {
    const res = await fetch('/api/simkantor/participant/sppr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, items }),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  const handleVerifyParticipant = async (payload: {
    participantId: string;
    hariDisetujui: number;
    tarifUangHarian: number;
    transportDisetujui: number;
    gunakanSppr: boolean;
    statusBerkas: DocumentStatus;
    statusBayar: 'BELUM_DIBAYAR' | 'SIAP_BAYAR' | 'SUDAH_DIBAYAR';
    catatanVerifikator: string;
    verifikatorName: string;
  }) => {
    const res = await fetch('/api/simkantor/finance/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  const handleUpsertSpeaker = async (payload: Partial<SpeakerRecord>) => {
    const res = await fetch('/api/simkantor/speakers/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  const handleUploadPhoto = async (payload: {
    kategori: PhotoCategory;
    judul: string;
    caption: string;
    hariKe: number;
    uploader: string;
    imageUrl?: string;
    originalSizeKB?: number;
    compressedSizeKB?: number;
  }) => {
    const res = await fetch('/api/simkantor/documentation/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  const handleUpdateConfig = async (newConfig: Partial<ActivityConfig>) => {
    const res = await fetch('/api/simkantor/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    const data = await res.json();
    if (data.state) setState(data.state);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-14 w-full rounded-xl bg-slate-200" />
          <div className="h-32 w-full rounded-xl bg-slate-200" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-96 rounded-xl bg-slate-200" />
            <div className="h-96 rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center">
          <h1 className="text-base font-bold text-slate-900">
            Gagal Memuat Sistem SIM-KANTOR
          </h1>
          <p className="mt-1 text-xs text-slate-600">{errorMsg}</p>
          <button
            type="button"
            onClick={fetchState}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT (1 Row, 3 Zones, gap-8)
      ====================================================================== */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-8 border-b border-slate-200 bg-white px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveModule(AppModule.PESERTA);
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          SIM-KANTOR
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-slate-600">
          {[
            { id: AppModule.PESERTA, label: 'Peserta' },
            { id: AppModule.PROXY_PANITIA, label: 'Helpdesk Proxy' },
            { id: AppModule.VERIFIKATOR_SPJ, label: 'Verifikator SPJ' },
            { id: AppModule.DOKUMENTASI, label: 'Dokumentasi' },
            { id: AppModule.PPTK_EXECUTIVE, label: 'PPTK & Laporan' },
          ].map((nav) => {
            const isActive = activeModule === nav.id;
            return (
              <a
                key={nav.id}
                href={`#${nav.id.toLowerCase()}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveModule(nav.id);
                }}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-b-2 border-blue-700 font-semibold text-slate-900'
                    : 'hover:text-slate-900'
                }`}
              >
                {nav.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsBlueprintOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Code2 className="h-4 w-4" />
            <span>Kode Vercel &amp; Service Account</span>
          </button>
        </div>
      </header>

      {/* Contextual Institutional Subbar Below Header */}
      <div className="border-b border-slate-200 bg-slate-900 px-6 py-2.5 text-xs text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-white">
              {state.config.instansiPenyelenggara}
            </span>
            <span aria-hidden="true">·</span>
            <span>{state.config.namaKegiatan}</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
            <span>DIPA/DPA: {state.config.nomorDpa}</span>
            <span aria-hidden="true">·</span>
            <span>
              Penyimpanan Terpusat: Google Drive Panitia (100% Audit-Ready BPK)
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Container (1440px Baseline / max-w-7xl) */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {activeModule === AppModule.PESERTA && (
          <PesertaModule
            config={state.config}
            participants={state.participants}
            materials={state.materials}
            photos={state.photos}
            selectedParticipantId={selectedParticipantId}
            onSelectParticipant={setSelectedParticipantId}
            onCheckIn={(pId, day) => handleCheckIn(pId, day, false)}
            onSaveBiodata={handleSaveBiodata}
            onUploadDocument={handleUploadDocument}
            onSaveSppr={handleSaveSppr}
            onOpenDocumentPreview={setPreviewDoc}
          />
        )}

        {activeModule === AppModule.PROXY_PANITIA && (
          <ProxyPanitiaModule
            config={state.config}
            participants={state.participants}
            onSaveBiodata={handleSaveBiodata}
            onCheckIn={handleCheckIn}
            onUploadDocument={handleUploadDocument}
          />
        )}

        {activeModule === AppModule.VERIFIKATOR_SPJ && (
          <VerifikatorSpjModule
            config={state.config}
            participants={state.participants}
            speakers={state.speakers}
            onVerifyParticipant={handleVerifyParticipant}
            onUploadLateFinanceProof={handleUploadDocument}
            onUpsertSpeaker={handleUpsertSpeaker}
            onOpenDocumentPreview={setPreviewDoc}
          />
        )}

        {activeModule === AppModule.DOKUMENTASI && (
          <DokumentasiModule
            config={state.config}
            photos={state.photos}
            onUploadPhoto={handleUploadPhoto}
            onOpenDocumentPreview={setPreviewDoc}
          />
        )}

        {activeModule === AppModule.PPTK_EXECUTIVE && (
          <PptkExecutiveModule
            config={state.config}
            participants={state.participants}
            speakers={state.speakers}
            photos={state.photos}
            auditLogs={state.auditLogs}
            onUpdateConfig={handleUpdateConfig}
            onOpenDocumentPreview={setPreviewDoc}
          />
        )}
      </main>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
          <div>
            SIM-KANTOR — Sistem Informasi Manajemen Kegiatan Kedinasan &amp; Pertanggungjawaban
            Keuangan Terpadu
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsBlueprintOpen(true)}
              className="font-medium text-blue-700 hover:underline"
            >
              Panduan Google Cloud Service Account &amp; Kode Vercel
            </button>
          </div>
        </div>
      </footer>

      {/* Modal Pratinjau & Cetak Dokumen PDF Resmi */}
      <DocumentPreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      {/* Modal Kode Backend Vercel Serverless & Panduan Konfigurasi */}
      <VercelBlueprintModal
        isOpen={isBlueprintOpen}
        onClose={() => setIsBlueprintOpen(false)}
        connectionMode={state.connectionMode}
        serviceAccountEmail={state.serviceAccountEmail}
        googleSheetId={state.googleSheetId}
        googleDriveParentFolderId={state.googleDriveParentFolderId}
      />
    </div>
  );
}

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
  GolonganType,
  InputMode,
  ParticipantRecord,
  PhotoCategory,
  SimKantorState,
  SpeakerRecord,
  SpeakerRole,
  SpprItem,
} from './types/simkantor';
import { createInitialSimKantorState } from './utils/initialSeedData';
import { PrintableDocumentPayload } from './utils/pdfGenerator';
import {
  calculateHonorariumPPh21,
  createDocumentationSvg,
} from './utils/spjCalculators';

const STORAGE_KEY = 'simkantor_hybrid_state_v1';

export default function App() {
  // Inisialisasi langsung dengan data awal agar tidak pernah gagal muat di Vercel
  const [state, setState] = useState<SimKantorState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as SimKantorState;
      }
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
    return createInitialSimKantorState();
  });

  const [activeModule, setActiveModule] = useState<AppModule>(AppModule.PESERTA);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('pst-002');
  const [previewDoc, setPreviewDoc] = useState<PrintableDocumentPayload | null>(null);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchStateFromServer();
  }, []);

  const updateAndPersistState = (updater: (prev: SimKantorState) => SimKantorState) => {
    setState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Abaikan jika kuota localStorage penuh
      }
      return next;
    });
  };

  const fetchStateFromServer = async () => {
    try {
      const res = await fetch('/api/simkantor/state');
      if (res.ok) {
        const data = (await res.json()) as SimKantorState;
        if (data && Array.isArray(data.participants)) {
          setState(data);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch {
            // Abaikan
          }
        }
      }
    } catch {
      // Gunakan state lokal jika Serverless sedang cold-start
    }
  };

  const handleCheckIn = async (
    participantId: string,
    dayIndex: number,
    isProxy = false,
    proxyOfficerName?: string
  ) => {
    const checkInTime =
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB';
    const tanggal = new Date().toISOString().slice(0, 10);

    // Update optimistik instan
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === participantId);
      if (!p) return prev;
      if (p.attendance.some((a) => a.dayIndex === dayIndex)) return prev;

      p.attendance.push({
        dayIndex,
        tanggal,
        checkInTime,
        lokasi: next.config.lokasiKegiatan,
        koordinat: '-6.1538, 106.8499',
        recordedBy: isProxy
          ? `PROXY: ${proxyOfficerName || 'Petugas Helpdesk'}`
          : 'Peserta Mandiri (Google Auth)',
        isProxy,
      });

      p.verification.hariDisetujui = p.attendance.length;
      p.verification.totalUangHarian =
        p.verification.hariDisetujui * p.verification.tarifUangHarian;
      p.verification.totalDiterima =
        p.verification.totalUangHarian + p.verification.transportDisetujui;
      p.updatedAt = checkInTime;

      next.auditLogs.unshift({
        id: `aud-${Date.now()}`,
        timestamp: `${tanggal} ${checkInTime}`,
        actorName: isProxy ? proxyOfficerName || 'Panitia Helpdesk' : p.nama,
        actorRole: isProxy ? 'PANITIA_PROXY' : 'PESERTA',
        actionType: `CHECKIN_PRESENSI_HARI_${dayIndex}`,
        targetName: `${p.nama} (${p.nip})`,
        details: `Check-in presensi Hari ke-${dayIndex} pada pukul ${checkInTime}. Total hadir: ${p.attendance.length} hari.`,
        isFlaggedProxy: isProxy,
      });
      return next;
    });

    try {
      const res = await fetch('/api/simkantor/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          dayIndex,
          lokasi: state.config.lokasiKegiatan,
          koordinat: '-6.1538, 106.8499',
          isProxy,
          proxyOfficerName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch {
      // Tetap gunakan state lokal yang sudah terupdate
    }
  };

  const handleSaveBiodata = async (
    payload: Partial<ParticipantRecord>
  ): Promise<string | undefined> => {
    let createdOrUpdatedId = payload.id;

    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      let p = next.participants.find(
        (item) => item.id === payload.id || (payload.nip && item.nip === payload.nip)
      );
      const isProxy = payload.inputMode === InputMode.PROXY_PANITIA;

      if (!p) {
        const idx = next.participants.length + 1;
        const cleanNip = payload.nip || `19900101202012100${idx}`;
        const newId = `pst-00${idx}`;
        createdOrUpdatedId = newId;
        p = {
          id: newId,
          nama: payload.nama || 'Peserta Baru',
          email:
            payload.email ||
            `${(payload.nama || 'peserta').toLowerCase().replace(/[^a-z]/g, '.')}@gmail.com`,
          nip: cleanNip,
          pangkatGolongan: payload.pangkatGolongan || GolonganType.GOL_III,
          jabatan: payload.jabatan || 'Peserta Utusan',
          instansi: payload.instansi || 'Instansi Daerah',
          kabupatenKota: payload.kabupatenKota || 'Kabupaten/Kota',
          noHp: payload.noHp || '081200000000',
          namaBank: payload.namaBank || 'BRI',
          noRekening: payload.noRekening || '-',
          statusBerkas: DocumentStatus.BELUM_LENGKAP,
          inputMode: isProxy ? InputMode.PROXY_PANITIA : InputMode.MANDIRI,
          proxyOfficerName: isProxy ? payload.proxyOfficerName : undefined,
          proxyReason: isProxy ? payload.proxyReason : undefined,
          driveFolderId: `DRV-FOLDER-${cleanNip}`,
          driveFolderName: `${cleanNip} - ${payload.nama || 'Peserta'}`,
          driveFolderUrl: `https://drive.google.com/drive/folders/PANITIA_${cleanNip}`,
          attendance: [
            {
              dayIndex: 1,
              tanggal: new Date().toISOString().slice(0, 10),
              checkInTime: new Date().toLocaleTimeString('id-ID') + ' WIB',
              lokasi: next.config.lokasiKegiatan,
              koordinat: '-6.1538, 106.8499',
              recordedBy: isProxy
                ? `PROXY: ${payload.proxyOfficerName}`
                : 'Peserta Mandiri',
              isProxy,
            },
          ],
          documents: {},
          spprItems: [],
          verification: {
            hariDisetujui: 1,
            tarifUangHarian: next.config.tarifUangHarianSbm,
            totalUangHarian: next.config.tarifUangHarianSbm,
            transportDisetujui: 0,
            gunakanSppr: false,
            totalDiterima: next.config.tarifUangHarianSbm,
            statusBayar: 'BELUM_DIBAYAR',
            noKuitansi: `KUI/SPJ/${next.config.tahunAnggaran}/00${idx}`,
            catatanVerifikator: 'Biodata terdaftar.',
          },
          updatedAt: new Date().toLocaleTimeString('id-ID') + ' WIB',
        };
        next.participants.unshift(p);
      } else {
        createdOrUpdatedId = p.id;
        p.nama = payload.nama ?? p.nama;
        p.email = payload.email ?? p.email;
        p.nip = payload.nip ?? p.nip;
        p.pangkatGolongan = payload.pangkatGolongan ?? p.pangkatGolongan;
        p.jabatan = payload.jabatan ?? p.jabatan;
        p.instansi = payload.instansi ?? p.instansi;
        p.kabupatenKota = payload.kabupatenKota ?? p.kabupatenKota;
        p.noHp = payload.noHp ?? p.noHp;
        p.namaBank = payload.namaBank ?? p.namaBank;
        p.noRekening = payload.noRekening ?? p.noRekening;
        p.driveFolderName = `${p.nip} - ${p.nama}`;
      }
      return next;
    });

    try {
      const res = await fetch('/api/simkantor/participant/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
        if (data.participantId) return data.participantId;
      }
    } catch {
      // Tetap gunakan state lokal
    }

    return createdOrUpdatedId;
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
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === payload.participantId);
      if (!p) return prev;

      const prefixMap = {
        suratTugas: 'SURAT_TUGAS',
        sppdVisum: 'SPPD_VISUM',
        buktiTransport: 'TIKET_TRANSPORT',
        buktiBayarSusulan: 'BUKTI_SUSULAN_KEUANGAN',
      };
      const prefix = prefixMap[payload.docType];
      const cleanName = p.nama.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${
        payload.isProxy ? 'PROXY_' : ''
      }${prefix}_${p.nip}_${cleanName}.jpg`;
      const driveFileId = `DRV-${prefix}-${Date.now().toString().slice(-5)}`;

      const uploadedDoc = {
        fileName,
        uploadedAt:
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB',
        uploadedBy: payload.uploadedBy,
        isProxy: payload.isProxy,
        isLateFinanceUpload: payload.isLateFinanceUpload,
        auditNote: payload.auditNote,
        originalSizeKB: payload.originalSizeKB,
        compressedSizeKB: payload.compressedSizeKB,
        driveFileId,
        driveViewUrl: `https://drive.google.com/file/d/${driveFileId}/view`,
        dataUrl: payload.dataUrl,
      };

      if (payload.docType === 'suratTugas') p.documents.suratTugas = uploadedDoc;
      if (payload.docType === 'sppdVisum') p.documents.sppdVisum = uploadedDoc;
      if (payload.docType === 'buktiTransport') {
        p.documents.buktiTransport = uploadedDoc;
        if (payload.nominalTransport && payload.nominalTransport > 0) {
          p.verification.transportDisetujui = payload.nominalTransport;
          p.verification.gunakanSppr = false;
          p.verification.totalDiterima =
            p.verification.totalUangHarian + p.verification.transportDisetujui;
        }
      }
      if (payload.docType === 'buktiBayarSusulan') {
        p.documents.buktiBayarSusulan = uploadedDoc;
      }

      const hasSt = Boolean(p.documents.suratTugas);
      const hasSppd = Boolean(p.documents.sppdVisum);
      const hasTr = Boolean(
        p.documents.buktiTransport ||
          p.documents.spprGenerated ||
          p.documents.buktiBayarSusulan
      );
      if (hasSt && hasSppd && hasTr && p.statusBerkas === DocumentStatus.BELUM_LENGKAP) {
        p.statusBerkas = DocumentStatus.MENUNGGU_VERIFIKASI;
      }

      return next;
    });

    try {
      const res = await fetch('/api/simkantor/participant/upload-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch {
      // Tetap gunakan state lokal
    }
  };

  const handleSaveSppr = async (participantId: string, items: SpprItem[]) => {
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === participantId);
      if (!p) return prev;

      p.spprItems = items;
      const totalSppr = items.reduce((s, i) => s + (Number(i.nominal) || 0), 0);
      const nomorSppr = `SPPR/${next.config.tahunAnggaran}/${p.id.toUpperCase()}`;

      p.documents.spprGenerated = {
        nomorSppr,
        generatedAt:
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }) + ' WIB',
        totalNominal: totalSppr,
        items,
        driveFileId: `DRV-SPPR-${p.nip}`,
      };

      p.verification.transportDisetujui = totalSppr;
      p.verification.gunakanSppr = true;
      p.verification.totalDiterima = p.verification.totalUangHarian + totalSppr;

      if (
        p.documents.suratTugas &&
        p.documents.sppdVisum &&
        p.statusBerkas === DocumentStatus.BELUM_LENGKAP
      ) {
        p.statusBerkas = DocumentStatus.MENUNGGU_VERIFIKASI;
      }

      return next;
    });

    try {
      const res = await fetch('/api/simkantor/participant/sppr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, items }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch {
      // Tetap gunakan state lokal
    }
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
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const p = next.participants.find((item) => item.id === payload.participantId);
      if (!p) return prev;

      const totalUh = payload.hariDisetujui * payload.tarifUangHarian;
      const totalAll = totalUh + payload.transportDisetujui;

      p.statusBerkas = payload.statusBerkas;
      p.verification = {
        ...p.verification,
        hariDisetujui: payload.hariDisetujui,
        tarifUangHarian: payload.tarifUangHarian,
        totalUangHarian: totalUh,
        transportDisetujui: payload.transportDisetujui,
        gunakanSppr: payload.gunakanSppr,
        totalDiterima: totalAll,
        statusBayar: payload.statusBayar,
        catatanVerifikator: payload.catatanVerifikator,
        verifikatorName: payload.verifikatorName,
      };
      return next;
    });

    try {
      const res = await fetch('/api/simkantor/finance/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch {
      // Tetap gunakan state lokal
    }
  };

  const handleUpsertSpeaker = async (payload: Partial<SpeakerRecord>) => {
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const calc = calculateHonorariumPPh21(
        Number(payload.jumlahJP) || 2,
        Number(payload.tarifPerJP) || 900000,
        (payload.golongan as GolonganType) || GolonganType.GOL_IV,
        Boolean(payload.hasNpwp)
      );

      const existing = next.speakers.find((s) => s.id === payload.id);
      if (existing) {
        existing.nama = payload.nama || existing.nama;
        existing.peran = payload.peran || existing.peran;
        existing.instansi = payload.instansi || existing.instansi;
        existing.golongan = payload.golongan || existing.golongan;
        existing.npwp = payload.npwp || existing.npwp;
        existing.namaBank = payload.namaBank || existing.namaBank;
        existing.noRekening = payload.noRekening || existing.noRekening;
        existing.materiJudul = payload.materiJudul || existing.materiJudul;
        existing.jumlahJP = Number(payload.jumlahJP) || existing.jumlahJP;
        existing.tarifPerJP = Number(payload.tarifPerJP) || existing.tarifPerJP;
        existing.bruto = calc.bruto;
        existing.tarifPph21Persen = calc.tarifPph21Persen;
        existing.potonganPph21 = calc.potonganPph21;
        existing.netto = calc.netto;
      } else {
        const idx = next.speakers.length + 1;
        next.speakers.push({
          id: `spk-00${idx}`,
          nama: payload.nama || 'Narasumber',
          peran: payload.peran || SpeakerRole.NARASUMBER,
          instansi: payload.instansi || 'Instansi',
          golongan: payload.golongan || GolonganType.GOL_IV,
          npwp: payload.npwp || '-',
          hasNpwp: Boolean(payload.hasNpwp),
          namaBank: payload.namaBank || 'BNI',
          noRekening: payload.noRekening || '-',
          materiJudul: payload.materiJudul || 'Materi Kegiatan',
          jumlahJP: Number(payload.jumlahJP) || 2,
          tarifPerJP: Number(payload.tarifPerJP) || 900000,
          ...calc,
          noKuitansi: `KUI/HONOR/${next.config.tahunAnggaran}/00${idx}`,
          statusBayar: 'TERVERIFIKASI',
          tanggalKegiatan: new Date().toISOString().slice(0, 10),
        });
      }
      return next;
    });

    try {
      const res = await fetch('/api/simkantor/speakers/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch {
      // Tetap gunakan state lokal
    }
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
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const newIndex = next.photos.length + 1;
      const tanggal = new Date().toISOString().slice(0, 10);
      next.photos.unshift({
        id: `dok-00${newIndex}`,
        kategori: payload.kategori,
        judul: payload.judul,
        caption: payload.caption,
        hariKe: payload.hariKe,
        tanggal,
        timestamp: `${tanggal} WIB`,
        uploader: payload.uploader,
        driveFileId: `DRV-FOTO-0${newIndex}`,
        originalSizeKB: payload.originalSizeKB || 3200,
        compressedSizeKB: payload.compressedSizeKB || 260,
        imageUrl:
          payload.imageUrl ||
          createDocumentationSvg({
            kategori: payload.kategori,
            judul: payload.judul,
            hariKe: payload.hariKe,
            tanggal,
            themeColor: '#1E3A8A',
          }),
      });
      return next;
    });

    try {
      const res = await fetch('/api/simkantor/documentation/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch {
      // Tetap gunakan state lokal
    }
  };

  const handleUpdateConfig = async (newConfig: Partial<ActivityConfig>) => {
    updateAndPersistState((prev) => {
      const next = structuredClone(prev);
      const oldSbm = next.config.tarifUangHarianSbm;
      next.config = { ...next.config, ...newConfig };
      if (
        newConfig.tarifUangHarianSbm &&
        Number(newConfig.tarifUangHarianSbm) !== oldSbm
      ) {
        const updatedTarif = Number(newConfig.tarifUangHarianSbm);
        next.participants.forEach((p) => {
          p.verification.tarifUangHarian = updatedTarif;
          p.verification.totalUangHarian = p.verification.hariDisetujui * updatedTarif;
          p.verification.totalDiterima =
            p.verification.totalUangHarian + p.verification.transportDisetujui;
        });
      }
      return next;
    });

    try {
      const res = await fetch('/api/simkantor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
      }
    } catch {
      // Tetap gunakan state lokal
    }
  };

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

      {/* Main Content Container */}
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

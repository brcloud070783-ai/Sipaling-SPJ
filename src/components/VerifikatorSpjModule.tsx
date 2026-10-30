import React, { useEffect, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  FileArchive,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  ActivityConfig,
  DocumentStatus,
  GolonganType,
  InputMode,
  ParticipantRecord,
  SpeakerRecord,
  SpeakerRole,
} from '../types/simkantor';
import {
  generateBastDocument,
  generateBendelPesertaDocument,
  generateKuitansiNarasumberDocument,
  generateKuitansiPesertaDocument,
  generateNominatifNarasumberDocument,
  generateRekapTransportDocument,
  generateRekapUangHarianNominatif,
  generateSpprDocument,
  PrintableDocumentPayload,
} from '../utils/pdfGenerator';
import {
  calculateHonorariumPPh21,
  compressImageFile,
  createSimulatedDocSvg,
  formatRupiah,
  terbilangRupiah,
} from '../utils/spjCalculators';

interface VerifikatorSpjModuleProps {
  config: ActivityConfig;
  participants: ParticipantRecord[];
  speakers: SpeakerRecord[];
  onVerifyParticipant: (payload: {
    participantId: string;
    hariDisetujui: number;
    tarifUangHarian: number;
    transportDisetujui: number;
    gunakanSppr: boolean;
    statusBerkas: DocumentStatus;
    statusBayar: 'BELUM_DIBAYAR' | 'SIAP_BAYAR' | 'SUDAH_DIBAYAR';
    catatanVerifikator: string;
    verifikatorName: string;
  }) => Promise<void>;
  onUploadLateFinanceProof: (payload: {
    participantId: string;
    docType: 'buktiBayarSusulan';
    dataUrl: string;
    originalSizeKB: number;
    compressedSizeKB: number;
    uploadedBy: string;
    isProxy: boolean;
    isLateFinanceUpload: boolean;
    auditNote: string;
  }) => Promise<void>;
  onUpsertSpeaker: (payload: Partial<SpeakerRecord>) => Promise<void>;
  onOpenDocumentPreview: (doc: PrintableDocumentPayload) => void;
}

export const VerifikatorSpjModule: React.FC<VerifikatorSpjModuleProps> = ({
  config,
  participants,
  speakers,
  onVerifyParticipant,
  onUploadLateFinanceProof,
  onUpsertSpeaker,
  onOpenDocumentPreview,
}) => {
  const [mainTab, setMainTab] = useState<'TAB_PESERTA' | 'TAB_NARASUMBER'>(
    'TAB_PESERTA'
  );

  // State Tab 1: Verifikasi Peserta
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>(
    participants[0]?.id || ''
  );
  const [activeDocPreviewTab, setActiveDocPreviewTab] = useState<
    'SURAT_TUGAS' | 'SPPD_VISUM' | 'TRANSPORT' | 'SUSULAN'
  >('SPPD_VISUM');

  // State Kalkulator Verifikator
  const [hariDisetujui, setHariDisetujui] = useState<number>(3);
  const [tarifUangHarian, setTarifUangHarian] = useState<number>(
    config.tarifUangHarianSbm
  );
  const [transportDisetujui, setTransportDisetujui] = useState<number>(0);
  const [gunakanSppr, setGunakanSppr] = useState<boolean>(false);
  const [statusBerkas, setStatusBerkas] = useState<DocumentStatus>(
    DocumentStatus.TERVERIFIKASI
  );
  const [statusBayar, setStatusBayar] = useState<
    'BELUM_DIBAYAR' | 'SIAP_BAYAR' | 'SUDAH_DIBAYAR'
  >('SIAP_BAYAR');
  const [catatanVerifikator, setCatatanVerifikator] = useState('');
  const [lateAuditNote, setLateAuditNote] = useState(
    'Bukti tiket/boarding pass pulang diserahkan susulan pasca-kegiatan kepada bendahara.'
  );

  // State Tab 2: Verifikasi Narasumber & Petugas
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [spkNama, setSpkNama] = useState('');
  const [spkPeran, setSpkPeran] = useState<SpeakerRole>(SpeakerRole.NARASUMBER);
  const [spkInstansi, setSpkInstansi] = useState('');
  const [spkGolongan, setSpkGolongan] = useState<GolonganType>(GolonganType.GOL_IV);
  const [spkNpwp, setSpkNpwp] = useState('09.224.881.2-215.000');
  const [spkHasNpwp, setSpkHasNpwp] = useState(true);
  const [spkBank, setSpkBank] = useState('BNI');
  const [spkRekening, setSpkRekening] = useState('');
  const [spkMateri, setSpkMateri] = useState('');
  const [spkJP, setSpkJP] = useState<number>(3);
  const [spkTarifJP, setSpkTarifJP] = useState<number>(900000);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedParticipant =
    participants.find((p) => p.id === selectedParticipantId) || participants[0];

  useEffect(() => {
    if (selectedParticipant) {
      setHariDisetujui(selectedParticipant.verification.hariDisetujui);
      setTarifUangHarian(selectedParticipant.verification.tarifUangHarian);
      setTransportDisetujui(selectedParticipant.verification.transportDisetujui);
      setGunakanSppr(selectedParticipant.verification.gunakanSppr);
      setStatusBerkas(selectedParticipant.statusBerkas);
      setStatusBayar(selectedParticipant.verification.statusBayar);
      setCatatanVerifikator(selectedParticipant.verification.catatanVerifikator);
    }
  }, [selectedParticipant]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const filteredParticipants = participants.filter((p) => {
    const matchesSearch =
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nip.includes(searchQuery) ||
      p.instansi.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PROXY') return p.inputMode === InputMode.PROXY_PANITIA;
    return p.statusBerkas === statusFilter;
  });

  const liveTotalUangHarian = hariDisetujui * tarifUangHarian;
  const liveTotalDiterima = liveTotalUangHarian + transportDisetujui;
  const liveTerbilang = terbilangRupiah(liveTotalDiterima);

  const handleSaveVerification = async (
    overrideStatus?: DocumentStatus,
    overrideBayar?: 'BELUM_DIBAYAR' | 'SIAP_BAYAR' | 'SUDAH_DIBAYAR'
  ) => {
    if (!selectedParticipant) return;
    setIsSaving(true);
    try {
      const finalStatus = overrideStatus || statusBerkas;
      const finalBayar = overrideBayar || statusBayar;
      await onVerifyParticipant({
        participantId: selectedParticipant.id,
        hariDisetujui,
        tarifUangHarian,
        transportDisetujui,
        gunakanSppr,
        statusBerkas: finalStatus,
        statusBayar: finalBayar,
        catatanVerifikator,
        verifikatorName: config.namaBendahara,
      });
      showToast(
        `SPJ ${selectedParticipant.nama} berhasil disimpan (${finalStatus} · ${formatRupiah(
          liveTotalDiterima
        )}).`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleLateFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedParticipant) return;
    setIsSaving(true);
    try {
      const compressed = await compressImageFile(file, 1400, 0.78);
      await onUploadLateFinanceProof({
        participantId: selectedParticipant.id,
        docType: 'buktiBayarSusulan',
        dataUrl: compressed.dataUrl,
        originalSizeKB: compressed.originalSizeKB,
        compressedSizeKB: compressed.compressedSizeKB,
        uploadedBy: `${config.namaBendahara} (Verifikator Keuangan)`,
        isProxy: false,
        isLateFinanceUpload: true,
        auditNote: lateAuditNote,
      });
      setActiveDocPreviewTab('SUSULAN');
      showToast('Bukti bayar susulan berhasil diunggah dengan catatan audit.');
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  const handleSimulateLateUpload = async () => {
    if (!selectedParticipant) return;
    setIsSaving(true);
    try {
      const svgUrl = createSimulatedDocSvg({
        docType: 'TIKET_TRANSPORT',
        nama: selectedParticipant.nama,
        nip: selectedParticipant.nip,
        instansi: 'Bukti Susulan Pasca-Kegiatan (Verifikator Keuangan)',
        nomorDokumen: `SUSULAN/${config.tahunAnggaran}/${selectedParticipant.nip.slice(-4)}`,
        tanggal: new Date().toLocaleDateString('id-ID'),
        nominal: formatRupiah(transportDisetujui),
      });
      await onUploadLateFinanceProof({
        participantId: selectedParticipant.id,
        docType: 'buktiBayarSusulan',
        dataUrl: svgUrl,
        originalSizeKB: 2850,
        compressedSizeKB: 198,
        uploadedBy: `${config.namaBendahara} (Verifikator Keuangan)`,
        isProxy: false,
        isLateFinanceUpload: true,
        auditNote: lateAuditNote,
      });
      setActiveDocPreviewTab('SUSULAN');
      showToast('Bukti bayar susulan berhasil diarsipkan ke folder Google Drive peserta.');
    } finally {
      setIsSaving(false);
    }
  };

  // Kalkulasi Live PPh 21 untuk Form Narasumber
  const liveSpeakerCalc = calculateHonorariumPPh21(
    spkJP,
    spkTarifJP,
    spkGolongan,
    spkHasNpwp
  );

  const handleSelectSpeakerForEdit = (sp: SpeakerRecord) => {
    setEditingSpeakerId(sp.id);
    setSpkNama(sp.nama);
    setSpkPeran(sp.peran);
    setSpkInstansi(sp.instansi);
    setSpkGolongan(sp.golongan);
    setSpkNpwp(sp.npwp);
    setSpkHasNpwp(sp.hasNpwp);
    setSpkBank(sp.namaBank);
    setSpkRekening(sp.noRekening);
    setSpkMateri(sp.materiJudul);
    setSpkJP(sp.jumlahJP);
    setSpkTarifJP(sp.tarifPerJP);
  };

  const handleSaveSpeakerForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spkNama.trim()) return;
    setIsSaving(true);
    try {
      await onUpsertSpeaker({
        id: editingSpeakerId || undefined,
        nama: spkNama.trim(),
        peran: spkPeran,
        instansi: spkInstansi.trim() || 'Instansi Narasumber',
        golongan: spkGolongan,
        npwp: spkNpwp.trim(),
        hasNpwp: spkHasNpwp,
        namaBank: spkBank.trim() || 'BNI',
        noRekening: spkRekening.trim() || '0192837465',
        materiJudul: spkMateri.trim() || 'Paparan Materi Kegiatan',
        jumlahJP: spkJP,
        tarifPerJP: spkTarifJP,
        statusBayar: 'TERVERIFIKASI',
      });
      setEditingSpeakerId(null);
      setSpkNama('');
      setSpkInstansi('');
      setSpkRekening('');
      setSpkMateri('');
      showToast(
        'Data Honorarium & perhitungan pajak PPh 21 Narasumber/Petugas berhasil disimpan.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-950">
          {toastMsg}
        </div>
      )}

      {/* Header Pusat SPJ & 2 Tab Utama */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
              <Calculator className="h-4 w-4" />
              <span>MODUL C — SISI VERIFIKATOR KEUANGAN (DESKTOP PUSAT SPJ)</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              Pusat Verifikasi Pertanggungjawaban Keuangan (SPJ) &amp; Generator PDF
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Verifikasi side-by-side dokumen peserta, kalkulator otomatis SBM &amp; PPh 21,
              serta pencetakan 1-klik dokumen siap periksa BPK/Inspektorat.
            </p>
          </div>

          {/* 2 Tab Utama Sesuai Spesifikasi */}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMainTab('TAB_PESERTA')}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mainTab === 'TAB_PESERTA'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Tab 1: Verifikasi Peserta ({participants.length})
            </button>
            <button
              type="button"
              onClick={() => setMainTab('TAB_NARASUMBER')}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                mainTab === 'TAB_NARASUMBER'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Tab 2: Verifikasi Narasumber &amp; Petugas ({speakers.length})
            </button>
          </div>
        </div>

        {/* Baris 1-Click PDF Generators Kolektif */}
        {mainTab === 'TAB_PESERTA' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
            <span className="text-xs font-bold text-slate-700 mr-1">
              Generator Dokumen Kolektif (1-Click PDF):
            </span>
            <button
              type="button"
              onClick={() =>
                onOpenDocumentPreview(
                  generateRekapUangHarianNominatif(participants, config)
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-700" />
              <span>Rekap Uang Harian Nominatif</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenDocumentPreview(
                  generateRekapTransportDocument(participants, config)
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-700" />
              <span>Rekap &amp; Kuitansi Transport</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenDocumentPreview(generateBastDocument(participants, config))
              }
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileCheck className="h-3.5 w-3.5 text-amber-700" />
              <span>Berita Acara Serah Terima (BAST)</span>
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          TAB 1: VERIFIKASI PESERTA (TABEL ANTREAN + SPLIT-SCREEN INSPECTOR)
      ====================================================================== */}
      {mainTab === 'TAB_PESERTA' && (
        <div className="space-y-6">
          {/* Tabel Antrean Peserta */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama peserta, NIP, atau asal instansi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                {[
                  { id: 'ALL', label: 'Semua Peserta' },
                  { id: DocumentStatus.MENUNGGU_VERIFIKASI, label: 'Menunggu Verifikasi' },
                  { id: DocumentStatus.TERVERIFIKASI, label: 'Terverifikasi' },
                  { id: DocumentStatus.BELUM_LENGKAP, label: 'Belum Lengkap' },
                  { id: 'PROXY', label: 'Input Proxy Panitia' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === tab.id
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">Nama Peserta &amp; NIP</th>
                    <th className="py-2.5 px-3 font-semibold">Instansi / Kab-Kota</th>
                    <th className="py-2.5 px-3 font-semibold">Kelengkapan Drive</th>
                    <th className="py-2.5 px-3 text-center font-semibold">Hadir</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Uang Harian</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Transport</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Total SPJ</th>
                    <th className="py-2.5 px-3 font-semibold">Status &amp; Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredParticipants.map((p) => {
                    const isSelected = p.id === selectedParticipant?.id;
                    const docCount = [
                      p.documents.suratTugas,
                      p.documents.sppdVisum,
                      p.documents.buktiTransport ||
                        p.documents.spprGenerated ||
                        p.documents.buktiBayarSusulan,
                    ].filter(Boolean).length;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedParticipantId(p.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{p.nama}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            NIP. {p.nip}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{p.instansi}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.kabupatenKota}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span
                            className={
                              docCount === 3
                                ? 'font-bold text-emerald-700'
                                : 'font-bold text-amber-700'
                            }
                          >
                            {docCount}/3 Dokumen
                          </span>
                          {p.documents.spprGenerated && (
                            <span className="text-slate-500"> · SPPR</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold">
                          {p.verification.hariDisetujui} hr
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatRupiah(p.verification.totalUangHarian)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatRupiah(p.verification.transportDisetujui)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(p.verification.totalDiterima)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          <span
                            className={`font-semibold ${
                              p.statusBerkas === DocumentStatus.TERVERIFIKASI
                                ? 'text-emerald-700'
                                : p.statusBerkas === DocumentStatus.MENUNGGU_VERIFIKASI
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {p.statusBerkas}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono text-slate-500">{p.inputMode}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIDE-BY-SIDE WORKSTATION: PRATINJAU DOKUMEN (KIRI) & KALKULATOR SPJ + CETAK (KANAN) */}
          {selectedParticipant && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
              {/* Left Panel: Pratinjau Scan Dokumen Fisik dari Google Drive Panitia */}
              <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Pratinjau Dokumen Arsip Google Drive Panitia
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      Folder: /{selectedParticipant.driveFolderName}/
                    </div>
                  </div>

                  {/* Document Selector Tabs */}
                  <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setActiveDocPreviewTab('SURAT_TUGAS')}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                        activeDocPreviewTab === 'SURAT_TUGAS'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      1. Surat Tugas
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDocPreviewTab('SPPD_VISUM')}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                        activeDocPreviewTab === 'SPPD_VISUM'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      2. SPPD &amp; Visum
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDocPreviewTab('TRANSPORT')}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                        activeDocPreviewTab === 'TRANSPORT'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      3. Tiket / SPPR
                    </button>
                    {selectedParticipant.documents.buktiBayarSusulan && (
                      <button
                        type="button"
                        onClick={() => setActiveDocPreviewTab('SUSULAN')}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold ${
                          activeDocPreviewTab === 'SUSULAN'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        4. Bukti Susulan
                      </button>
                    )}
                  </div>
                </div>

                {/* Viewport Gambar Scan */}
                <div className="mt-4 flex-1 rounded-lg border border-slate-200 bg-slate-100 p-4 flex flex-col items-center justify-center min-h-[420px]">
                  {(() => {
                    const currentDoc =
                      activeDocPreviewTab === 'SURAT_TUGAS'
                        ? selectedParticipant.documents.suratTugas
                        : activeDocPreviewTab === 'SPPD_VISUM'
                        ? selectedParticipant.documents.sppdVisum
                        : activeDocPreviewTab === 'SUSULAN'
                        ? selectedParticipant.documents.buktiBayarSusulan
                        : selectedParticipant.documents.buktiTransport;

                    if (currentDoc) {
                      return (
                        <div className="w-full space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900 px-3 py-2 text-[11px] font-mono text-slate-200">
                            <span>{currentDoc.fileName}</span>
                            <span>
                              {currentDoc.compressedSizeKB} KB · {currentDoc.uploadedAt}
                            </span>
                          </div>
                          {currentDoc.auditNote && (
                            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
                              {currentDoc.auditNote}
                            </div>
                          )}
                          <div className="flex justify-center bg-white p-2 rounded border border-slate-200">
                            <img
                              src={currentDoc.dataUrl}
                              alt={currentDoc.fileName}
                              referrerPolicy="no-referrer"
                              className="max-h-[440px] w-auto object-contain"
                            />
                          </div>
                        </div>
                      );
                    }

                    if (
                      activeDocPreviewTab === 'TRANSPORT' &&
                      selectedParticipant.documents.spprGenerated
                    ) {
                      const sppr = selectedParticipant.documents.spprGenerated;
                      return (
                        <div className="w-full rounded-lg border border-blue-200 bg-white p-4 text-xs">
                          <div className="font-mono text-xs font-bold text-blue-800">
                            DOKUMEN PENGGANTI TIKET: {sppr.nomorSppr}
                          </div>
                          <div className="mt-1 font-bold text-slate-900">
                            Surat Pernyataan Pengeluaran Riil (SPPR) — Transport Lokal
                          </div>
                          <div className="mt-3 space-y-2">
                            {sppr.items.map((item, i) => (
                              <div
                                key={item.id}
                                className="rounded border border-slate-200 bg-slate-50 p-2.5"
                              >
                                <div className="font-semibold text-slate-900">
                                  {i + 1}. {item.modaTransport} ({item.ruteAsal} &rarr;{' '}
                                  {item.ruteTujuan}) —{' '}
                                  <span className="font-mono font-bold">
                                    {formatRupiah(item.nominal)}
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-slate-600">
                                  Alasan: {item.alasanTanpaTiket}
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDocumentPreview(
                                generateSpprDocument(selectedParticipant, config)
                              )
                            }
                            className="mt-4 flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Buka Pratinjau Cetak SPPR Resmi</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="text-center text-xs text-slate-500 p-6">
                        Peserta belum mengunggah dokumen pada kategori ini. Verifikator
                        dapat mengunggah bukti susulan melalui panel di bawah.
                      </div>
                    );
                  })()}
                </div>

                {/* Fitur Upload Manual Keuangan (Bukti Bayar Susulan Pasca-Kegiatan) */}
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs font-bold text-slate-900">
                    Fitur Upload Manual Keuangan (Bukti Bayar / Tiket Susulan)
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Jalur resmi bagi verifikator untuk mengunggah bukti tiket pulang atau
                    transfer susulan pasca-kegiatan disertai catatan audit.
                  </p>
                  <input
                    type="text"
                    value={lateAuditNote}
                    onChange={(e) => setLateAuditNote(e.target.value)}
                    placeholder="Catatan Audit Verifikator..."
                    className="mt-2 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Pilih File Bukti Susulan</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLateFileUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleSimulateLateUpload}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Simulasi Upload Susulan
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel: Kalkulator Otomatis Uang Harian, Validasi Transport & Generator PDF Individual */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6">
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-700">
                        {selectedParticipant.verification.noKuitansi}
                      </span>
                      <span className="text-xs text-slate-500">
                        Rekening: {selectedParticipant.namaBank} ·{' '}
                        <strong className="font-mono text-slate-800">
                          {selectedParticipant.noRekening}
                        </strong>
                      </span>
                    </div>
                    <h3 className="mt-1 text-base font-bold text-slate-900">
                      Kalkulator SPJ Peserta: {selectedParticipant.nama}
                    </h3>
                  </div>

                  {/* 1. Kalkulator Uang Harian (Hari Hadir x Tarif SBM) */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-bold text-slate-900">
                      1. Kalkulator Otomatis Uang Harian (Presensi &times; Tarif SBM)
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Jumlah Hari Hadir
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={hariDisetujui}
                          onChange={(e) =>
                            setHariDisetujui(Number(e.target.value) || 0)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Tarif Uang Harian SBM (Rp)
                        </label>
                        <input
                          type="number"
                          step={10000}
                          value={tarifUangHarian}
                          onChange={(e) =>
                            setTarifUangHarian(Number(e.target.value) || 0)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Subtotal Uang Harian
                        </label>
                        <div className="mt-1 flex h-[34px] items-center rounded-lg border border-slate-200 bg-slate-100 px-3 font-mono text-xs font-extrabold text-slate-900">
                          {formatRupiah(liveTotalUangHarian)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Validasi Biaya Transportasi */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        2. Validasi Biaya Transportasi (Tiket Resmi / SPPR)
                      </span>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gunakanSppr}
                          onChange={(e) => setGunakanSppr(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        <span>Gunakan Dasar SPPR Transport Lokal</span>
                      </label>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Nominal Transport Disetujui (Rp)
                        </label>
                        <input
                          type="number"
                          step={10000}
                          value={transportDisetujui}
                          onChange={(e) =>
                            setTransportDisetujui(Number(e.target.value) || 0)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Asal Kabupaten/Kota &amp; Plafon
                        </label>
                        <div className="mt-1 flex h-[34px] items-center text-xs text-slate-700">
                          {selectedParticipant.kabupatenKota} (SBM Lokal:{' '}
                          <span className="font-mono ml-1">
                            {formatRupiah(config.plafonTransportLokal)}
                          </span>
                          )
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Ringkasan Total & Fungsi Terbilang Otomatis */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        TOTAL BERSIH DITERIMA PESERTA:
                      </span>
                      <span className="font-mono text-lg font-extrabold text-blue-900">
                        {formatRupiah(liveTotalDiterima)}
                      </span>
                    </div>
                    <div className="mt-1.5 border-t border-blue-200 pt-2 text-xs text-blue-950">
                      <strong>Terbilang Otomatis (Kuitansi):</strong>{' '}
                      <span className="italic font-semibold"># {liveTerbilang} #</span>
                    </div>
                  </div>

                  {/* 4. Catatan Verifikator & Status */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Status Verifikasi Berkas
                      </label>
                      <select
                        value={statusBerkas}
                        onChange={(e) =>
                          setStatusBerkas(e.target.value as DocumentStatus)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      >
                        {Object.values(DocumentStatus).map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Status Pencairan Bendahara
                      </label>
                      <select
                        value={statusBayar}
                        onChange={(e) =>
                          setStatusBayar(
                            e.target.value as
                              | 'BELUM_DIBAYAR'
                              | 'SIAP_BAYAR'
                              | 'SUDAH_DIBAYAR'
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      >
                        <option value="BELUM_DIBAYAR">BELUM DIBAYAR</option>
                        <option value="SIAP_BAYAR">SIAP BAYAR / TRANSFER</option>
                        <option value="SUDAH_DIBAYAR">SUDAH DIBAYAR (LUNAS)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Catatan Pemeriksaan Verifikator Keuangan
                      </label>
                      <input
                        type="text"
                        value={catatanVerifikator}
                        onChange={(e) => setCatatanVerifikator(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Tombol Simpan Verifikasi & 1-Click PDF Peserta */}
                <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        handleSaveVerification(
                          DocumentStatus.TERVERIFIKASI,
                          'SUDAH_DIBAYAR'
                        )
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Setujui &amp; Sahkan SPJ Peserta</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveVerification()}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Simpan Perubahan
                    </button>
                  </div>

                  {/* Generator PDF Individual Peserta */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocumentPreview(
                          generateKuitansiPesertaDocument(selectedParticipant, config)
                        )
                      }
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Cetak Kuitansi + Terbilang (PDF)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDocumentPreview(
                          generateBendelPesertaDocument(selectedParticipant, config)
                        )
                      }
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                    >
                      <FileArchive className="h-3.5 w-3.5" />
                      <span>Bendel Arsip Lengkap Peserta (PDF)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: VERIFIKASI NARASUMBER & PETUGAS (MC, DOA, MODERATOR) + PPh 21
      ====================================================================== */}
      {mainTab === 'TAB_NARASUMBER' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Form Input & Kalkulator Otomatis PPh Pasal 21 */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSaveSpeakerForm}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  {editingSpeakerId
                    ? 'Edit Data Narasumber / Petugas'
                    : 'Input Narasumber & Petugas (MC, Doa, Moderator)'}
                </h2>
                {editingSpeakerId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSpeakerId(null);
                      setSpkNama('');
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    + Buat Baru
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Lengkap &amp; Gelar
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dr. H. Ahmad Fauzi, M.Si."
                    value={spkNama}
                    onChange={(e) => setSpkNama(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Peran Tugas
                  </label>
                  <select
                    value={spkPeran}
                    onChange={(e) => setSpkPeran(e.target.value as SpeakerRole)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    {Object.values(SpeakerRole).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Golongan / Pangkat (Penentu PPh 21)
                  </label>
                  <select
                    value={spkGolongan}
                    onChange={(e) => setSpkGolongan(e.target.value as GolonganType)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value={GolonganType.GOL_IV}>
                      Golongan IV (Tarif PPh 21: 15%)
                    </option>
                    <option value={GolonganType.GOL_III}>
                      Golongan III (Tarif PPh 21: 5%)
                    </option>
                    <option value={GolonganType.GOL_I_II}>
                      Golongan I / II (Tarif PPh 21: 0%)
                    </option>
                    <option value={GolonganType.NON_PNS}>
                      Non-ASN / Praktisi (5% NPWP / 6% Non-NPWP)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nomor NPWP
                  </label>
                  <input
                    type="text"
                    value={spkNpwp}
                    onChange={(e) => setSpkNpwp(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Unit Kerja / Instansi
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Inspektorat / BPKP / Kanwil"
                    value={spkInstansi}
                    onChange={(e) => setSpkInstansi(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Bank Penerima
                  </label>
                  <input
                    type="text"
                    value={spkBank}
                    onChange={(e) => setSpkBank(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nomor Rekening
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0192837465"
                    value={spkRekening}
                    onChange={(e) => setSpkRekening(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Judul Materi / Uraian Penugasan
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kebijakan Penatausahaan Keuangan..."
                    value={spkMateri}
                    onChange={(e) => setSpkMateri(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Jumlah Jam Mengajar (JP / Kegiatan)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={spkJP}
                    onChange={(e) => setSpkJP(Number(e.target.value) || 1)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tarif Honorarium per JP (Rp)
                  </label>
                  <input
                    type="number"
                    step={50000}
                    value={spkTarifJP}
                    onChange={(e) => setSpkTarifJP(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              {/* Box Kalkulasi Otomatis PPh 21 */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Honorarium Bruto:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatRupiah(liveSpeakerCalc.bruto)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Potongan PPh Pasal 21 ({liveSpeakerCalc.tarifPph21Persen}%):
                  </span>
                  <span className="font-mono font-semibold text-red-700">
                    - {formatRupiah(liveSpeakerCalc.potonganPph21)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                  <span>Netto Diterima (Masuk Rekening):</span>
                  <span className="font-mono text-blue-700">
                    {formatRupiah(liveSpeakerCalc.netto)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  {editingSpeakerId
                    ? 'Perbarui Perhitungan Narasumber'
                    : 'Simpan Narasumber & Hitung PPh 21'}
                </span>
              </button>
            </form>
          </div>

          {/* Right: Tabel Daftar Nominatif Narasumber & Petugas + Cetak PDF */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Daftar Nominatif Honorarium Narasumber, Moderator, MC &amp; Doa
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Klik baris untuk mengedit, atau cetak Daftar Nominatif &amp; Kuitansi
                    siap tanda tangan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onOpenDocumentPreview(
                      generateNominatifNarasumberDocument(speakers, config)
                    )
                  }
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Daftar Nominatif Honor (PDF)</span>
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">Nama &amp; Peran</th>
                      <th className="py-2.5 px-3 font-semibold">Golongan</th>
                      <th className="py-2.5 px-3 text-center font-semibold">JP</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Bruto</th>
                      <th className="py-2.5 px-3 text-right font-semibold">PPh 21</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Netto</th>
                      <th className="py-2.5 px-3 text-center font-semibold">Kuitansi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {speakers.map((sp) => (
                      <tr
                        key={sp.id}
                        onClick={() => handleSelectSpeakerForEdit(sp)}
                        className="cursor-pointer hover:bg-slate-50"
                      >
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{sp.nama}</div>
                          <div className="text-[11px] text-slate-500">
                            {sp.peran} · {sp.instansi}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[11px] font-medium">
                          {sp.golongan}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {sp.jumlahJP} JP
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {formatRupiah(sp.bruto)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-red-700">
                          {formatRupiah(sp.potonganPph21)} ({sp.tarifPph21Persen}%)
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(sp.netto)}
                        </td>
                        <td
                          className="py-3 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDocumentPreview(
                                generateKuitansiNarasumberDocument(sp, config)
                              )
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            <Printer className="h-3 w-3" />
                            <span>Kuitansi</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

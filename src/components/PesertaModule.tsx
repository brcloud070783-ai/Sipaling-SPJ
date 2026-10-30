import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  MapPin,
  Plus,
  Printer,
  ShieldCheck,
  Ship,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  ActivityConfig,
  DocumentationPhoto,
  GolonganType,
  InputMode,
  ParticipantRecord,
  ResourceMaterial,
  SpprItem,
} from '../types/simkantor';
import { generateSpprDocument, PrintableDocumentPayload } from '../utils/pdfGenerator';
import {
  compressImageFile,
  createSimulatedDocSvg,
  formatRupiah,
} from '../utils/spjCalculators';

interface PesertaModuleProps {
  config: ActivityConfig;
  participants: ParticipantRecord[];
  materials: ResourceMaterial[];
  photos: DocumentationPhoto[];
  selectedParticipantId: string;
  onSelectParticipant: (id: string) => void;
  onCheckIn: (participantId: string, dayIndex: number) => Promise<void>;
  onSaveBiodata: (payload: Partial<ParticipantRecord>) => Promise<string | undefined>;
  onUploadDocument: (payload: {
    participantId: string;
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport';
    dataUrl: string;
    originalSizeKB: number;
    compressedSizeKB: number;
    uploadedBy: string;
    isProxy: boolean;
    nominalTransport?: number;
  }) => Promise<void>;
  onSaveSppr: (participantId: string, items: SpprItem[]) => Promise<void>;
  onOpenDocumentPreview: (doc: PrintableDocumentPayload) => void;
}

const SESSION_STORAGE_KEY = 'simkantor_peserta_logged_in_v1';

export const PesertaModule: React.FC<PesertaModuleProps> = ({
  config,
  participants,
  materials,
  photos,
  selectedParticipantId,
  onSelectParticipant,
  onCheckIn,
  onSaveBiodata,
  onUploadDocument,
  onSaveSppr,
  onOpenDocumentPreview,
}) => {
  // Status apakah peserta sudah login dari halaman Home
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Mode form pada halaman Home Login Google ('PILIH_AKUN' | 'AKUN_BARU')
  const [loginMode, setLoginMode] = useState<'PILIH_AKUN' | 'AKUN_BARU'>('PILIH_AKUN');

  const activeParticipant =
    participants.find((p) => p.id === selectedParticipantId) || participants[0];

  const [activeSubTab, setActiveSubTab] = useState<
    'UTAMA' | 'SPPR_TRANSPORT' | 'MATERI_GALERI'
  >('UTAMA');

  // Toggle buka/tutup edit biodata agar tampilan utama tetap ringkas
  const [isEditingBio, setIsEditingBio] = useState(false);

  // State Biodata Ringkas (Nama, NIP, Instansi, No HP, Rekening)
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [instansi, setInstansi] = useState('');
  const [kabupatenKota, setKabupatenKota] = useState('');
  const [noHp, setNoHp] = useState('');
  const [namaBank, setNamaBank] = useState('BRI');
  const [noRekening, setNoRekening] = useState('');
  const [nominalTiketInput, setNominalTiketInput] = useState<number>(850000);

  // State Login Google Pribadi Baru
  const [newGoogleEmail, setNewGoogleEmail] = useState('');
  const [newGoogleName, setNewGoogleName] = useState('');
  const [newGoogleNip, setNewGoogleNip] = useState('');
  const [newGoogleInstansi, setNewGoogleInstansi] = useState('');

  // State Smart Transport (SPPR)
  const [spprItems, setSpprItems] = useState<SpprItem[]>([]);
  const [ruteAsal, setRuteAsal] = useState('Dermaga Pulau');
  const [ruteTujuan, setRuteTujuan] = useState('Pelabuhan Kabupaten');
  const [modaTransport, setModaTransport] = useState(
    'Speedboat / Ketinting Sewaan (PP)'
  );
  const [alasanTanpaTiket, setAlasanTanpaTiket] = useState(
    'Transportasi lokal masyarakat tidak menerbitkan tiket resmi bercap.'
  );
  const [nominalSpprItem, setNominalSpprItem] = useState<number>(350000);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeParticipant) {
      setNama(activeParticipant.nama);
      setNip(activeParticipant.nip);
      setInstansi(activeParticipant.instansi);
      setKabupatenKota(activeParticipant.kabupatenKota);
      setNoHp(activeParticipant.noHp);
      setNamaBank(activeParticipant.namaBank);
      setNoRekening(activeParticipant.noRekening);
      setSpprItems(activeParticipant.spprItems || []);
      if (activeParticipant.verification.transportDisetujui > 0) {
        setNominalTiketInput(activeParticipant.verification.transportDisetujui);
      }
    }
  }, [activeParticipant]);

  const triggerToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleLoginWithSelectedGoogle = (participantId: string) => {
    onSelectParticipant(participantId);
    setIsLoggedIn(true);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
    } catch {
      // ignore storage error
    }
    const chosen = participants.find((p) => p.id === participantId);
    triggerToast(
      `Selamat datang, ${chosen?.nama || 'Peserta'}. Silakan absen & unggah dokumen SPJ.`
    );
  };

  const handleGoogleSignInNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoogleName.trim() || !newGoogleEmail.trim()) return;
    setIsSubmitting(true);
    try {
      const normalizedEmail = newGoogleEmail.includes('@')
        ? newGoogleEmail.trim().toLowerCase()
        : `${newGoogleEmail.trim().toLowerCase()}@gmail.com`;

      const createdId = await onSaveBiodata({
        nama: newGoogleName.trim(),
        email: normalizedEmail,
        nip: newGoogleNip.trim() || `1992061520201210${participants.length + 1}`,
        instansi: newGoogleInstansi.trim() || 'SMAN 1 Kepulauan',
        kabupatenKota: 'Kab. Kepulauan',
        pangkatGolongan: GolonganType.GOL_III,
        jabatan: 'Peserta Kegiatan',
        noHp: '081277889900',
        namaBank: 'BRI',
        noRekening: '0184-01-099887-50-2',
        inputMode: InputMode.MANDIRI,
      });
      if (createdId) onSelectParticipant(createdId);
      setIsLoggedIn(true);
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      setNewGoogleEmail('');
      setNewGoogleName('');
      setNewGoogleNip('');
      setNewGoogleInstansi('');
      triggerToast(`Berhasil masuk sebagai ${newGoogleName.trim()} (${normalizedEmail}).`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutToHome = () => {
    setIsLoggedIn(false);
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setStatusMessage(null);
  };

  const handleSaveBiodataForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParticipant) return;
    setIsSubmitting(true);
    try {
      await onSaveBiodata({
        id: activeParticipant.id,
        nama,
        nip,
        instansi,
        kabupatenKota,
        noHp,
        namaBank,
        noRekening,
        inputMode: InputMode.MANDIRI,
      });
      setIsEditingBio(false);
      triggerToast('Biodata berhasil disimpan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCameraFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeParticipant) return;
    setIsSubmitting(true);
    try {
      const compressed = await compressImageFile(file, 1400, 0.78);
      await onUploadDocument({
        participantId: activeParticipant.id,
        docType,
        dataUrl: compressed.dataUrl,
        originalSizeKB: compressed.originalSizeKB,
        compressedSizeKB: compressed.compressedSizeKB,
        uploadedBy: activeParticipant.nama,
        isProxy: false,
        nominalTransport: docType === 'buktiTransport' ? nominalTiketInput : undefined,
      });
      triggerToast(
        `Berhasil diunggah (${compressed.compressedSizeKB} KB) ke Google Drive Panitia.`
      );
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Gagal memproses foto.');
    } finally {
      setIsSubmitting(false);
      e.target.value = '';
    }
  };

  const handleSimulateCameraCapture = async (
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport'
  ) => {
    if (!activeParticipant) return;
    setIsSubmitting(true);
    try {
      const svgMap = {
        suratTugas: 'SURAT_TUGAS' as const,
        sppdVisum: 'SPPD_VISUM' as const,
        buktiTransport: 'TIKET_TRANSPORT' as const,
      };
      const simulatedDataUrl = createSimulatedDocSvg({
        docType: svgMap[docType],
        nama: activeParticipant.nama,
        nip: activeParticipant.nip,
        instansi: activeParticipant.instansi,
        nomorDokumen: `DOC/${config.tahunAnggaran}/${activeParticipant.nip.slice(-5)}`,
        tanggal: new Date().toLocaleDateString('id-ID'),
        nominal:
          docType === 'buktiTransport' ? formatRupiah(nominalTiketInput) : undefined,
        rute: `${activeParticipant.kabupatenKota} - ${config.lokasiKegiatan.split(',')[0]}`,
      });

      await onUploadDocument({
        participantId: activeParticipant.id,
        docType,
        dataUrl: simulatedDataUrl,
        originalSizeKB: 3400,
        compressedSizeKB: 225,
        uploadedBy: activeParticipant.nama,
        isProxy: false,
        nominalTransport: docType === 'buktiTransport' ? nominalTiketInput : undefined,
      });
      triggerToast('Dokumen berhasil dipotret & tersimpan di Drive Panitia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSpprItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParticipant || !ruteAsal.trim() || !ruteTujuan.trim()) return;
    const newItem: SpprItem = {
      id: `sppr-${Date.now()}`,
      tanggal: new Date().toISOString().slice(0, 10),
      ruteAsal: ruteAsal.trim(),
      ruteTujuan: ruteTujuan.trim(),
      modaTransport: modaTransport.trim(),
      alasanTanpaTiket: alasanTanpaTiket.trim(),
      nominal: Number(nominalSpprItem) || 0,
    };
    const updated = [...spprItems, newItem];
    setSpprItems(updated);
    setIsSubmitting(true);
    try {
      await onSaveSppr(activeParticipant.id, updated);
      triggerToast('Rute transport lokal disimpan ke SPPR.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSpprItem = async (itemId: string) => {
    if (!activeParticipant) return;
    const updated = spprItems.filter((i) => i.id !== itemId);
    setSpprItems(updated);
    await onSaveSppr(activeParticipant.id, updated);
  };

  const handleDownloadMaterial = (mat: ResourceMaterial) => {
    const content = `MATERI KEGIATAN: ${config.namaKegiatan}\nJudul: ${mat.judul}\nNarasumber: ${mat.narasumber}\n\n${mat.ringkasan}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mat.judul.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast(`Mengunduh: ${mat.judul}`);
  };

  if (!activeParticipant) return null;

  // =========================================================================
  // TAHAP 1: HALAMAN BERANDA (HOME PESERTA) & LOGIN AKUN GOOGLE PRIBADI
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 pb-12">
        {/* Banner Sambutan / Home Kegiatan */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="bg-slate-900 px-6 py-6 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">
              Portal Peserta · {config.instansiPenyelenggara}
            </div>
            <h1 className="mt-1.5 text-xl font-bold leading-snug sm:text-2xl">
              {config.namaKegiatan}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-400" />
                {config.lokasiKegiatan}
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                {config.tanggalMulai} s.d. {config.tanggalSelesai} (
                {config.jumlahHariKegiatan} Hari)
              </span>
            </div>
          </div>

          {/* 3 Langkah Alur Peserta */}
          <div className="grid grid-cols-1 divide-y divide-slate-200 bg-slate-50/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-4">
              <div className="font-mono text-xs font-bold text-blue-700">LANGKAH 01</div>
              <div className="mt-0.5 text-xs font-bold text-slate-900">
                Login Akun Google
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Masuk menggunakan akun Google pribadi sebagai identitas resmi peserta.
              </p>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs font-bold text-blue-700">LANGKAH 02</div>
              <div className="mt-0.5 text-xs font-bold text-slate-900">
                Absen &amp; Foto Dokumen
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Check-in harian dan foto Surat Tugas, SPPD/Visum, serta Tiket/SPPR.
              </p>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs font-bold text-blue-700">LANGKAH 03</div>
              <div className="mt-0.5 text-xs font-bold text-slate-900">
                Verifikasi &amp; Pencairan SPJ
              </div>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Berkas otomatis masuk ke Google Drive Panitia untuk pencairan uang harian.
              </p>
            </div>
          </div>
        </div>

        {/* Kartu Login Akun Google Pribadi */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {/* Google "G" Logo Resmi */}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-2xs shrink-0">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Masuk dengan Akun Google Pribadi
                </h2>
                <p className="text-xs text-slate-500">
                  Silakan masuk terlebih dahulu untuk mengakses halaman absen &amp; upload
                  dokumen SPJ.
                </p>
              </div>
            </div>

            {/* Switcher Pilih Akun vs Login Email Baru */}
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLoginMode('PILIH_AKUN')}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  loginMode === 'PILIH_AKUN'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Akun Terdaftar
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('AKUN_BARU')}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  loginMode === 'AKUN_BARU'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Akun Google Baru
              </button>
            </div>
          </div>

          {loginMode === 'PILIH_AKUN' ? (
            <div className="mt-5 space-y-2.5 border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold text-slate-700">
                Pilih Akun Google Peserta untuk Masuk:
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {participants.map((p) => {
                  const docDone = [
                    p.documents.suratTugas,
                    p.documents.sppdVisum,
                    p.documents.buktiTransport || p.documents.spprGenerated,
                  ].filter(Boolean).length;

                  return (
                    <div
                      key={p.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-colors hover:border-blue-300 hover:bg-blue-50/30 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white shrink-0">
                          {p.nama
                            .split(' ')
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{p.nama}</div>
                          <div className="font-mono text-[11px] text-blue-700">
                            {p.email}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {p.instansi} · Berkas: {docDone}/3
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoginWithSelectedGoogle(p.id)}
                        className="flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors shrink-0"
                      >
                        <UserCheck className="h-4 w-4" />
                        <span>Masuk sebagai {p.nama.split(' ')[0]}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleGoogleSignInNew}
              className="mt-5 space-y-3 border-t border-slate-200 pt-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Akun Google Pribadi
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="contoh: budi.santoso@gmail.com"
                    value={newGoogleEmail}
                    onChange={(e) => setNewGoogleEmail(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Lengkap &amp; Gelar
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso, S.Pd."
                    value={newGoogleName}
                    onChange={(e) => setNewGoogleName(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    NIP (Opsional / Isi jika ASN)
                  </label>
                  <input
                    type="text"
                    placeholder="198805122015031004"
                    value={newGoogleNip}
                    onChange={(e) => setNewGoogleNip(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Asal Instansi / Sekolah
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SMAN 1 Kepulauan"
                    value={newGoogleInstansi}
                    onChange={(e) => setNewGoogleInstansi(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Lanjutkan Masuk dengan Google</span>
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Privasi &amp; Keamanan:</strong> Login Google hanya digunakan untuk
              verifikasi identitas peserta. Seluruh foto dokumen SPJ disimpan terpusat di
              Google Drive resmi Panitia.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TAHAP 2: DASHBOARD PESERTA (SETELAH LOGIN AKUN GOOGLE BERHASIL)
  // =========================================================================
  const hasSt = Boolean(activeParticipant.documents.suratTugas);
  const hasSppd = Boolean(activeParticipant.documents.sppdVisum);
  const hasTransport = Boolean(
    activeParticipant.documents.buktiTransport ||
      activeParticipant.documents.spprGenerated ||
      activeParticipant.documents.buktiBayarSusulan
  );
  const completedCount = [hasSt, hasSppd, hasTransport].filter(Boolean).length;
  const totalSpprNominal = spprItems.reduce((acc, i) => acc + i.nominal, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-20 lg:pb-8">
      {/* Notifikasi Ringkas */}
      {statusMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
          {statusMessage}
        </div>
      )}

      {/* 1. KARTU PROFIL AKUN GOOGLE AKTIF & TOMBOL KELUAR KE HOME */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span>Akun Google Aktif:</span>
              <span className="font-mono font-semibold text-blue-700">
                {activeParticipant.email}
              </span>
            </div>
            <h1 className="mt-0.5 text-lg font-bold text-slate-900">
              {activeParticipant.nama}
            </h1>
            <p className="text-xs text-slate-600">
              NIP. <span className="font-mono">{activeParticipant.nip}</span> ·{' '}
              {activeParticipant.instansi}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogoutToHome}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span>Ganti Akun / Home</span>
            </button>
          </div>
        </div>

        {/* Smart Alert Bar (1 Baris Ringkas) */}
        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
            completedCount === 3
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {completedCount === 3 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
            )}
            <span>
              <strong>Kelengkapan Berkas: {completedCount}/3</strong> (
              {completedCount === 3
                ? 'Lengkap & Tersimpan di Drive Panitia'
                : 'Segera foto Surat Tugas, SPPD & Tiket/SPPR'}
              )
            </span>
          </div>
          <span className="font-mono font-bold">
            Estimasi Terima: {formatRupiah(activeParticipant.verification.totalDiterima)}
          </span>
        </div>
      </div>

      {/* 2. TOMBOL NAVIGASI 3 MENU RINGKAS */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-200/70 p-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('UTAMA')}
          className={`min-h-[42px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            activeSubTab === 'UTAMA'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          1. Absen &amp; Upload Berkas
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('SPPR_TRANSPORT')}
          className={`min-h-[42px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            activeSubTab === 'SPPR_TRANSPORT'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          2. Transport Tanpa Tiket (SPPR)
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('MATERI_GALERI')}
          className={`min-h-[42px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            activeSubTab === 'MATERI_GALERI'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          3. Materi &amp; Galeri Foto
        </button>
      </div>

      {/* =======================================================================
          MENU 1: ABSEN HARIAN, UPLOAD 3 DOKUMEN & BIODATA SINGKAT
      ======================================================================== */}
      {activeSubTab === 'UTAMA' && (
        <div className="space-y-4">
          {/* A. Presensi Harian Ringkas */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-blue-700" />
                <span>Absen Harian ({config.lokasiKegiatan.split(',')[0]})</span>
              </div>
              <span className="font-mono text-xs font-semibold text-blue-700">
                Hadir: {activeParticipant.attendance.length}/{config.jumlahHariKegiatan} Hari
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {Array.from({ length: config.jumlahHariKegiatan }, (_, idx) => {
                const dayNum = idx + 1;
                const record = activeParticipant.attendance.find(
                  (a) => a.dayIndex === dayNum
                );
                return record ? (
                  <div
                    key={dayNum}
                    className="flex min-h-[46px] flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-1.5 text-center"
                  >
                    <span className="text-xs font-bold text-emerald-900">
                      Hari {dayNum} ✓
                    </span>
                    <span className="font-mono text-[10px] text-emerald-700">
                      {record.checkInTime}
                    </span>
                  </div>
                ) : (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={async () => {
                      await onCheckIn(activeParticipant.id, dayNum);
                      triggerToast(`Absen Hari ke-${dayNum} berhasil tercatat.`);
                    }}
                    className="min-h-[46px] rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
                  >
                    Check-In Hari {dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* B. Upload 3 Dokumen Kamera (3 Kartu Simpel) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Foto Dokumen SPJ (Otomatis Masuk Google Drive Panitia)
              </h2>
              <span className="font-mono text-[11px] text-slate-500">
                Auto-Compress &lt;300 KB
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  key: 'suratTugas' as const,
                  title: '1. Surat Tugas',
                  subtitle: 'SPT dari Instansi Asal',
                  doc: activeParticipant.documents.suratTugas,
                },
                {
                  key: 'sppdVisum' as const,
                  title: '2. SPPD & Visum',
                  subtitle: 'Lembar Cap Basah',
                  doc: activeParticipant.documents.sppdVisum,
                },
                {
                  key: 'buktiTransport' as const,
                  title: '3. Tiket Transport',
                  subtitle: 'Tiket Resmi / Boarding Pass',
                  doc: activeParticipant.documents.buktiTransport,
                },
              ].map((slot) => (
                <div
                  key={slot.key}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {slot.title}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          slot.doc ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {slot.doc ? 'SUDAH ADA' : 'BELUM'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{slot.subtitle}</p>

                    {slot.key === 'buktiTransport' && (
                      <div className="mt-2">
                        <label className="block text-[10px] font-semibold text-slate-600">
                          Nominal Tiket PP (Rp):
                        </label>
                        <input
                          type="number"
                          value={nominalTiketInput}
                          onChange={(e) =>
                            setNominalTiketInput(Number(e.target.value) || 0)
                          }
                          className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs font-bold"
                        />
                      </div>
                    )}

                    {slot.doc && (
                      <div className="mt-2 flex items-center gap-2 rounded border border-slate-200 bg-white p-1.5">
                        <img
                          src={slot.doc.dataUrl}
                          alt={slot.title}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded object-cover shrink-0"
                        />
                        <div className="min-w-0 text-[10px]">
                          <div className="truncate font-mono font-semibold text-slate-800">
                            {slot.doc.fileName}
                          </div>
                          <div className="font-mono text-emerald-700">
                            {slot.doc.compressedSizeKB} KB · Tersimpan
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <label className="flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors">
                      <Camera className="h-4 w-4" />
                      <span>{slot.doc ? 'Foto Ulang' : 'Buka Kamera HP'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleCameraFileChange(e, slot.key)}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSimulateCameraCapture(slot.key)}
                      className="w-full rounded py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                    >
                      Atau Simulasi Potret Cepat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* C. Biodata Singkat (Dapat Dibuka/Tutup agar Tidak Penuh) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => setIsEditingBio(!isEditingBio)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Biodata &amp; Nomor Rekening Peserta
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeParticipant.instansi} · HP:{' '}
                  <span className="font-mono">{activeParticipant.noHp}</span> · Rekening:{' '}
                  <span className="font-mono">
                    {activeParticipant.namaBank} {activeParticipant.noRekening}
                  </span>
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-blue-700">
                <span>{isEditingBio ? 'Tutup' : 'Ubah Data'}</span>
                {isEditingBio ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>

            {isEditingBio && (
              <form
                onSubmit={handleSaveBiodataForm}
                className="mt-4 border-t border-slate-200 pt-4 space-y-3"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Lengkap &amp; Gelar
                    </label>
                    <input
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      NIP
                    </label>
                    <input
                      type="text"
                      required
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Asal Instansi / Sekolah
                    </label>
                    <input
                      type="text"
                      required
                      value={instansi}
                      onChange={(e) => setInstansi(e.target.value)}
                      className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nomor HP / WhatsApp
                    </label>
                    <input
                      type="tel"
                      required
                      value={noHp}
                      onChange={(e) => setNoHp(e.target.value)}
                      className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nama Bank
                    </label>
                    <input
                      type="text"
                      value={namaBank}
                      onChange={(e) => setNamaBank(e.target.value)}
                      className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Nomor Rekening
                    </label>
                    <input
                      type="text"
                      value={noRekening}
                      onChange={(e) => setNoRekening(e.target.value)}
                      className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Simpan Biodata
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          MENU 2: SMART TRANSPORT / SURAT PERNYATAAN RIIL (SPPR) RINGKAS
      ======================================================================== */}
      {activeSubTab === 'SPPR_TRANSPORT' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                  <Ship className="h-4 w-4" />
                  <span>Transport Lokal Tanpa Tiket Resmi (SPPR)</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  Khusus pengguna ketinting, speedboat sewaan, atau ojek lokal yang tidak
                  memiliki tiket bercap.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenDocumentPreview(generateSpprDocument(activeParticipant, config))
                }
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Printer className="h-4 w-4" />
                <span>Cetak PDF SPPR ({formatRupiah(totalSpprNominal)})</span>
              </button>
            </div>

            {/* Form Tambah Rute SPPR Simpel */}
            <form
              onSubmit={handleAddSpprItem}
              className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Dari (Asal)
                </label>
                <input
                  type="text"
                  required
                  value={ruteAsal}
                  onChange={(e) => setRuteAsal(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Ke (Tujuan)
                </label>
                <input
                  type="text"
                  required
                  value={ruteTujuan}
                  onChange={(e) => setRuteTujuan(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Moda Transport Lokal
                </label>
                <select
                  value={modaTransport}
                  onChange={(e) => setModaTransport(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs"
                >
                  <option value="Speedboat / Ketinting Sewaan (PP)">
                    Speedboat / Ketinting Sewaan (PP)
                  </option>
                  <option value="Pompong Laut Antar-Pulau (PP)">
                    Pompong Laut Antar-Pulau (PP)
                  </option>
                  <option value="Ojek Pangkalan / Pedalaman (PP)">
                    Ojek Pangkalan / Pedalaman (PP)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nominal Biaya Riil (Rp)
                </label>
                <input
                  type="number"
                  required
                  step={5000}
                  value={nominalSpprItem}
                  onChange={(e) => setNominalSpprItem(Number(e.target.value) || 0)}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 font-mono text-xs font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Alasan Tanpa Tiket Resmi
                </label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    required
                    value={alasanTanpaTiket}
                    onChange={(e) => setAlasanTanpaTiket(e.target.value)}
                    className="flex-1 min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Rute</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Daftar Rute SPPR */}
            {spprItems.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                {spprItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {idx + 1}. {item.modaTransport} ({item.ruteAsal} &rarr;{' '}
                        {item.ruteTujuan})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.alasanTanpaTiket}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900">
                        {formatRupiah(item.nominal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpprItem(item.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          MENU 3: PUSAT MATERI & GALERI HARIAN RINGKAS
      ======================================================================== */}
      {activeSubTab === 'MATERI_GALERI' && (
        <div className="space-y-4">
          {/* Pusat Materi */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">
              Pusat Materi Narasumber (Resource Center)
            </h2>
            <div className="mt-3 divide-y divide-slate-200">
              {materials.map((mat) => (
                <div
                  key={mat.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-900">
                      {mat.judul}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {mat.narasumber} · <span className="font-mono">{mat.ukuranFile}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadMaterial(mat)}
                    className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Unduh</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Galeri Dokumentasi */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">
              Galeri Foto Dokumentasi Kegiatan
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.judul}
                    referrerPolicy="no-referrer"
                    className="h-36 w-full object-cover"
                  />
                  <div className="p-2.5">
                    <div className="text-[10px] font-semibold text-blue-700">
                      {photo.kategori} · Hari ke-{photo.hariKe}
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-slate-900">
                      {photo.judul}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigasi Bawah Khusus Layar HP */}
      <div className="fixed bottom-0 left-0 right-0 z-30 grid h-14 grid-cols-3 items-center border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setActiveSubTab('UTAMA')}
          className={`flex flex-col items-center justify-center py-1 text-[11px] font-semibold ${
            activeSubTab === 'UTAMA' ? 'text-blue-700' : 'text-slate-600'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span className="mt-0.5">Absen &amp; Berkas</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('SPPR_TRANSPORT')}
          className={`flex flex-col items-center justify-center py-1 text-[11px] font-semibold ${
            activeSubTab === 'SPPR_TRANSPORT' ? 'text-blue-700' : 'text-slate-600'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span className="mt-0.5">SPPR Transport</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('MATERI_GALERI')}
          className={`flex flex-col items-center justify-center py-1 text-[11px] font-semibold ${
            activeSubTab === 'MATERI_GALERI' ? 'text-blue-700' : 'text-slate-600'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span className="mt-0.5">Materi &amp; Galeri</span>
        </button>
      </div>
    </div>
  );
};

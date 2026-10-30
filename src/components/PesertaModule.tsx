import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudCheck,
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
import { compressImageFile, formatRupiah } from '../utils/spjCalculators';

interface FirebaseUserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface PesertaModuleProps {
  config: ActivityConfig;
  participants: ParticipantRecord[];
  materials: ResourceMaterial[];
  photos: DocumentationPhoto[];
  selectedParticipantId: string;
  firebaseUser: FirebaseUserInfo | null;
  onGooglePopupSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
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

const SESSION_PARTICIPANT_ID_KEY = 'simkantor_active_peserta_id_v2';

export const PesertaModule: React.FC<PesertaModuleProps> = ({
  config,
  participants,
  materials,
  photos,
  selectedParticipantId,
  firebaseUser,
  onGooglePopupSignIn,
  onGoogleSignOut,
  onSelectParticipant,
  onCheckIn,
  onSaveBiodata,
  onUploadDocument,
  onSaveSppr,
  onOpenDocumentPreview,
}) => {
  const [loggedInParticipantId, setLoggedInParticipantId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_PARTICIPANT_ID_KEY);
    } catch {
      return null;
    }
  });

  // Cari peserta yang cocok dengan UID Google atau email Google yang sedang login
  const matchedByFirebase = firebaseUser
    ? participants.find(
        (p) =>
          p.id === firebaseUser.uid ||
          (firebaseUser.email &&
            p.email.toLowerCase() === firebaseUser.email.toLowerCase())
      )
    : undefined;

  const activeParticipant =
    matchedByFirebase ||
    participants.find((p) => p.id === (loggedInParticipantId || selectedParticipantId));

  const [activeSubTab, setActiveSubTab] = useState<
    'UTAMA' | 'SPPR_TRANSPORT' | 'MATERI_GALERI'
  >('UTAMA');

  const [isEditingBio, setIsEditingBio] = useState(false);

  // State Form Registrasi / Konfirmasi Biodata setelah Login Google
  const [googleEmail, setGoogleEmail] = useState('');
  const [loginNama, setLoginNama] = useState('');
  const [loginNip, setLoginNip] = useState('');
  const [loginInstansi, setLoginInstansi] = useState('');
  const [loginKabKota, setLoginKabKota] = useState('');
  const [loginNoHp, setLoginNoHp] = useState('');
  const [loginBank, setLoginBank] = useState('BRI');
  const [loginNoRek, setLoginNoRek] = useState('');

  // State Edit Biodata setelah masuk
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [instansi, setInstansi] = useState('');
  const [kabupatenKota, setKabupatenKota] = useState('');
  const [noHp, setNoHp] = useState('');
  const [namaBank, setNamaBank] = useState('BRI');
  const [noRekening, setNoRekening] = useState('');
  const [nominalTiketInput, setNominalTiketInput] = useState<number>(0);

  // State Smart Transport (SPPR)
  const [spprItems, setSpprItems] = useState<SpprItem[]>([]);
  const [ruteAsal, setRuteAsal] = useState('');
  const [ruteTujuan, setRuteTujuan] = useState('');
  const [modaTransport, setModaTransport] = useState(
    'Speedboat / Ketinting Sewaan (PP)'
  );
  const [alasanTanpaTiket, setAlasanTanpaTiket] = useState(
    'Transportasi lokal masyarakat tidak menerbitkan tiket resmi bercap.'
  );
  const [nominalSpprItem, setNominalSpprItem] = useState<number>(250000);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Isi otomatis Nama & Email dari Akun Google Firebase saat berhasil Sign-In
  useEffect(() => {
    if (firebaseUser) {
      if (firebaseUser.email) setGoogleEmail(firebaseUser.email);
      if (firebaseUser.displayName && !loginNama) {
        setLoginNama(firebaseUser.displayName);
      }
    }
  }, [firebaseUser, loginNama]);

  useEffect(() => {
    const cleanEmail = googleEmail.trim().toLowerCase();
    const cleanNip = loginNip.trim();
    if (!cleanEmail && !cleanNip) return;

    const existing = participants.find(
      (p) =>
        (cleanEmail && p.email.toLowerCase() === cleanEmail) ||
        (cleanNip.length >= 8 && p.nip === cleanNip)
    );
    if (existing) {
      setLoginNama(existing.nama);
      setLoginNip(existing.nip);
      setLoginInstansi(existing.instansi);
      setLoginKabKota(existing.kabupatenKota);
      setLoginNoHp(existing.noHp);
      setLoginBank(existing.namaBank);
      setLoginNoRek(existing.noRekening);
    }
  }, [googleEmail, loginNip, participants]);

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
      setNominalTiketInput(activeParticipant.verification.transportDisetujui || 0);
    }
  }, [activeParticipant]);

  const triggerToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handlePopupGoogleClick = async () => {
    setIsSubmitting(true);
    try {
      await onGooglePopupSignIn();
      triggerToast('Berhasil terhubung dengan Akun Google Anda.');
    } catch (err) {
      triggerToast(
        err instanceof Error
          ? `Login Google: ${err.message}`
          : 'Gagal membuka pop-up Login Google.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim() || !loginNama.trim() || !loginNip.trim()) return;
    setIsSubmitting(true);
    try {
      const normalizedEmail = googleEmail.includes('@')
        ? googleEmail.trim().toLowerCase()
        : `${googleEmail.trim().toLowerCase()}@gmail.com`;

      const existing = participants.find(
        (p) =>
          (firebaseUser && p.id === firebaseUser.uid) ||
          p.email.toLowerCase() === normalizedEmail ||
          p.nip === loginNip.trim()
      );

      const savedId = await onSaveBiodata({
        id: firebaseUser?.uid || existing?.id,
        nama: loginNama.trim(),
        email: normalizedEmail,
        nip: loginNip.trim(),
        instansi: loginInstansi.trim() || 'Instansi Peserta',
        kabupatenKota: loginKabKota.trim() || 'Kabupaten/Kota',
        pangkatGolongan: existing?.pangkatGolongan || GolonganType.GOL_III,
        jabatan: existing?.jabatan || 'Peserta Kegiatan',
        noHp: loginNoHp.trim() || '-',
        namaBank: loginBank.trim() || 'BRI',
        noRekening: loginNoRek.trim() || '-',
        inputMode: InputMode.MANDIRI,
      });

      const targetId = savedId || firebaseUser?.uid || existing?.id;
      if (targetId) {
        onSelectParticipant(targetId);
        setLoggedInParticipantId(targetId);
        try {
          localStorage.setItem(SESSION_PARTICIPANT_ID_KEY, targetId);
        } catch {
          // ignore
        }
      }
      triggerToast(
        `Selamat datang, ${loginNama.trim()}. Data tersimpan di Cloud Firebase.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutToHome = async () => {
    setLoggedInParticipantId(null);
    try {
      localStorage.removeItem(SESSION_PARTICIPANT_ID_KEY);
    } catch {
      // ignore
    }
    await onGoogleSignOut();
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
      triggerToast('Data peserta berhasil diperbarui ke Cloud Firebase.');
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
      const compressed = await compressImageFile(file, 1200, 0.75);
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
        `Dokumen berhasil diunggah (${compressed.compressedSizeKB} KB) & tersinkronisasi ke Cloud.`
      );
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Gagal memproses foto dokumen.');
    } finally {
      setIsSubmitting(false);
      e.target.value = '';
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
    setRuteAsal('');
    setRuteTujuan('');
    setIsSubmitting(true);
    try {
      await onSaveSppr(activeParticipant.id, updated);
      triggerToast('Rincian transport lokal berhasil disimpan ke Cloud.');
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
    triggerToast(`Mengunduh materi: ${mat.judul}`);
  };

  // =========================================================================
  // TAHAP 1: HALAMAN BERANDA RESMI (HOME) & LOGIN AKUN GOOGLE PRIBADI
  // =========================================================================
  const isReadyForDashboard = Boolean(
    (loggedInParticipantId || matchedByFirebase) && activeParticipant
  );

  if (!isReadyForDashboard || !activeParticipant) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pb-12">
        {statusMessage && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
            {statusMessage}
          </div>
        )}

        {/* Header Beranda Kegiatan Resmi */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="bg-slate-900 px-6 py-6 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">
              {config.instansiPenyelenggara}
            </div>
            <h1 className="mt-1.5 text-lg font-bold leading-snug sm:text-xl">
              {config.namaKegiatan}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                {config.lokasiKegiatan}
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                {config.tanggalMulai} s.d. {config.tanggalSelesai} (
                {config.jumlahHariKegiatan} Hari)
              </span>
            </div>
          </div>

          {/* Panduan 3 Langkah Peserta */}
          <div className="grid grid-cols-1 divide-y divide-slate-200 bg-slate-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-3.5">
              <div className="font-mono text-[11px] font-bold text-blue-700">
                1. LOGIN GOOGLE
              </div>
              <p className="mt-0.5 text-xs text-slate-700">
                Klik tombol Masuk dengan Google &amp; lengkapi biodata singkat.
              </p>
            </div>
            <div className="p-3.5">
              <div className="font-mono text-[11px] font-bold text-blue-700">
                2. ABSEN HARIAN
              </div>
              <p className="mt-0.5 text-xs text-slate-700">
                Klik tombol Check-In kehadiran setiap hari kegiatan.
              </p>
            </div>
            <div className="p-3.5">
              <div className="font-mono text-[11px] font-bold text-blue-700">
                3. UPLOAD BERKAS SPJ
              </div>
              <p className="mt-0.5 text-xs text-slate-700">
                Foto Surat Tugas, SPPD/Visum, dan Tiket Transport.
              </p>
            </div>
          </div>
        </div>

        {/* Kartu Login Google Resmi (Firebase Authentication) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
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
                  Langkah 1: Login Akun Google Pribadi
                </h2>
                <p className="text-xs text-slate-500">
                  {firebaseUser
                    ? `Terhubung sebagai ${firebaseUser.email}`
                    : 'Klik tombol di samping untuk memilih akun Google Anda.'}
                </p>
              </div>
            </div>

            {!firebaseUser ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handlePopupGoogleClick}
                className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-2xs hover:bg-slate-50 transition-colors shrink-0"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                <span>Sign in with Google</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                <CloudCheck className="h-4 w-4 text-emerald-700" />
                <span>Google Terverifikasi</span>
              </div>
            )}
          </div>

          {/* Form Lengkapi Biodata Peserta */}
          <form onSubmit={handleGoogleLoginSubmit} className="mt-4 space-y-3.5">
            <div className="text-xs font-bold text-slate-900">
              Langkah 2: Konfirmasi Biodata Peserta Kegiatan
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Alamat Email Akun Google Pribadi <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="nama.anda@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-slate-50 px-3.5 font-mono text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Lengkap &amp; Gelar <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Fauzi, S.Pd."
                  value={loginNama}
                  onChange={(e) => setLoginNama(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  NIP / NIK <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="198504122011011005"
                  value={loginNip}
                  onChange={(e) => setLoginNip(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 font-mono text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Asal Instansi / Satuan Kerja <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dinas Pendidikan / SMAN 1"
                  value={loginInstansi}
                  onChange={(e) => setLoginInstansi(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Asal Kabupaten / Kota <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kab. Natuna"
                  value={loginKabKota}
                  onChange={(e) => setLoginKabKota(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nomor HP / WhatsApp Aktif <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0812xxxxxxxx"
                  value={loginNoHp}
                  onChange={(e) => setLoginNoHp(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3.5 font-mono text-xs focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Bank &amp; Nomor Rekening Pencairan
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={loginBank}
                    onChange={(e) => setLoginBank(e.target.value)}
                    className="min-h-[42px] w-24 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="BRI">BRI</option>
                    <option value="BNI">BNI</option>
                    <option value="Mandiri">Mandiri</option>
                    <option value="BSI">BSI</option>
                    <option value="BPD">BPD</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Nomor Rekening"
                    value={loginNoRek}
                    onChange={(e) => setLoginNoRek(e.target.value)}
                    className="min-h-[42px] flex-1 rounded-lg border border-slate-300 px-3 font-mono text-xs focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
              >
                <UserCheck className="h-4 w-4" />
                <span>Masuk &amp; Lanjutkan ke Upload Dokumen SPJ</span>
              </button>
            </div>
          </form>

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Tersinkronisasi Otomatis (Cloud Firebase):</strong> Begitu Anda
              masuk dan mengunggah foto dokumen, data langsung diterima di layar
              Verifikator Keuangan Panitia secara real-time.
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
      {statusMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-900">
          {statusMessage}
        </div>
      )}

      {/* 1. KARTU PROFIL AKUN GOOGLE AKTIF & STATUS KELENGKAPAN BERKAS */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CloudCheck className="h-3.5 w-3.5 text-emerald-700" />
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
              {activeParticipant.instansi} ({activeParticipant.kabupatenKota})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogoutToHome}
              className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span>Keluar / Ganti Akun</span>
            </button>
          </div>
        </div>

        {/* Indikator Kelengkapan Berkas */}
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
              <strong>Kelengkapan Dokumen SPJ: {completedCount}/3</strong> —{' '}
              {completedCount === 3
                ? 'Dokumen Lengkap & Tersinkronisasi ke Verifikator Panitia'
                : 'Silakan unggah foto Surat Tugas, SPPD/Visum, dan Tiket Transport/SPPR'}
            </span>
          </div>
          <span className="font-mono font-bold">
            Status: {activeParticipant.statusBerkas.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* 2. TOMBOL NAVIGASI 3 MENU PESERTA */}
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
          1. Absen &amp; Upload Dokumen
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
          3. Materi &amp; Galeri Kegiatan
        </button>
      </div>

      {/* =======================================================================
          MENU 1: ABSEN HARIAN, UPLOAD 3 DOKUMEN & BIODATA PESERTA
      ======================================================================== */}
      {activeSubTab === 'UTAMA' && (
        <div className="space-y-4">
          {/* A. Presensi Harian */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <MapPin className="h-4 w-4 text-blue-700" />
                <span>Presensi Kehadiran Harian ({config.lokasiKegiatan})</span>
              </div>
              <span className="font-mono text-xs font-semibold text-blue-700">
                Tercatat: {activeParticipant.attendance.length}/{config.jumlahHariKegiatan}{' '}
                Hari
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: config.jumlahHariKegiatan }, (_, idx) => {
                const dayNum = idx + 1;
                const record = activeParticipant.attendance.find(
                  (a) => a.dayIndex === dayNum
                );
                return record ? (
                  <div
                    key={dayNum}
                    className="flex min-h-[48px] flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-center"
                  >
                    <span className="text-xs font-bold text-emerald-900">
                      Hadir Hari ke-{dayNum} ✓
                    </span>
                    <span className="font-mono text-[10px] text-emerald-700">
                      Pukul {record.checkInTime}
                    </span>
                  </div>
                ) : (
                  <button
                    key={dayNum}
                    type="button"
                    onClick={async () => {
                      await onCheckIn(activeParticipant.id, dayNum);
                      triggerToast(`Presensi Hari ke-${dayNum} berhasil tercatat.`);
                    }}
                    className="min-h-[48px] rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors"
                  >
                    Klik Check-In Hari ke-{dayNum}
                  </button>
                );
              })}
            </div>
          </div>

          {/* B. Upload 3 Dokumen SPJ (Kamera HP / Pilih File Foto) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Unggah Foto Dokumen SPJ Peserta
                </h2>
                <p className="text-xs text-slate-500">
                  Ambil foto dokumen fisik menggunakan kamera HP atau pilih foto dari
                  galeri perangkat Anda.
                </p>
              </div>
              <span className="font-mono text-[11px] text-emerald-700 font-semibold">
                Kompresi Otomatis &lt;300 KB
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {[
                {
                  key: 'suratTugas' as const,
                  title: '1. Surat Tugas (SPT)',
                  subtitle: 'Surat Tugas resmi dari pimpinan instansi asal',
                  doc: activeParticipant.documents.suratTugas,
                },
                {
                  key: 'sppdVisum' as const,
                  title: '2. Lembar SPPD / Visum',
                  subtitle: 'SPPD yang telah ditandatangani & dicap basah',
                  doc: activeParticipant.documents.sppdVisum,
                },
                {
                  key: 'buktiTransport' as const,
                  title: '3. Bukti Tiket Transport',
                  subtitle: 'Tiket kapal/pesawat/travel/kuitansi resmi',
                  doc: activeParticipant.documents.buktiTransport,
                },
              ].map((slot) => (
                <div
                  key={slot.key}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5"
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
                        {slot.doc ? 'TERUNGGAH ✓' : 'BELUM ADA'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{slot.subtitle}</p>

                    {slot.key === 'buktiTransport' && (
                      <div className="mt-2.5">
                        <label className="block text-[10px] font-semibold text-slate-700">
                          Total Biaya Tiket PP sesuai Bukti (Rp):
                        </label>
                        <input
                          type="number"
                          placeholder="Contoh: 450000"
                          value={nominalTiketInput || ''}
                          onChange={(e) =>
                            setNominalTiketInput(Number(e.target.value) || 0)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-bold"
                        />
                      </div>
                    )}

                    {slot.doc && (
                      <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2">
                        <img
                          src={slot.doc.dataUrl}
                          alt={slot.title}
                          referrerPolicy="no-referrer"
                          className="h-11 w-11 rounded object-cover shrink-0 border border-slate-200"
                        />
                        <div className="min-w-0 text-[10px]">
                          <div className="truncate font-mono font-semibold text-slate-800">
                            {slot.doc.fileName}
                          </div>
                          <div className="font-mono text-emerald-700">
                            {slot.doc.compressedSizeKB} KB · {slot.doc.uploadedAt}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-1">
                    <label className="flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors">
                      <Camera className="h-4 w-4" />
                      <span>
                        {slot.doc ? 'Ganti Foto Dokumen' : 'Foto / Pilih File Dokumen'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleCameraFileChange(e, slot.key)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* C. Biodata & Rekening Peserta */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => setIsEditingBio(!isEditingBio)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Biodata &amp; Nomor Rekening Pencairan
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
                <span>{isEditingBio ? 'Tutup' : 'Perbarui Data'}</span>
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
                      NIP / NIK
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
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          MENU 2: SMART TRANSPORT / SURAT PERNYATAAN RIIL (SPPR)
      ======================================================================== */}
      {activeSubTab === 'SPPR_TRANSPORT' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                  <Ship className="h-4 w-4" />
                  <span>Surat Pernyataan Pengeluaran Riil (SPPR) Transport Lokal</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  Isi form ini jika Anda menggunakan transportasi lokal (ketinting,
                  speedboat sewaan, pompong, atau ojek) yang tidak memiliki tiket resmi.
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

            <form
              onSubmit={handleAddSpprItem}
              className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tempat Keberangkatan (Asal)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Desa Pulau Tiga"
                  value={ruteAsal}
                  onChange={(e) => setRuteAsal(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tempat Tujuan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pelabuhan Kota"
                  value={ruteTujuan}
                  onChange={(e) => setRuteTujuan(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Jenis Transportasi Lokal
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
                  <option value="Ojek / Angkutan Pedesaan (PP)">
                    Ojek / Angkutan Pedesaan (PP)
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Biaya Riil (Rp)
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
                  Keterangan / Alasan Tidak Ada Tiket Resmi
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
                    <span>Simpan Rute SPPR</span>
                  </button>
                </div>
              </div>
            </form>

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
          MENU 3: PUSAT MATERI & GALERI HARIAN
      ======================================================================== */}
      {activeSubTab === 'MATERI_GALERI' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">
              Materi Narasumber Kegiatan
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

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">
              Dokumentasi Foto Kegiatan
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

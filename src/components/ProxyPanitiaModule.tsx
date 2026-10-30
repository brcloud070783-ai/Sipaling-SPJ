import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  FolderKanban,
  LifeBuoy,
  ShieldAlert,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  ActivityConfig,
  GolonganType,
  InputMode,
  ParticipantRecord,
} from '../types/simkantor';
import { compressImageFile, createSimulatedDocSvg } from '../utils/spjCalculators';

interface ProxyPanitiaModuleProps {
  config: ActivityConfig;
  participants: ParticipantRecord[];
  onSaveBiodata: (payload: Partial<ParticipantRecord>) => Promise<string | undefined>;
  onCheckIn: (
    participantId: string,
    dayIndex: number,
    isProxy?: boolean,
    proxyOfficerName?: string
  ) => Promise<void>;
  onUploadDocument: (payload: {
    participantId: string;
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport';
    dataUrl: string;
    originalSizeKB: number;
    compressedSizeKB: number;
    uploadedBy: string;
    isProxy: boolean;
    auditNote?: string;
    nominalTransport?: number;
  }) => Promise<void>;
}

export const ProxyPanitiaModule: React.FC<ProxyPanitiaModuleProps> = ({
  config,
  participants,
  onSaveBiodata,
  onCheckIn,
  onUploadDocument,
}) => {
  const [selectedId, setSelectedId] = useState<string>(
    participants.find((p) => p.inputMode === InputMode.PROXY_PANITIA)?.id ||
      participants[0]?.id ||
      ''
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Audit Flag Parameters (Mandatory for Proxy Mode)
  const [proxyOfficerName, setProxyOfficerName] = useState(
    'Andi Saputra (Helpdesk Panitia)'
  );
  const [proxyReason, setProxyReason] = useState(
    'HP peserta rusak / baterai habis saat tiba di lokasi kegiatan'
  );
  const [nominalTransportProxy, setNominalTransportProxy] = useState<number>(1250000);

  // New Participant via Proxy Form
  const [nama, setNama] = useState('');
  const [nip, setNip] = useState('');
  const [pangkatGolongan, setPangkatGolongan] = useState<GolonganType>(
    GolonganType.GOL_III
  );
  const [instansi, setInstansi] = useState('');
  const [kabupatenKota, setKabupatenKota] = useState('');
  const [noHp, setNoHp] = useState('');
  const [namaBank, setNamaBank] = useState('BRI');
  const [noRekening, setNoRekening] = useState('');

  const [feedback, setFeedback] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const targetParticipant =
    participants.find((p) => p.id === selectedId) || participants[0];

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateProxyParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !proxyOfficerName.trim()) return;
    setIsBusy(true);
    try {
      const createdId = await onSaveBiodata({
        nama: nama.trim(),
        nip: nip.trim() || `19720911199803100${participants.length + 1}`,
        pangkatGolongan,
        jabatan: 'Peserta Utusan Daerah',
        instansi: instansi.trim() || 'SD Negeri 001 Kepulauan',
        kabupatenKota: kabupatenKota.trim() || 'Kab. Kepulauan Anambas',
        noHp: noHp.trim() || '081200009988',
        namaBank,
        noRekening: noRekening.trim() || '0184-01-011223-50-9',
        inputMode: InputMode.PROXY_PANITIA,
        proxyOfficerName,
        proxyReason,
      });
      if (createdId) {
        setSelectedId(createdId);
      }
      setIsCreatingNew(false);
      setNama('');
      setNip('');
      setInstansi('');
      setKabupatenKota('');
      notify(
        `Peserta ${nama} berhasil didaftarkan melalui Mode Proxy dengan Audit Flag resmi.`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleProxyFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !targetParticipant) return;
    setIsBusy(true);
    try {
      const compressed = await compressImageFile(file, 1400, 0.78);
      await onUploadDocument({
        participantId: targetParticipant.id,
        docType,
        dataUrl: compressed.dataUrl,
        originalSizeKB: compressed.originalSizeKB,
        compressedSizeKB: compressed.compressedSizeKB,
        uploadedBy: `${proxyOfficerName} [PROXY]`,
        isProxy: true,
        auditNote: `PROXY AUDIT FLAG: Diunggah oleh ${proxyOfficerName}. Alasan kendala peserta: ${proxyReason}`,
        nominalTransport:
          docType === 'buktiTransport' ? nominalTransportProxy : undefined,
      });
      notify(
        `Dokumen fisik ${targetParticipant.nama} berhasil difoto & diunggah ke Drive Panitia dengan tanda Audit Proxy.`
      );
    } finally {
      setIsBusy(false);
      e.target.value = '';
    }
  };

  const handleSimulateProxyCapture = async (
    docType: 'suratTugas' | 'sppdVisum' | 'buktiTransport'
  ) => {
    if (!targetParticipant) return;
    setIsBusy(true);
    try {
      const mapType = {
        suratTugas: 'SURAT_TUGAS' as const,
        sppdVisum: 'SPPD_VISUM' as const,
        buktiTransport: 'TIKET_TRANSPORT' as const,
      };
      const svgUrl = createSimulatedDocSvg({
        docType: mapType[docType],
        nama: targetParticipant.nama,
        nip: targetParticipant.nip,
        instansi: targetParticipant.instansi,
        nomorDokumen: `PROXY-DOC/${config.tahunAnggaran}/${targetParticipant.nip.slice(-4)}`,
        tanggal: new Date().toLocaleDateString('id-ID'),
        nominal:
          docType === 'buktiTransport'
            ? `Rp ${nominalTransportProxy.toLocaleString('id-ID')}`
            : undefined,
      });

      await onUploadDocument({
        participantId: targetParticipant.id,
        docType,
        dataUrl: svgUrl,
        originalSizeKB: 3890,
        compressedSizeKB: 242,
        uploadedBy: `${proxyOfficerName} [PROXY]`,
        isProxy: true,
        auditNote: `PROXY AUDIT FLAG: Difoto dari dokumen fisik oleh ${proxyOfficerName}. Kendala: ${proxyReason}`,
        nominalTransport:
          docType === 'buktiTransport' ? nominalTransportProxy : undefined,
      });
      notify(
        `Simulasi potret fisik via Meja Helpdesk Proxy berhasil disimpan untuk ${targetParticipant.nama}.`
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950">
          {feedback}
        </div>
      )}

      {/* Header Penjelasan Mode Proxy & Kepatuhan Audit */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
              <LifeBuoy className="h-4 w-4" />
              <span>MODUL B — SISI PANITIA &amp; HELPDESK (PROXY MODE)</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              Pendampingan Peserta Terkendala Perangkat (Audit-Flagged Proxy Input)
            </h1>
            <p className="mt-1 text-xs text-slate-600 max-w-3xl leading-relaxed">
              Digunakan oleh petugas meja registrasi untuk membantu peserta yang
              mengalami kendala teknis (gaptek, HP rusak, baterai habis, atau tidak
              membawa smartphone). Setiap tindakan menyematkan{' '}
              <span className="font-mono font-semibold text-slate-900">
                AUDIT_FLAG: PROXY_PANITIA
              </span>{' '}
              di database Google Sheets.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingNew(!isCreatingNew)}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>
              {isCreatingNew
                ? 'Tutup Form Peserta Baru'
                : 'Input Peserta Baru via Helpdesk Proxy'}
            </span>
          </button>
        </div>
      </div>

      {/* Form Input Peserta Baru via Proxy */}
      {isCreatingNew && (
        <form
          onSubmit={handleCreateProxyParticipant}
          className="rounded-xl border border-amber-300 bg-amber-50/40 p-5"
        >
          <div className="text-sm font-bold text-slate-900">
            Registrasi Peserta Baru oleh Petugas Helpdesk Panitia
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nama Lengkap Peserta
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Drs. Syamsul Bahri"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                NIP Peserta
              </label>
              <input
                type="text"
                placeholder="1968..."
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Golongan
              </label>
              <select
                value={pangkatGolongan}
                onChange={(e) => setPangkatGolongan(e.target.value as GolonganType)}
                className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              >
                {Object.values(GolonganType).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Asal Instansi / Sekolah
              </label>
              <input
                type="text"
                required
                placeholder="SDN 004 Pulau Laut"
                value={instansi}
                onChange={(e) => setInstansi(e.target.value)}
                className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Kabupaten / Kota
              </label>
              <input
                type="text"
                required
                placeholder="Kab. Natuna"
                value={kabupatenKota}
                onChange={(e) => setKabupatenKota(e.target.value)}
                className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Bank &amp; Nomor Rekening
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={namaBank}
                  onChange={(e) => setNamaBank(e.target.value)}
                  className="w-24 min-h-[42px] rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Nomor Rekening"
                  value={noRekening}
                  onChange={(e) => setNoRekening(e.target.value)}
                  className="flex-1 min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={isBusy}
              className="min-h-[42px] rounded-lg bg-amber-700 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Simpan Peserta Baru (Tandai Proxy Audit)
            </button>
          </div>
        </form>
      )}

      {/* Main Split Grid: Identitas Petugas Proxy & Upload Fisik */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Parameter Audit Petugas Panitia & Pilih Peserta */}
        <div className="space-y-5 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              <span>Identitas Petugas Helpdesk &amp; Alasan Bantuan (Wajib Audit)</span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Petugas Panitia yang Membantu
                </label>
                <input
                  type="text"
                  value={proxyOfficerName}
                  onChange={(e) => setProxyOfficerName(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Kategori Kendala Peserta (Audit Flag)
                </label>
                <select
                  value={proxyReason}
                  onChange={(e) => setProxyReason(e.target.value)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="HP peserta rusak / baterai habis saat tiba di lokasi kegiatan">
                    HP peserta rusak / baterai habis saat tiba di lokasi kegiatan
                  </option>
                  <option value="Peserta terkendala teknis penggunaan kamera web (Faktor Usia/Gaptek)">
                    Peserta terkendala teknis penggunaan kamera web (Faktor Usia/Gaptek)
                  </option>
                  <option value="Peserta tidak membawa smartphone / jaringan kartu seluler daerah terblokir">
                    Peserta tidak membawa smartphone / jaringan kartu seluler daerah
                    terblokir
                  </option>
                  <option value="Penyerahan berkas fisik langsung di meja registrasi panitia">
                    Penyerahan berkas fisik langsung di meja registrasi panitia
                  </option>
                </select>
              </div>

              <div className="border-t border-slate-200 pt-3.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Pilih Peserta yang Dibantu:
                </label>
                <select
                  value={targetParticipant?.id || ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900"
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} ({p.nip}) — [{p.inputMode}]
                    </option>
                  ))}
                </select>
              </div>

              {targetParticipant && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  <div className="font-bold text-slate-900">
                    {targetParticipant.nama}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-600">
                    NIP: {targetParticipant.nip} · {targetParticipant.instansi}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-blue-800">
                    <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      Folder Panitia: /{targetParticipant.driveFolderName}/
                    </span>
                  </div>

                  {/* Quick Proxy Attendance Check-In */}
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Presensi Manual Berbantuan Panitia:
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[1, 2, 3].map((dayNum) => {
                        const isPresent = targetParticipant.attendance.some(
                          (a) => a.dayIndex === dayNum
                        );
                        return (
                          <button
                            key={dayNum}
                            type="button"
                            disabled={isPresent || isBusy}
                            onClick={async () => {
                              await onCheckIn(
                                targetParticipant.id,
                                dayNum,
                                true,
                                proxyOfficerName
                              );
                              notify(
                                `Presensi Hari ke-${dayNum} untuk ${targetParticipant.nama} berhasil dicatat oleh ${proxyOfficerName}.`
                              );
                            }}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                              isPresent
                                ? 'bg-emerald-100 text-emerald-900 cursor-default'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                          >
                            {isPresent
                              ? `Hari ${dayNum}: Hadir`
                              : `+ Absenkan Hari ${dayNum}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Potret Berkas Fisik Peserta dari Perangkat Panitia */}
        <div className="lg:col-span-7">
          {targetParticipant && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-bold text-slate-900">
                Potret Dokumen Fisik Peserta ({targetParticipant.nama})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                File yang difoto dari perangkat panitia otomatis diberi prefix{' '}
                <code>PROXY_</code> dan masuk ke folder Google Drive peserta yang
                bersangkutan.
              </p>

              <div className="mt-4 space-y-4">
                {[
                  {
                    key: 'suratTugas' as const,
                    label: '1. Scan Fisik Surat Tugas (SPT)',
                    doc: targetParticipant.documents.suratTugas,
                  },
                  {
                    key: 'sppdVisum' as const,
                    label: '2. Scan Fisik SPPD & Cap Visum',
                    doc: targetParticipant.documents.sppdVisum,
                  },
                  {
                    key: 'buktiTransport' as const,
                    label: '3. Scan Fisik Tiket / Bukti Transport Resmi',
                    doc: targetParticipant.documents.buktiTransport,
                  },
                ].map((slot) => (
                  <div
                    key={slot.key}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        {slot.label}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-slate-600">
                        {slot.doc ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Tersimpan ({slot.doc.compressedSizeKB} KB)
                          </span>
                        ) : (
                          'Belum Diunggah'
                        )}
                      </span>
                    </div>

                    {slot.key === 'buktiTransport' && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-xs text-slate-600">
                          Nominal Tiket Fisik (Rp):
                        </span>
                        <input
                          type="number"
                          value={nominalTransportProxy}
                          onChange={(e) =>
                            setNominalTransportProxy(Number(e.target.value) || 0)
                          }
                          className="w-40 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs font-bold"
                        />
                      </div>
                    )}

                    {slot.doc?.auditNote && (
                      <div className="mt-2 text-[11px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                        {slot.doc.auditNote}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors">
                        <Camera className="h-4 w-4" />
                        <span>Kamera Helpdesk Panitia</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleProxyFileUpload(e, slot.key)}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleSimulateProxyCapture(slot.key)}
                        className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>Simulasi Potret Berkas Fisik (Proxy)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

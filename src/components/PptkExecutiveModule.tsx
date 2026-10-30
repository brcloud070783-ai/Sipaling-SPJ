import React, { useState } from 'react';
import {
  BarChart3,
  BookCheck,
  Code2,
  FolderTree,
  Printer,
  RotateCcw,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  ActivityConfig,
  AuditLogEntry,
  DocumentationPhoto,
  DocumentStatus,
  InputMode,
  ParticipantRecord,
  SpeakerRecord,
} from '../types/simkantor';
import {
  generateMasterLaporanPptkDocument,
  PrintableDocumentPayload,
} from '../utils/pdfGenerator';
import { formatRupiah, terbilangRupiah } from '../utils/spjCalculators';

interface PptkExecutiveModuleProps {
  config: ActivityConfig;
  participants: ParticipantRecord[];
  speakers: SpeakerRecord[];
  photos: DocumentationPhoto[];
  auditLogs: AuditLogEntry[];
  onUpdateConfig: (newConfig: Partial<ActivityConfig>) => Promise<void>;
  onResetOfficialMode: () => Promise<void>;
  onRestoreDemoData: () => Promise<void>;
  onOpenDocumentPreview: (doc: PrintableDocumentPayload) => void;
  onOpenBlueprint: () => void;
}

export const PptkExecutiveModule: React.FC<PptkExecutiveModuleProps> = ({
  config,
  participants,
  speakers,
  photos,
  auditLogs,
  onUpdateConfig,
  onResetOfficialMode,
  onRestoreDemoData,
  onOpenDocumentPreview,
  onOpenBlueprint,
}) => {
  const [showSbmEditor, setShowSbmEditor] = useState(false);
  const [confirmClearData, setConfirmClearData] = useState(false);

  const [instansiPenyelenggara, setInstansiPenyelenggara] = useState(
    config.instansiPenyelenggara
  );
  const [namaKegiatan, setNamaKegiatan] = useState(config.namaKegiatan);
  const [lokasiKegiatan, setLokasiKegiatan] = useState(config.lokasiKegiatan);
  const [tanggalMulai, setTanggalMulai] = useState(config.tanggalMulai);
  const [tanggalSelesai, setTanggalSelesai] = useState(config.tanggalSelesai);
  const [jumlahHariKegiatan, setJumlahHariKegiatan] = useState(
    config.jumlahHariKegiatan
  );
  const [nomorDpa, setNomorDpa] = useState(config.nomorDpa);
  const [tarifSbm, setTarifSbm] = useState(config.tarifUangHarianSbm);
  const [plafonTransport, setPlafonTransport] = useState(config.plafonTransportLokal);
  const [namaPptk, setNamaPptk] = useState(config.namaPptk);
  const [nipPptk, setNipPptk] = useState(config.nipPptk);
  const [namaBendahara, setNamaBendahara] = useState(config.namaBendahara);
  const [nipBendahara, setNipBendahara] = useState(config.nipBendahara);
  const [toast, setToast] = useState<string | null>(null);

  // Perhitungan Real-Time Serapan Anggaran DPA
  const realisasiUangHarian = participants.reduce(
    (sum, p) => sum + p.verification.totalUangHarian,
    0
  );
  const realisasiTransport = participants.reduce(
    (sum, p) => sum + p.verification.transportDisetujui,
    0
  );
  const realisasiHonor = speakers.reduce((sum, s) => sum + s.bruto, 0);
  const realisasiTotal =
    realisasiUangHarian +
    realisasiTransport +
    realisasiHonor +
    config.realisasiKonsumsiOperasional;

  const persentaseTotal = Math.min(
    100,
    Number(((realisasiTotal / config.paguDpaTotal) * 100).toFixed(1))
  );

  // Perhitungan Barometer Kehadiran & Status Berkas
  const totalPeserta = participants.length;
  const verifiedCount = participants.filter(
    (p) => p.statusBerkas === DocumentStatus.TERVERIFIKASI
  ).length;
  const proxyCount = participants.filter(
    (p) => p.inputMode === InputMode.PROXY_PANITIA
  ).length;
  const spprCount = participants.filter(
    (p) => Boolean(p.documents.spprGenerated)
  ).length;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateConfig({
      instansiPenyelenggara,
      namaKegiatan,
      lokasiKegiatan,
      tanggalMulai,
      tanggalSelesai,
      jumlahHariKegiatan: Number(jumlahHariKegiatan) || 3,
      nomorDpa,
      tarifUangHarianSbm: Number(tarifSbm),
      plafonTransportLokal: Number(plafonTransport),
      namaPptk,
      nipPptk,
      namaBendahara,
      nipBendahara,
    });
    setShowSbmEditor(false);
    setToast('Pengaturan Kegiatan Resmi & Standar Biaya Masukan (SBM) berhasil disimpan.');
    setTimeout(() => setToast(null), 4000);
  };

  const handleConfirmResetOfficial = async () => {
    await onResetOfficialMode();
    setConfirmClearData(false);
    setToast(
      'Data contoh berhasil dibersihkan! Sistem kini mulai dari 0 peserta dan siap digunakan untuk kegiatan resmi.'
    );
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-950">
          {toast}
        </div>
      )}

      {/* Header Executive Dashboard & Pengaturan Kegiatan Resmi */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
              <BarChart3 className="h-4 w-4" />
              <span>PANEL PPTK &amp; PENGATURAN KEGIATAN RESMI</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              Monitoring Kehadiran, Serapan Anggaran DPA &amp; Pengaturan Kegiatan
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              DIPA/DPA: <span className="font-mono font-semibold">{config.nomorDpa}</span>{' '}
              · PPTK: {config.namaPptk} · Lokasi: {config.lokasiKegiatan}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSbmEditor(!showSbmEditor)}
              className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="h-4 w-4" />
              <span>Pengaturan Kegiatan &amp; SBM</span>
            </button>

            <button
              type="button"
              onClick={onOpenBlueprint}
              className="flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Code2 className="h-4 w-4 text-blue-700" />
              <span>Integrasi Google Drive &amp; Sheets</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenDocumentPreview(
                  generateMasterLaporanPptkDocument(
                    config,
                    participants,
                    speakers,
                    photos,
                    auditLogs
                  )
                )
              }
              className="flex min-h-[42px] items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Master Laporan Akhir (PDF)</span>
            </button>
          </div>
        </div>

        {/* Bar Persiapan Kegiatan Resmi (Kosongkan Data Contoh vs Pulihkan Contoh) */}
        <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:flex-row sm:items-center">
          <div className="text-xs text-slate-700">
            <strong>Status Data Peserta Saat Ini: {participants.length} Peserta.</strong>{' '}
            <span>
              Untuk memulai kegiatan resmi baru, Anda dapat menghapus 3 data peserta contoh
              bawaan agar daftar peserta mulai dari 0 (kosong).
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {participants.length > 0 ? (
              !confirmClearData ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearData(true)}
                  className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Kosongkan Data Contoh (Siap Kegiatan Resmi)</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmResetOfficial}
                    className="min-h-[38px] rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                  >
                    Ya, Kosongkan Sekarang
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearData(false)}
                    className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await onRestoreDemoData();
                  setToast('Data contoh berhasil ditampilkan kembali.');
                  setTimeout(() => setToast(null), 3500);
                }}
                className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Tampilkan Kembali Data Contoh</span>
              </button>
            )}
          </div>
        </div>

        {/* Panel Editor Parameter Kegiatan Resmi & SBM */}
        {showSbmEditor && (
          <form
            onSubmit={handleSaveConfig}
            className="mt-5 border-t border-slate-200 pt-4 space-y-4"
          >
            <div className="text-xs font-bold text-slate-900">
              Pengaturan Identitas Kegiatan Resmi, Pejabat Penandatangan &amp; Tarif SBM
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Instansi Penyelenggara
                </label>
                <input
                  type="text"
                  required
                  value={instansiPenyelenggara}
                  onChange={(e) => setInstansiPenyelenggara(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Kegiatan Kedinasan Resmi
                </label>
                <input
                  type="text"
                  required
                  value={namaKegiatan}
                  onChange={(e) => setNamaKegiatan(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tempat / Lokasi Kegiatan
                </label>
                <input
                  type="text"
                  required
                  value={lokasiKegiatan}
                  onChange={(e) => setLokasiKegiatan(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tanggal Mulai &amp; Selesai
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="date"
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-300 px-2 py-2 font-mono text-xs"
                  />
                  <input
                    type="date"
                    value={tanggalSelesai}
                    onChange={(e) => setTanggalSelesai(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-300 px-2 py-2 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Jumlah Hari Kegiatan
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={jumlahHariKegiatan}
                  onChange={(e) => setJumlahHariKegiatan(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nomor DIPA / DPA
                </label>
                <input
                  type="text"
                  value={nomorDpa}
                  onChange={(e) => setNomorDpa(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Tarif Uang Harian SBM per Hari (Rp)
                </label>
                <input
                  type="number"
                  step={10000}
                  value={tarifSbm}
                  onChange={(e) => setTarifSbm(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Plafon Acuan Transport Lokal (Rp)
                </label>
                <input
                  type="number"
                  step={25000}
                  value={plafonTransport}
                  onChange={(e) => setPlafonTransport(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nama &amp; NIP PPTK
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Nama PPTK"
                    value={namaPptk}
                    onChange={(e) => setNamaPptk(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="NIP PPTK"
                    value={nipPptk}
                    onChange={(e) => setNipPptk(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Nama &amp; NIP Bendahara Pengeluaran
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="Nama Bendahara"
                    value={namaBendahara}
                    onChange={(e) => setNamaBendahara(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="NIP Bendahara"
                    value={nipBendahara}
                    onChange={(e) => setNipBendahara(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSbmEditor(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700"
              >
                Tutup
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Simpan Pengaturan Kegiatan Resmi
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500">
            Pagu Anggaran DPA Kegiatan
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
            {formatRupiah(config.paguDpaTotal)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            MAK: <span className="font-mono">{config.kodeMak}</span> · TA{' '}
            {config.tahunAnggaran}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500">
            Realisasi Penyerapan SPJ
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-blue-700">
            {formatRupiah(realisasiTotal)}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Serapan: <strong className="font-mono">{persentaseTotal}%</strong> · Sisa:{' '}
            <span className="font-mono">
              {formatRupiah(config.paguDpaTotal - realisasiTotal)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500">
            Barometer Berkas Terverifikasi
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-700">
            {verifiedCount} / {totalPeserta} Peserta
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Pengguna SPPR: <strong className="font-mono">{spprCount}</strong> · Input
            Proxy: <strong className="font-mono">{proxyCount}</strong>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500">
            Narasumber &amp; Dokumentasi
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
            {speakers.length} Narsum · {photos.length} Foto
          </div>
          <div className="mt-1 text-xs text-slate-600">
            Seluruhnya terarsip di Google Drive Panitia
          </div>
        </div>
      </div>

      {/* Main Split: Budget Absorption Table & Attendance Barometer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pemantauan Anggaran (Pagu DPA vs Realisasi Penyerapan)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Terbilang Realisasi: # {terbilangRupiah(realisasiTotal)} #
              </p>
            </div>
            <BookCheck className="h-5 w-5 text-blue-700" />
          </div>

          <div className="mt-4 space-y-4">
            {[
              {
                label: '1. Belanja Uang Harian Peserta Kegiatan',
                pagu: config.paguUangHarian,
                realisasi: realisasiUangHarian,
                detail: `${participants.length} Peserta × Tarif SBM ${formatRupiah(
                  config.tarifUangHarianSbm
                )}/hari`,
              },
              {
                label: '2. Belanja Transportasi Peserta (Tiket Resmi & SPPR)',
                pagu: config.paguTransportPeserta,
                realisasi: realisasiTransport,
                detail: `${participants.length - spprCount} Tiket Resmi · ${spprCount} Dokumen SPPR Lokal`,
              },
              {
                label: '3. Belanja Honorarium Narasumber, Moderator, MC & Doa',
                pagu: config.paguHonorNarasumber,
                realisasi: realisasiHonor,
                detail: `${speakers.length} Narasumber/Petugas (Termasuk Potongan PPh Pasal 21)`,
              },
              {
                label: '4. Belanja Paket Meeting, Konsumsi & Operasional Panitia',
                pagu: config.paguKonsumsiOperasional,
                realisasi: config.realisasiKonsumsiOperasional,
                detail: 'Akomodasi Ballroom, Konsumsi Harian & ATK Kegiatan',
              },
            ].map((pos) => {
              const pct = Math.min(
                100,
                Number(((pos.realisasi / pos.pagu) * 100).toFixed(1))
              );
              return (
                <div
                  key={pos.label}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-900">{pos.label}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatRupiah(pos.realisasi)}{' '}
                      <span className="font-normal text-slate-500">
                        / {formatRupiah(pos.pagu)} ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">{pos.detail}</div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-blue-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-5">
          {/* Barometer Kehadiran Peserta Real-Time */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Barometer Kehadiran Peserta Real-Time
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Rekapitulasi check-in harian peserta per hari pelaksanaan
                </p>
              </div>
              <Users className="h-5 w-5 text-emerald-700" />
            </div>

            <div className="mt-4 space-y-3">
              {Array.from({ length: config.jumlahHariKegiatan }, (_, idx) => {
                const dayNum = idx + 1;
                const count = participants.filter((p) =>
                  p.attendance.some((a) => a.dayIndex === dayNum)
                ).length;
                const pct =
                  totalPeserta > 0 ? Math.round((count / totalPeserta) * 100) : 0;
                return (
                  <div key={dayNum} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        Hari ke-{dayNum} Pelaksanaan Kegiatan
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {count}/{totalPeserta} Peserta Hadir ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Struktur Terpusat Google Drive Panitia */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <FolderTree className="h-4 w-4 text-blue-700" />
              <span>Struktur Folder Terpusat Google Drive Panitia</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Seluruh dokumen tersimpan di bawah akun resmi panitia, bukan di Drive
              pribadi peserta.
            </p>
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 space-y-1.5">
              <div className="text-blue-400 font-bold">
                /Panitia_SIM_KANTOR_{config.tahunAnggaran}/
              </div>
              {participants.length === 0 ? (
                <div className="pl-3 text-slate-400">
                  └── (Siap menerima folder peserta baru saat peserta mengunggah berkas)
                </div>
              ) : (
                participants.map((p) => (
                  <div key={p.id} className="pl-3">
                    <div className="text-emerald-400">
                      ├── /{p.driveFolderName}/
                    </div>
                    <div className="pl-5 text-slate-400">
                      {p.documents.suratTugas && (
                        <div>│   ├── {p.documents.suratTugas.fileName}</div>
                      )}
                      {p.documents.sppdVisum && (
                        <div>│   ├── {p.documents.sppdVisum.fileName}</div>
                      )}
                      {p.documents.buktiTransport && (
                        <div>│   ├── {p.documents.buktiTransport.fileName}</div>
                      )}
                      {p.documents.spprGenerated && (
                        <div>│   └── {p.documents.spprGenerated.nomorSppr}.pdf</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Jejak Audit BPK / Inspektorat */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              <span>JEJAK AUDIT BPK / INSPEKTORAT</span>
            </div>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">
              Log Aktivitas Sistem (Peserta Mandiri, Proxy Panitia &amp; Verifikator)
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">
            Total Log: {auditLogs.length} Entri
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-2.5 px-3 font-semibold">Waktu Server</th>
                <th className="py-2.5 px-3 font-semibold">Aktor &amp; Peran</th>
                <th className="py-2.5 px-3 font-semibold">Tindakan / Event</th>
                <th className="py-2.5 px-3 font-semibold">Target Peserta / Berkas</th>
                <th className="py-2.5 px-3 font-semibold">Rincian Jejak Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {auditLogs.map((log) => (
                <tr
                  key={log.id}
                  className={log.isFlaggedProxy ? 'bg-amber-50/40' : 'hover:bg-slate-50'}
                >
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{log.actorName}</div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {log.actorRole}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-800">
                    {log.actionType}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    {log.targetName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

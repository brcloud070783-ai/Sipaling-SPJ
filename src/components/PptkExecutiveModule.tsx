import React, { useState } from 'react';
import {
  BarChart3,
  BookCheck,
  FolderTree,
  Printer,
  Settings,
  ShieldCheck,
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
  onOpenDocumentPreview: (doc: PrintableDocumentPayload) => void;
}

export const PptkExecutiveModule: React.FC<PptkExecutiveModuleProps> = ({
  config,
  participants,
  speakers,
  photos,
  auditLogs,
  onUpdateConfig,
  onOpenDocumentPreview,
}) => {
  const [showSbmEditor, setShowSbmEditor] = useState(false);
  const [namaKegiatan, setNamaKegiatan] = useState(config.namaKegiatan);
  const [nomorDpa, setNomorDpa] = useState(config.nomorDpa);
  const [tarifSbm, setTarifSbm] = useState(config.tarifUangHarianSbm);
  const [plafonTransport, setPlafonTransport] = useState(config.plafonTransportLokal);
  const [namaPptk, setNamaPptk] = useState(config.namaPptk);
  const [namaBendahara, setNamaBendahara] = useState(config.namaBendahara);
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
      namaKegiatan,
      nomorDpa,
      tarifUangHarianSbm: Number(tarifSbm),
      plafonTransportLokal: Number(plafonTransport),
      namaPptk,
      namaBendahara,
    });
    setShowSbmEditor(false);
    setToast(
      'Parameter Kegiatan & Standar Biaya Masukan (SBM) berhasil diperbarui secara global.'
    );
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-950">
          {toast}
        </div>
      )}

      {/* Header Executive Dashboard & Generator Master Laporan Akhir PDF */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
              <BarChart3 className="h-4 w-4" />
              <span>MODUL E — PPTK / EXECUTIVE DASHBOARD &amp; MASTER REPORT</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              Monitoring Eksekutif Kehadiran, Serapan Anggaran DPA &amp; Audit BPK
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              DIPA/DPA: <span className="font-mono font-semibold">{config.nomorDpa}</span>{' '}
              · PPTK: {config.namaPptk} · Lokasi: {config.lokasiKegiatan}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSbmEditor(!showSbmEditor)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="h-4 w-4" />
              <span>Pengaturan Tarif SBM &amp; DPA</span>
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
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-600 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Master Laporan Akhir Kegiatan (PDF Siap Jilid)</span>
            </button>
          </div>
        </div>

        {/* Panel Editor Parameter SBM & Kegiatan */}
        {showSbmEditor && (
          <form
            onSubmit={handleSaveConfig}
            className="mt-5 border-t border-slate-200 pt-4"
          >
            <div className="text-xs font-bold text-slate-900">
              Konfigurasi Dinamis Standar Biaya Masukan (PMK SBM) &amp; Pejabat Penandatangan
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Nama Kegiatan Kedinasan
                </label>
                <input
                  type="text"
                  value={namaKegiatan}
                  onChange={(e) => setNamaKegiatan(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
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
                  Nama Pejabat PPTK
                </label>
                <input
                  type="text"
                  value={namaPptk}
                  onChange={(e) => setNamaPptk(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSbmEditor(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Terapkan Perubahan SBM
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
        {/* Left: Budget Tracking (Pagu DPA vs Realisasi Penyerapan) */}
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

        {/* Right: Barometer Kehadiran Harian & Struktur Folder Google Drive Panitia */}
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
              {[1, 2, 3].map((dayNum) => {
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
              <span>Struktur Folder Terpusat Google Drive Panitia (Service Account)</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Seluruh dokumen tersimpan di bawah akun resmi panitia, bukan di Drive
              pribadi peserta.
            </p>
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 space-y-1.5">
              <div className="text-blue-400 font-bold">
                /Panitia_SIM_KANTOR_{config.tahunAnggaran}/
              </div>
              {participants.map((p) => (
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
              ))}
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
              <span>100% AUDIT-READY BPK / INSPEKTORAT</span>
            </div>
            <h2 className="mt-0.5 text-base font-bold text-slate-900">
              Log Jejak Audit Aktivitas Sistem (Mandiri, Proxy Panitia &amp; Verifikator)
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

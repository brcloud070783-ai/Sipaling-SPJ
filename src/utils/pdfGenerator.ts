import {
  ActivityConfig,
  AuditLogEntry,
  DocumentationPhoto,
  ParticipantRecord,
  SpeakerRecord,
} from '../types/simkantor';
import { formatRupiah, terbilangRupiah } from './spjCalculators';

export interface PrintableDocumentPayload {
  title: string;
  subtitle: string;
  docCode: string;
  htmlContent: string;
}

function buildKopSuratHtml(config: ActivityConfig): string {
  return `
    <div style="border-bottom: 3px double #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
      <div style="width: 68px; height: 68px; border: 2px solid #0f172a; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; color: #0f172a; background: #f8fafc;">
        RI
      </div>
      <div style="flex: 1; text-align: center; padding: 0 16px;">
        <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #334155;">
          ${config.instansiPenyelenggara}
        </div>
        <div style="font-size: 17px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-top: 2px;">
          ${config.satuanKerja}
        </div>
        <div style="font-size: 11px; color: #475569; margin-top: 4px;">
          Kegiatan: ${config.namaKegiatan} · Tahun Anggaran ${config.tahunAnggaran} · DIPA/DPA: ${config.nomorDpa}
        </div>
      </div>
      <div style="text-align: right; font-family: monospace; font-size: 10px; color: #475569; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 4px;">
        <div><strong>ARSIP BPK-READY</strong></div>
        <div>MAK: ${config.kodeMak}</div>
        <div>TA: ${config.tahunAnggaran}</div>
      </div>
    </div>
  `;
}

function buildSignatureBlockHtml(config: ActivityConfig, rightLabel?: { role: string; name: string; nip: string }): string {
  const right = rightLabel || {
    role: 'Bendahara Pengeluaran',
    name: config.namaBendahara,
    nip: config.nipBendahara,
  };
  return `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 28px; page-break-inside: avoid; font-size: 12px;">
      <div>
        <div>Mengetahui / Menyetujui,</div>
        <div style="font-weight: 700; margin-top: 2px;">Pejabat Pembuat Komitmen (PPK) / PPTK</div>
        <div style="height: 64px;"></div>
        <div style="font-weight: 700; text-decoration: underline;">${config.namaPptk}</div>
        <div style="font-family: monospace; font-size: 11px;">NIP. ${config.nipPptk}</div>
      </div>
      <div style="text-align: left; padding-left: 25%;">
        <div>${config.lokasiKegiatan.split(',')[0] || 'Jakarta'}, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div style="font-weight: 700; margin-top: 2px;">${right.role}</div>
        <div style="height: 64px;"></div>
        <div style="font-weight: 700; text-decoration: underline;">${right.name}</div>
        <div style="font-family: monospace; font-size: 11px;">${right.nip ? `NIP. ${right.nip}` : ''}</div>
      </div>
    </div>
  `;
}

/**
 * 1. Generator PDF Surat Pernyataan Pengeluaran Riil (SPPR) - Smart Transport
 */
export function generateSpprDocument(
  participant: ParticipantRecord,
  config: ActivityConfig
): PrintableDocumentPayload {
  const totalSppr = participant.spprItems.reduce((acc, item) => acc + item.nominal, 0);
  const nomorSppr =
    participant.documents.spprGenerated?.nomorSppr ||
    `SPPR/${config.tahunAnggaran}/${participant.id.toUpperCase()}`;

  const rowsHtml =
    participant.spprItems.length > 0
      ? participant.spprItems
          .map(
            (item, idx) => `
          <tr>
            <td style="border: 1px solid #0f172a; padding: 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #0f172a; padding: 8px;">
              <div><strong>${item.modaTransport}</strong> (${item.ruteAsal} &rarr; ${item.ruteTujuan})</div>
              <div style="font-size: 11px; color: #334155; margin-top: 2px;">Tanggal: ${item.tanggal} · Alasan non-tiket: ${item.alasanTanpaTiket}</div>
            </td>
            <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-family: monospace; font-weight: 700;">
              ${formatRupiah(item.nominal)}
            </td>
          </tr>
        `
          )
          .join('')
      : `<tr><td colspan="3" style="border: 1px solid #0f172a; padding: 12px; text-align: center;">Belum ada rincian transport riil.</td></tr>`;

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 16px; font-weight: 800; text-decoration: underline; text-transform: uppercase;">
        DAFTAR PENGELUARAN RIIL / SURAT PERNYATAAN PENGELUARAN RIIL (SPPR)
      </div>
      <div style="font-size: 12px; font-family: monospace; margin-top: 4px;">Nomor: ${nomorSppr}</div>
    </div>

    <div style="font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
      Yang bertanda tangan di bawah ini:
      <table style="width: 100%; margin-top: 8px; margin-bottom: 12px; font-size: 13px;">
        <tr><td style="width: 190px; padding: 3px 0;">Nama Lengkap</td><td>: <strong>${participant.nama}</strong></td></tr>
        <tr><td style="padding: 3px 0;">NIP</td><td style="font-family: monospace;">: ${participant.nip}</td></tr>
        <tr><td style="padding: 3px 0;">Pangkat / Golongan</td><td>: ${participant.pangkatGolongan} · ${participant.jabatan}</td></tr>
        <tr><td style="padding: 3px 0;">Unit Kerja / Instansi Asal</td><td>: ${participant.instansi} (${participant.kabupatenKota})</td></tr>
      </table>
      Berdasarkan Surat Perjalanan Dinas (SPPD) dalam rangka kegiatan <strong>${config.namaKegiatan}</strong> di ${config.lokasiKegiatan}, dengan ini kami menyatakan dengan sesungguhnya bahwa:
      <ol style="margin: 8px 0 12px 20px;">
        <li>Biaya transpor lokal/daerah di bawah ini yang tidak dapat diperoleh bukti-bukti pengeluarannya/tiket resmi bercap karena menggunakan moda transportasi rakyat/non-resmi (ketinting/speedboat sewaan/ojek lokal), meliputi:</li>
      </ol>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #0f172a; padding: 8px; width: 45px;">No</th>
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: left;">Uraian Rute, Moda Transportasi &amp; Alasan Tanpa Bukti Tiket Resmi</th>
          <th style="border: 1px solid #0f172a; padding: 8px; width: 170px; text-align: right;">Jumlah (Rp)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc;">
          <td colspan="2" style="border: 1px solid #0f172a; padding: 8px; font-weight: 700; text-align: right;">TOTAL PENGELUARAN TRANSPORT RIIL</td>
          <td style="border: 1px solid #0f172a; padding: 8px; font-weight: 800; font-family: monospace; text-align: right;">${formatRupiah(totalSppr)}</td>
        </tr>
        <tr>
          <td colspan="3" style="border: 1px solid #0f172a; padding: 8px; font-style: italic; background: #fffbeb;">
            <strong>Terbilang:</strong> # ${terbilangRupiah(totalSppr)} #
          </td>
        </tr>
      </tfoot>
    </table>

    <div style="font-size: 12px; line-height: 1.5; margin-bottom: 16px;">
      2. Jumlah uang tersebut pada angka 1 di atas benar-benar dikeluarkan untuk pelaksanaan perjalanan dinas dimaksud dan apabila di kemudian hari terdapat kelebihan atas pembayaran, kami bersedia untuk menyetorkan kelebihan tersebut ke Kas Negara/Daerah.
    </div>

    ${buildSignatureBlockHtml(config, {
      role: 'Pelaksana SPD / Peserta Kegiatan',
      name: participant.nama,
      nip: participant.nip,
    })}
  `;

  return {
    title: `SPPR Transport Riil — ${participant.nama}`,
    subtitle: `Nomor Dokumen: ${nomorSppr} · Total: ${formatRupiah(totalSppr)}`,
    docCode: nomorSppr,
    htmlContent,
  };
}

/**
 * 2. Generator Kuitansi Pembayaran Resmi (dilengkapi fungsi Terbilang Otomatis)
 */
export function generateKuitansiPesertaDocument(
  participant: ParticipantRecord,
  config: ActivityConfig
): PrintableDocumentPayload {
  const v = participant.verification;
  const totalNominal = v.totalDiterima;
  const kalimatTerbilang = terbilangRupiah(totalNominal);

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; font-size: 12px; font-family: monospace;">
      <div>
        <div>Tahun Anggaran : ${config.tahunAnggaran}</div>
        <div>Nomor Bukti/Kuitansi : <strong>${v.noKuitansi}</strong></div>
        <div>Mata Anggaran (MAK) : ${config.kodeMak}</div>
      </div>
      <div style="border: 1px solid #0f172a; padding: 6px 12px; font-weight: 700; background: #f8fafc;">
        LEMBAR I / ARSIP BENDAHARA &amp; BPK
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 18px;">
      <div style="font-size: 18px; font-weight: 800; letter-spacing: 0.08em; text-decoration: underline;">
        KUITANSI / BUKTI PEMBAYARAN
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px;">
      <tr>
        <td style="width: 190px; padding: 8px 4px; vertical-align: top; font-weight: 600;">Sudah Terima Dari</td>
        <td style="width: 15px; padding: 8px 0; vertical-align: top;">:</td>
        <td style="padding: 8px 4px;">Kuasa Pengguna Anggaran / Pejabat Pembuat Komitmen <strong>${config.satuanKerja}</strong></td>
      </tr>
      <tr>
        <td style="padding: 8px 4px; vertical-align: top; font-weight: 600;">Jumlah Uang</td>
        <td style="padding: 8px 0; vertical-align: top;">:</td>
        <td style="padding: 8px 12px; font-family: monospace; font-size: 16px; font-weight: 800; background: #f1f5f9; border: 1px solid #0f172a;">
          ${formatRupiah(totalNominal)}
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 4px; vertical-align: top; font-weight: 600;">Terbilang Otomatis</td>
        <td style="padding: 8px 0; vertical-align: top;">:</td>
        <td style="padding: 8px 12px; font-style: italic; font-weight: 700; background: #eff6ff; border: 1px dashed #1d4ed8; color: #1e3a8a;">
          # ${kalimatTerbilang} #
        </td>
      </tr>
      <tr>
        <td style="padding: 8px 4px; vertical-align: top; font-weight: 600;">Untuk Pembayaran</td>
        <td style="padding: 8px 0; vertical-align: top;">:</td>
        <td style="padding: 8px 4px; line-height: 1.5;">
          Biaya Perjalanan Dinas (Uang Harian &amp; Transportasi) Peserta Kegiatan <strong>${config.namaKegiatan}</strong> atas nama <strong>${participant.nama}</strong> (${participant.instansi}) pada tanggal ${config.tanggalMulai} s.d. ${config.tanggalSelesai} bertempat di ${config.lokasiKegiatan}.
        </td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: left;">Komponen Perhitungan SPJ</th>
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: left;">Rincian Perhitungan (SBM &amp; Bukti Riil)</th>
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: right;">Subtotal (Rp)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border: 1px solid #0f172a; padding: 8px;">1. Uang Harian Peserta</td>
          <td style="border: 1px solid #0f172a; padding: 8px; font-family: monospace;">${v.hariDisetujui} Hari Hadir &times; ${formatRupiah(v.tarifUangHarian)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-family: monospace; font-weight: 700;">${formatRupiah(v.totalUangHarian)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #0f172a; padding: 8px;">2. Biaya Transportasi (${v.gunakanSppr ? 'SPPR Transport Lokal' : 'Tiket Resmi / Riil'})</td>
          <td style="border: 1px solid #0f172a; padding: 8px;">Asal: ${participant.kabupatenKota} (Rekening: ${participant.namaBank} - ${participant.noRekening})</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-family: monospace; font-weight: 700;">${formatRupiah(v.transportDisetujui)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc;">
          <td colspan="2" style="border: 1px solid #0f172a; padding: 8px; font-weight: 800; text-align: right;">JUMLAH BERSIH DITERIMA PESERTA</td>
          <td style="border: 1px solid #0f172a; padding: 8px; font-weight: 800; font-family: monospace; text-align: right; font-size: 14px;">${formatRupiah(totalNominal)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 28px; font-size: 12px; page-break-inside: avoid;">
      <div>
        <div>Setuju Dibebankan pada DIPA/DPA,</div>
        <div style="font-weight: 700;">PPTK / PPK Kegiatan</div>
        <div style="height: 60px;"></div>
        <div style="font-weight: 700; text-decoration: underline;">${config.namaPptk}</div>
        <div style="font-family: monospace; font-size: 11px;">NIP. ${config.nipPptk}</div>
      </div>
      <div>
        <div>Lunas Dibayar,</div>
        <div style="font-weight: 700;">Bendahara Pengeluaran</div>
        <div style="height: 60px;"></div>
        <div style="font-weight: 700; text-decoration: underline;">${config.namaBendahara}</div>
        <div style="font-family: monospace; font-size: 11px;">NIP. ${config.nipBendahara}</div>
      </div>
      <div>
        <div>${config.lokasiKegiatan.split(',')[0] || 'Jakarta'}, ${new Date().toLocaleDateString('id-ID')}</div>
        <div style="font-weight: 700;">Yang Menerima,</div>
        <div style="height: 60px;"></div>
        <div style="font-weight: 700; text-decoration: underline;">${participant.nama}</div>
        <div style="font-family: monospace; font-size: 11px;">NIP. ${participant.nip}</div>
      </div>
    </div>
  `;

  return {
    title: `Kuitansi SPJ — ${participant.nama}`,
    subtitle: `${v.noKuitansi} · ${formatRupiah(totalNominal)} (${kalimatTerbilang})`,
    docCode: v.noKuitansi,
    htmlContent,
  };
}

/**
 * 3. Generator Rekap Uang Harian Nominatif
 */
export function generateRekapUangHarianNominatif(
  participants: ParticipantRecord[],
  config: ActivityConfig
): PrintableDocumentPayload {
  const grandTotalUangHarian = participants.reduce(
    (sum, p) => sum + p.verification.totalUangHarian,
    0
  );

  const rowsHtml = participants
    .map(
      (p, idx) => `
      <tr>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #0f172a; padding: 6px;">
          <div style="font-weight: 700;">${p.nama}</div>
          <div style="font-family: monospace; font-size: 10px; color: #334155;">NIP. ${p.nip}</div>
        </td>
        <td style="border: 1px solid #0f172a; padding: 6px;">${p.pangkatGolongan}</td>
        <td style="border: 1px solid #0f172a; padding: 6px;">${p.instansi}<br/><span style="font-size: 10px; color: #475569;">${p.kabupatenKota}</span></td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: center; font-family: monospace;">${p.verification.hariDisetujui} Hari</td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: right; font-family: monospace;">${formatRupiah(p.verification.tarifUangHarian)}</td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: right; font-family: monospace; font-weight: 700;">${formatRupiah(p.verification.totalUangHarian)}</td>
        <td style="border: 1px solid #0f172a; padding: 6px; font-family: monospace; font-size: 10px;">${p.namaBank}<br/>${p.noRekening}</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; text-decoration: underline;">
        DAFTAR NOMINATIF PENERIMAAN UANG HARIAN PESERTA KEGIATAN
      </div>
      <div style="font-size: 12px; margin-top: 4px;">${config.namaKegiatan} · MAK: ${config.kodeMak}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #0f172a; padding: 6px; width: 32px;">No</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Nama Peserta &amp; NIP</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Golongan</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Asal Instansi / Kab-Kota</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: center;">Hadir</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: right;">Tarif SBM</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: right;">Total Uang Harian</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Rekening Penerima</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc;">
          <td colspan="6" style="border: 1px solid #0f172a; padding: 8px; font-weight: 800; text-align: right;">JUMLAH TOTAL UANG HARIAN NOMINATIF</td>
          <td style="border: 1px solid #0f172a; padding: 8px; font-weight: 800; font-family: monospace; text-align: right;">${formatRupiah(grandTotalUangHarian)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px;"></td>
        </tr>
        <tr>
          <td colspan="8" style="border: 1px solid #0f172a; padding: 8px; font-style: italic; background: #eff6ff;">
            <strong>Terbilang:</strong> # ${terbilangRupiah(grandTotalUangHarian)} #
          </td>
        </tr>
      </tfoot>
    </table>

    ${buildSignatureBlockHtml(config)}
  `;

  return {
    title: 'Rekapitulasi Daftar Nominatif Uang Harian Peserta',
    subtitle: `${participants.length} Peserta · Total: ${formatRupiah(grandTotalUangHarian)}`,
    docCode: `NOM-UH/${config.tahunAnggaran}`,
    htmlContent,
  };
}

/**
 * 4. Generator Rekap & Kuitansi Transport Peserta
 */
export function generateRekapTransportDocument(
  participants: ParticipantRecord[],
  config: ActivityConfig
): PrintableDocumentPayload {
  const grandTotalTransport = participants.reduce(
    (sum, p) => sum + p.verification.transportDisetujui,
    0
  );

  const rowsHtml = participants
    .map(
      (p, idx) => `
      <tr>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #0f172a; padding: 6px;">
          <div style="font-weight: 700;">${p.nama}</div>
          <div style="font-family: monospace; font-size: 10px;">${p.instansi}</div>
        </td>
        <td style="border: 1px solid #0f172a; padding: 6px;">${p.kabupatenKota} &harr; ${config.lokasiKegiatan.split(',')[0]}</td>
        <td style="border: 1px solid #0f172a; padding: 6px;">
          ${
            p.verification.gunakanSppr
              ? `SPPR Transport Riil (${p.spprItems.map((i) => i.modaTransport).join(', ') || 'Lokal'})`
              : 'Tiket Resmi / Bukti Bayar Terlampir'
          }
        </td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: right; font-family: monospace; font-weight: 700;">
          ${formatRupiah(p.verification.transportDisetujui)}
        </td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; text-decoration: underline;">
        REKAPITULASI PENGGANTIAN BIAYA TRANSPORTASI PESERTA (TIKET RESMI &amp; SPPR)
      </div>
      <div style="font-size: 12px; margin-top: 4px;">${config.namaKegiatan} · Tahun Anggaran ${config.tahunAnggaran}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #0f172a; padding: 6px; width: 32px;">No</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Nama Peserta &amp; Instansi</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Rute Perjalanan (PP)</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Jenis Bukti Pertanggungjawaban</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: right;">Nominal Disetujui (Rp)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc;">
          <td colspan="4" style="border: 1px solid #0f172a; padding: 8px; font-weight: 800; text-align: right;">TOTAL BIAYA TRANSPORTASI PESERTA</td>
          <td style="border: 1px solid #0f172a; padding: 8px; font-weight: 800; font-family: monospace; text-align: right;">${formatRupiah(grandTotalTransport)}</td>
        </tr>
        <tr>
          <td colspan="5" style="border: 1px solid #0f172a; padding: 8px; font-style: italic; background: #eff6ff;">
            <strong>Terbilang:</strong> # ${terbilangRupiah(grandTotalTransport)} #
          </td>
        </tr>
      </tfoot>
    </table>

    ${buildSignatureBlockHtml(config)}
  `;

  return {
    title: 'Rekapitulasi & Kuitansi Biaya Transport Peserta',
    subtitle: `${participants.length} Peserta · Total Transport: ${formatRupiah(grandTotalTransport)}`,
    docCode: `REKAP-TR/${config.tahunAnggaran}`,
    htmlContent,
  };
}

/**
 * 5. Generator Berita Acara Serah Terima (BAST) Berkas & SPJ
 */
export function generateBastDocument(
  participants: ParticipantRecord[],
  config: ActivityConfig
): PrintableDocumentPayload {
  const totalSeluruhnya = participants.reduce(
    (sum, p) => sum + p.verification.totalDiterima,
    0
  );
  const verifiedCount = participants.filter(
    (p) => p.statusBerkas === 'TERVERIFIKASI'
  ).length;

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="text-align: center; margin-bottom: 18px;">
      <div style="font-size: 16px; font-weight: 800; text-transform: uppercase; text-decoration: underline;">
        BERITA ACARA SERAH TERIMA (BAST) DOKUMEN FISIK &amp; ARSIP DIGITAL SPJ KEGIATAN
      </div>
      <div style="font-size: 12px; font-family: monospace; margin-top: 4px;">
        Nomor: BAST-SPJ/${config.tahunAnggaran}/${new Date().getMonth() + 1}/001
      </div>
    </div>

    <div style="font-size: 13px; line-height: 1.65; margin-bottom: 16px; text-align: justify;">
      Pada hari ini, tanggal <strong>${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>, bertempat di <strong>${config.lokasiKegiatan}</strong>, kami yang bertanda tangan di bawah ini:
      <ol style="margin: 10px 0 12px 20px;">
        <li><strong>${config.namaBendahara}</strong> (NIP. ${config.nipBendahara}), Jabatan: Koordinator Verifikator Keuangan / Bendahara Pengeluaran, selanjutnya disebut <strong>PIHAK PERTAMA</strong>.</li>
        <li><strong>${config.namaPptk}</strong> (NIP. ${config.nipPptk}), Jabatan: Pejabat Pelaksana Teknis Kegiatan (PPTK), selanjutnya disebut <strong>PIHAK KEDUA</strong>.</li>
      </ol>
      PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menerima penyerahan bundel lengkap Pertanggungjawaban Keuangan (SPJ) Peserta Kegiatan <strong>${config.namaKegiatan}</strong> yang telah tersimpan terpusat di Google Drive Resmi Panitia beserta rincian sebagai berikut:
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px;">
      <tr style="background: #f1f5f9;">
        <th style="border: 1px solid #0f172a; padding: 8px; text-align: left;">Jenis Dokumen Arsip Terpusat (Audit BPK/Inspektorat)</th>
        <th style="border: 1px solid #0f172a; padding: 8px; text-align: center;">Jumlah Berkas</th>
        <th style="border: 1px solid #0f172a; padding: 8px; text-align: left;">Status Penyimpanan Google Drive Panitia</th>
      </tr>
      <tr>
        <td style="border: 1px solid #0f172a; padding: 8px;">1. Surat Perintah Tugas (SPT) &amp; SPPD/Visum Berstempel</td>
        <td style="border: 1px solid #0f172a; padding: 8px; text-align: center; font-family: monospace;">${participants.length} Peserta (${verifiedCount} Terverifikasi)</td>
        <td style="border: 1px solid #0f172a; padding: 8px;">Tersimpan di Subfolder masing-masing peserta</td>
      </tr>
      <tr>
        <td style="border: 1px solid #0f172a; padding: 8px;">2. Bukti Tiket Resmi &amp; Surat Pernyataan Pengeluaran Riil (SPPR)</td>
        <td style="border: 1px solid #0f172a; padding: 8px; text-align: center; font-family: monospace;">${participants.length} Berkas</td>
        <td style="border: 1px solid #0f172a; padding: 8px;">Lengkap dengan cap waktu &amp; jejak audit</td>
      </tr>
      <tr>
        <td style="border: 1px solid #0f172a; padding: 8px;">3. Nilai Total Realisasi Hak Keuangan Peserta (Uang Harian + Transport)</td>
        <td style="border: 1px solid #0f172a; padding: 8px; text-align: center; font-family: monospace; font-weight: 700;">${formatRupiah(totalSeluruhnya)}</td>
        <td style="border: 1px solid #0f172a; padding: 8px; font-style: italic;"># ${terbilangRupiah(totalSeluruhnya)} #</td>
      </tr>
    </table>

    <div style="font-size: 12px; line-height: 1.5; margin-bottom: 18px;">
      Demikian Berita Acara Serah Terima ini dibuat dengan sebenarnya dalam rangkap 2 (dua) untuk dipergunakan sebagai kelengkapan pemeriksaan BPK/Inspektorat.
    </div>

    ${buildSignatureBlockHtml(config)}
  `;

  return {
    title: 'Berita Acara Serah Terima (BAST) Berkas & Pembayaran SPJ',
    subtitle: `${participants.length} Berkas Peserta · Nilai SPJ: ${formatRupiah(totalSeluruhnya)}`,
    docCode: `BAST-SPJ/${config.tahunAnggaran}`,
    htmlContent,
  };
}

/**
 * 6. Generator Bendel Arsip Digital Lengkap Per Peserta
 */
export function generateBendelPesertaDocument(
  participant: ParticipantRecord,
  config: ActivityConfig
): PrintableDocumentPayload {
  const kuitansi = generateKuitansiPesertaDocument(participant, config);
  const sppr = generateSpprDocument(participant, config);

  const docImagesHtml = [
    { label: 'Lampiran 1: Scan Surat Tugas (SPT)', doc: participant.documents.suratTugas },
    { label: 'Lampiran 2: Scan SPPD & Visum Kedatangan', doc: participant.documents.sppdVisum },
    { label: 'Lampiran 3: Scan Bukti Pembayaran Transportasi', doc: participant.documents.buktiTransport },
    ...(participant.documents.buktiBayarSusulan
      ? [{ label: 'Lampiran 4: Bukti Bayar / Transfer Susulan (Upload Manual Verifikator)', doc: participant.documents.buktiBayarSusulan }]
      : []),
  ]
    .map(
      (item) => `
      <div style="margin-top: 24px; page-break-inside: avoid; border: 1px solid #cbd5e1; padding: 14px; border-radius: 6px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${item.label}</div>
        ${
          item.doc
            ? `
              <div style="font-size: 11px; font-family: monospace; color: #475569; margin-bottom: 10px;">
                File: ${item.doc.fileName} · Drive ID: ${item.doc.driveFileId} · Diunggah: ${item.doc.uploadedAt} oleh ${item.doc.uploadedBy} (${item.doc.compressedSizeKB} KB)
                ${item.doc.auditNote ? `<br/>Catatan Audit: ${item.doc.auditNote}` : ''}
              </div>
              <div style="text-align: center; background: #f8fafc; padding: 8px; border: 1px solid #e2e8f0;">
                <img src="${item.doc.dataUrl}" alt="${item.label}" style="max-width: 100%; max-height: 460px; object-fit: contain;" />
              </div>
            `
            : `<div style="padding: 16px; background: #fef2f2; color: #991b1b; font-size: 12px;">Dokumen ini belum diunggah.</div>`
        }
      </div>
    `
    )
    .join('');

  const htmlContent = `
    <div style="background: #0f172a; color: #ffffff; padding: 14px 18px; border-radius: 6px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 11px; font-family: monospace; color: #93c5fd;">BENDEL ARSIP DIGITAL PESERTA (100% AUDIT-READY)</div>
        <div style="font-size: 16px; font-weight: 800; margin-top: 2px;">${participant.nama} — NIP. ${participant.nip}</div>
        <div style="font-size: 12px; color: #cbd5e1;">Folder Drive Panitia: /${config.namaKegiatan}/${participant.driveFolderName}/</div>
      </div>
      <div style="text-align: right; font-family: monospace; font-size: 11px;">
        <div>Mode Input: ${participant.inputMode}</div>
        <div>Status: ${participant.statusBerkas}</div>
      </div>
    </div>

    ${kuitansi.htmlContent}
    <hr style="margin: 32px 0; border: none; border-top: 2px dashed #94a3b8;" />
    ${sppr.htmlContent}
    <hr style="margin: 32px 0; border: none; border-top: 2px dashed #94a3b8;" />
    <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">
      LAMPIRAN BUKTI FISIK TERKOMPRESI (GOOGLE DRIVE PANITIA)
    </div>
    ${docImagesHtml}
  `;

  return {
    title: `Bendel Arsip Digital Lengkap — ${participant.nama}`,
    subtitle: `Folder Drive: ${participant.driveFolderName} · Total Hak: ${formatRupiah(participant.verification.totalDiterima)}`,
    docCode: `BENDEL/${participant.nip}`,
    htmlContent,
  };
}

/**
 * 7. Generator Daftar Nominatif Honorarium & Pajak PPh 21 Narasumber/Petugas
 */
export function generateNominatifNarasumberDocument(
  speakers: SpeakerRecord[],
  config: ActivityConfig
): PrintableDocumentPayload {
  const totalBruto = speakers.reduce((s, sp) => s + sp.bruto, 0);
  const totalPajak = speakers.reduce((s, sp) => s + sp.potonganPph21, 0);
  const totalNetto = speakers.reduce((s, sp) => s + sp.netto, 0);

  const rowsHtml = speakers
    .map(
      (sp, idx) => `
      <tr>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #0f172a; padding: 6px;">
          <div style="font-weight: 700;">${sp.nama}</div>
          <div style="font-size: 10px; color: #334155;">${sp.instansi} · NPWP: ${sp.npwp || '-'}</div>
        </td>
        <td style="border: 1px solid #0f172a; padding: 6px;">${sp.peran}</td>
        <td style="border: 1px solid #0f172a; padding: 6px;">${sp.golongan}</td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: center; font-family: monospace;">${sp.jumlahJP} JP</td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: right; font-family: monospace;">${formatRupiah(sp.tarifPerJP)}</td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: right; font-family: monospace; font-weight: 700;">${formatRupiah(sp.bruto)}</td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: right; font-family: monospace;">${formatRupiah(sp.potonganPph21)} (${sp.tarifPph21Persen}%)</td>
        <td style="border: 1px solid #0f172a; padding: 6px; text-align: right; font-family: monospace; font-weight: 800;">${formatRupiah(sp.netto)}</td>
        <td style="border: 1px solid #0f172a; padding: 6px; font-family: monospace; font-size: 10px;">${sp.namaBank}<br/>${sp.noRekening}</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; text-decoration: underline;">
        DAFTAR NOMINATIF PEMBAYARAN HONORARIUM NARASUMBER, MODERATOR, MC &amp; PETUGAS
      </div>
      <div style="font-size: 12px; margin-top: 4px;">Beserta Perhitungan Potongan Pajak PPh Pasal 21 · ${config.namaKegiatan}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #0f172a; padding: 6px; width: 28px;">No</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Nama &amp; NPWP</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Peran</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Golongan</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: center;">Vol</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: right;">Honor/JP</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: right;">Jumlah Bruto</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: right;">PPh 21</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: right;">Diterima (Netto)</th>
          <th style="border: 1px solid #0f172a; padding: 6px; text-align: left;">Rekening</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; font-family: monospace; font-weight: 800;">
          <td colspan="6" style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-family: sans-serif;">TOTAL HONORARIUM</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(totalBruto)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(totalPajak)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(totalNetto)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px;"></td>
        </tr>
        <tr>
          <td colspan="10" style="border: 1px solid #0f172a; padding: 8px; font-style: italic; background: #eff6ff;">
            <strong>Terbilang Bruto:</strong> # ${terbilangRupiah(totalBruto)} # &nbsp;|&nbsp;
            <strong>Terbilang Netto:</strong> # ${terbilangRupiah(totalNetto)} #
          </td>
        </tr>
      </tfoot>
    </table>

    ${buildSignatureBlockHtml(config)}
  `;

  return {
    title: 'Daftar Nominatif Honorarium Narasumber & Petugas',
    subtitle: `${speakers.length} Narasumber/Petugas · Bruto: ${formatRupiah(totalBruto)} · Netto: ${formatRupiah(totalNetto)}`,
    docCode: `NOM-HONOR/${config.tahunAnggaran}`,
    htmlContent,
  };
}

/**
 * 8. Generator Kuitansi Narasumber Individual
 */
export function generateKuitansiNarasumberDocument(
  speaker: SpeakerRecord,
  config: ActivityConfig
): PrintableDocumentPayload {
  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="text-align: center; margin-bottom: 18px;">
      <div style="font-size: 17px; font-weight: 800; text-decoration: underline;">
        KUITANSI PEMBAYARAN HONORARIUM ${speaker.peran.toUpperCase()}
      </div>
      <div style="font-size: 12px; font-family: monospace; margin-top: 4px;">Nomor: ${speaker.noKuitansi}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px;">
      <tr><td style="width: 180px; padding: 6px 0; font-weight: 600;">Sudah Terima Dari</td><td>: Kuasa Pengguna Anggaran / PPK ${config.satuanKerja}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Uang Sejumlah (Bruto)</td><td style="font-family: monospace; font-weight: 800;">: ${formatRupiah(speaker.bruto)}</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Terbilang Bruto</td><td style="font-style: italic; font-weight: 700; color: #1e3a8a;">: # ${terbilangRupiah(speaker.bruto)} #</td></tr>
      <tr><td style="padding: 6px 0; font-weight: 600;">Untuk Pembayaran</td><td>: Honorarium ${speaker.peran} (${speaker.materiJudul}) pada kegiatan ${config.namaKegiatan} sebanyak ${speaker.jumlahJP} Jam Pelajaran (JP).</td></tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px;">
      <tr style="background: #f1f5f9;">
        <th style="border: 1px solid #0f172a; padding: 8px; text-align: left;">Uraian Perhitungan Honorarium</th>
        <th style="border: 1px solid #0f172a; padding: 8px; text-align: right;">Jumlah (Rp)</th>
      </tr>
      <tr>
        <td style="border: 1px solid #0f172a; padding: 8px;">Honorarium Bruto (${speaker.jumlahJP} JP &times; ${formatRupiah(speaker.tarifPerJP)})</td>
        <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-family: monospace; font-weight: 700;">${formatRupiah(speaker.bruto)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #0f172a; padding: 8px;">Potongan Pajak PPh Pasal 21 (${speaker.golongan} — Tarif ${speaker.tarifPph21Persen}%)</td>
        <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-family: monospace; color: #b91c1c;">- ${formatRupiah(speaker.potonganPph21)}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="border: 1px solid #0f172a; padding: 8px; font-weight: 800;">JUMLAH BERSIH DITERIMA (NETTO) — ${speaker.namaBank} (${speaker.noRekening})</td>
        <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 14px;">${formatRupiah(speaker.netto)}</td>
      </tr>
      <tr>
        <td colspan="2" style="border: 1px solid #0f172a; padding: 8px; font-style: italic; background: #eff6ff;">
          <strong>Terbilang Netto:</strong> # ${terbilangRupiah(speaker.netto)} #
        </td>
      </tr>
    </table>

    ${buildSignatureBlockHtml(config, {
      role: `Penerima Honorarium (${speaker.peran})`,
      name: speaker.nama,
      nip: `NPWP: ${speaker.npwp || '-'}`,
    })}
  `;

  return {
    title: `Kuitansi Honorarium — ${speaker.nama}`,
    subtitle: `${speaker.peran} · Netto: ${formatRupiah(speaker.netto)}`,
    docCode: speaker.noKuitansi,
    htmlContent,
  };
}

/**
 * 9. Generator Laporan Dokumentasi Kegiatan (PDF)
 */
export function generateLaporanDokumentasiDocument(
  photos: DocumentationPhoto[],
  config: ActivityConfig
): PrintableDocumentPayload {
  const photoCardsHtml = photos
    .map(
      (ph, idx) => `
      <div style="border: 1px solid #0f172a; border-radius: 6px; padding: 12px; margin-bottom: 16px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 12px;">
          <div><strong>Foto #${idx + 1} — Kategori: ${ph.kategori}</strong> (Hari ke-${ph.hariKe})</div>
          <div style="font-family: monospace; font-size: 11px; color: #475569;">${ph.tanggal} · Drive ID: ${ph.driveFileId}</div>
        </div>
        <div style="text-align: center; background: #0f172a; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
          <img src="${ph.imageUrl}" alt="${ph.judul}" style="width: 100%; max-height: 290px; object-fit: cover;" />
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${ph.judul}</div>
        <div style="font-size: 12px; color: #334155; margin-top: 2px;">${ph.caption}</div>
      </div>
    `
    )
    .join('');

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="text-align: center; margin-bottom: 18px;">
      <div style="font-size: 16px; font-weight: 800; text-transform: uppercase; text-decoration: underline;">
        LAPORAN DOKUMENTASI VISUAL PELAKSANAAN KEGIATAN
      </div>
      <div style="font-size: 12px; margin-top: 4px;">${config.namaKegiatan} · ${config.lokasiKegiatan}</div>
    </div>

    ${photoCardsHtml}

    ${buildSignatureBlockHtml(config, {
      role: 'Koordinator Seksi Dokumentasi & Publikasi',
      name: 'Tim Dokumentasi Panitia',
      nip: `Arsip Google Drive: ${photos.length} Foto Terverifikasi`,
    })}
  `;

  return {
    title: 'Laporan Dokumentasi Kegiatan (PDF)',
    subtitle: `${photos.length} Foto Terstruktur · Tersimpan di Google Drive Panitia`,
    docCode: `LAP-DOK/${config.tahunAnggaran}`,
    htmlContent,
  };
}

/**
 * 10. Generator Master Laporan Akhir Pelaksanaan Kegiatan (PPTK Executive Report)
 */
export function generateMasterLaporanPptkDocument(
  config: ActivityConfig,
  participants: ParticipantRecord[],
  speakers: SpeakerRecord[],
  photos: DocumentationPhoto[],
  auditLogs: AuditLogEntry[]
): PrintableDocumentPayload {
  const realisasiUangHarian = participants.reduce(
    (s, p) => s + p.verification.totalUangHarian,
    0
  );
  const realisasiTransport = participants.reduce(
    (s, p) => s + p.verification.transportDisetujui,
    0
  );
  const realisasiHonor = speakers.reduce((s, sp) => s + sp.bruto, 0);
  const realisasiTotal =
    realisasiUangHarian +
    realisasiTransport +
    realisasiHonor +
    config.realisasiKonsumsiOperasional;
  const persentaseSerapan = ((realisasiTotal / config.paguDpaTotal) * 100).toFixed(1);

  const nominatifUh = generateRekapUangHarianNominatif(participants, config);
  const nominatifTr = generateRekapTransportDocument(participants, config);
  const nominatifHonor = generateNominatifNarasumberDocument(speakers, config);
  const dokVisual = generateLaporanDokumentasiDocument(photos, config);

  const auditRowsHtml = auditLogs
    .slice(0, 10)
    .map(
      (log) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 5px; font-family: monospace; font-size: 10px;">${log.timestamp}</td>
        <td style="border: 1px solid #cbd5e1; padding: 5px;">${log.actorName} (${log.actorRole})</td>
        <td style="border: 1px solid #cbd5e1; padding: 5px; font-weight: 700;">${log.actionType}</td>
        <td style="border: 1px solid #cbd5e1; padding: 5px;">${log.details}</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    ${buildKopSuratHtml(config)}
    <div style="background: #0f172a; color: #ffffff; padding: 20px; border-radius: 6px; margin-bottom: 22px; text-align: center;">
      <div style="font-size: 11px; font-family: monospace; letter-spacing: 0.1em; color: #93c5fd;">DOKUMEN INDUK PERTANGGUNGJAWABAN KEGIATAN (SIAP JILID)</div>
      <div style="font-size: 20px; font-weight: 800; margin-top: 6px; text-transform: uppercase;">
        MASTER LAPORAN AKHIR PELAKSANAAN KEGIATAN
      </div>
      <div style="font-size: 14px; color: #e2e8f0; margin-top: 4px;">${config.namaKegiatan}</div>
      <div style="font-size: 12px; font-family: monospace; color: #cbd5e1; margin-top: 8px;">
        DIPA/DPA: ${config.nomorDpa} · Lokasi: ${config.lokasiKegiatan} · Tanggal: ${config.tanggalMulai} s.d. ${config.tanggalSelesai}
      </div>
    </div>

    <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">
      BAB I. RINGKASAN EKSEKUTIF &amp; REALISASI PENYERAPAN ANGGARAN DPA
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: left;">Pos Belanja Kegiatan (MAK ${config.kodeMak})</th>
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: right;">Pagu DPA (Rp)</th>
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: right;">Realisasi SPJ (Rp)</th>
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: right;">Sisa Anggaran (Rp)</th>
          <th style="border: 1px solid #0f172a; padding: 8px; text-align: center;">Serapan (%)</th>
        </tr>
      </thead>
      <tbody style="font-family: monospace;">
        <tr>
          <td style="border: 1px solid #0f172a; padding: 8px; font-family: sans-serif;">1. Belanja Uang Harian Peserta (${participants.length} Orang)</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguUangHarian)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-weight: 700;">${formatRupiah(realisasiUangHarian)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguUangHarian - realisasiUangHarian)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: center;">${((realisasiUangHarian / config.paguUangHarian) * 100).toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="border: 1px solid #0f172a; padding: 8px; font-family: sans-serif;">2. Belanja Transportasi Peserta (Tiket Resmi &amp; SPPR)</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguTransportPeserta)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-weight: 700;">${formatRupiah(realisasiTransport)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguTransportPeserta - realisasiTransport)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: center;">${((realisasiTransport / config.paguTransportPeserta) * 100).toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="border: 1px solid #0f172a; padding: 8px; font-family: sans-serif;">3. Belanja Jasa Narasumber, Moderator, MC &amp; Petugas</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguHonorNarasumber)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-weight: 700;">${formatRupiah(realisasiHonor)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguHonorNarasumber - realisasiHonor)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: center;">${((realisasiHonor / config.paguHonorNarasumber) * 100).toFixed(1)}%</td>
        </tr>
        <tr>
          <td style="border: 1px solid #0f172a; padding: 8px; font-family: sans-serif;">4. Belanja Paket Meeting, Konsumsi &amp; Operasional Panitia</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguKonsumsiOperasional)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right; font-weight: 700;">${formatRupiah(config.realisasiKonsumsiOperasional)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguKonsumsiOperasional - config.realisasiKonsumsiOperasional)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: center;">${((config.realisasiKonsumsiOperasional / config.paguKonsumsiOperasional) * 100).toFixed(1)}%</td>
        </tr>
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; font-family: monospace; font-weight: 800;">
          <td style="border: 1px solid #0f172a; padding: 8px; font-family: sans-serif;">TOTAL KESELURUHAN ANGGARAN KEGIATAN</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguDpaTotal)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(realisasiTotal)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: right;">${formatRupiah(config.paguDpaTotal - realisasiTotal)}</td>
          <td style="border: 1px solid #0f172a; padding: 8px; text-align: center;">${persentaseSerapan}%</td>
        </tr>
      </tfoot>
    </table>

    <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 22px 0 8px;">
      BAB II. JEJAK AUDIT SISTEM &amp; VERIFIKASI KEPATUHAN (AUDIT TRAIL BPK)
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Waktu Server</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Aktor / Peran</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Tindakan</th>
          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Keterangan Audit</th>
        </tr>
      </thead>
      <tbody>
        ${auditRowsHtml}
      </tbody>
    </table>

    <hr style="margin: 32px 0; border: none; border-top: 2px dashed #94a3b8;" />
    ${nominatifUh.htmlContent}
    <hr style="margin: 32px 0; border: none; border-top: 2px dashed #94a3b8;" />
    ${nominatifTr.htmlContent}
    <hr style="margin: 32px 0; border: none; border-top: 2px dashed #94a3b8;" />
    ${nominatifHonor.htmlContent}
    <hr style="margin: 32px 0; border: none; border-top: 2px dashed #94a3b8;" />
    ${dokVisual.htmlContent}
  `;

  return {
    title: 'Master Laporan Akhir Pelaksanaan Kegiatan (PPTK Executive Report)',
    subtitle: `Serapan DPA: ${persentaseSerapan}% (${formatRupiah(realisasiTotal)} dari ${formatRupiah(config.paguDpaTotal)})`,
    docCode: `MASTER-LAP/${config.tahunAnggaran}`,
    htmlContent,
  };
}

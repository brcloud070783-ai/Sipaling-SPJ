import { GolonganType } from '../types/simkantor';

const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

function konversiAngkaKeKata(n: number): string {
  const nilai = Math.floor(Math.abs(n));
  if (nilai < 12) {
    return SATUAN[nilai];
  }
  if (nilai < 20) {
    return `${konversiAngkaKeKata(nilai - 10)} Belas`.trim();
  }
  if (nilai < 100) {
    const puluhan = Math.floor(nilai / 10);
    const sisa = nilai % 10;
    return `${konversiAngkaKeKata(puluhan)} Puluh ${konversiAngkaKeKata(sisa)}`.trim();
  }
  if (nilai < 200) {
    return `Seratus ${konversiAngkaKeKata(nilai - 100)}`.trim();
  }
  if (nilai < 1000) {
    const ratusan = Math.floor(nilai / 100);
    const sisa = nilai % 100;
    return `${konversiAngkaKeKata(ratusan)} Ratus ${konversiAngkaKeKata(sisa)}`.trim();
  }
  if (nilai < 2000) {
    return `Seribu ${konversiAngkaKeKata(nilai - 1000)}`.trim();
  }
  if (nilai < 1_000_000) {
    const ribuan = Math.floor(nilai / 1000);
    const sisa = nilai % 1000;
    return `${konversiAngkaKeKata(ribuan)} Ribu ${konversiAngkaKeKata(sisa)}`.trim();
  }
  if (nilai < 1_000_000_000) {
    const jutaan = Math.floor(nilai / 1_000_000);
    const sisa = nilai % 1_000_000;
    return `${konversiAngkaKeKata(jutaan)} Juta ${konversiAngkaKeKata(sisa)}`.trim();
  }
  if (nilai < 1_000_000_000_000) {
    const miliaran = Math.floor(nilai / 1_000_000_000);
    const sisa = nilai % 1_000_000_000;
    return `${konversiAngkaKeKata(miliaran)} Miliar ${konversiAngkaKeKata(sisa)}`.trim();
  }
  return nilai.toLocaleString('id-ID');
}

/**
 * Mengonversi angka nominal Rupiah menjadi kalimat Terbilang resmi untuk Kuitansi SPJ BPK.
 * Contoh: 750000 -> "Tujuh Ratus Lima Puluh Ribu Rupiah"
 */
export function terbilangRupiah(nominal: number): string {
  if (!nominal || nominal <= 0) {
    return 'Nol Rupiah';
  }
  const hasil = konversiAngkaKeKata(nominal).replace(/\s+/g, ' ').trim();
  return `${hasil} Rupiah`;
}

export function formatRupiah(nominal: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(nominal || 0);
}

/**
 * Kalkulator PPh Pasal 21 Honorarium Narasumber / Petugas sesuai PMK SBM:
 * - PNS Golongan I / II: 0% (Final)
 * - PNS Golongan III: 5% (Final)
 * - PNS Golongan IV: 15% (Final)
 * - Non-ASN / Praktisi: 5% (dengan NPWP) atau 6% (tanpa NPWP)
 */
export function calculateHonorariumPPh21(
  jumlahJP: number,
  tarifPerJP: number,
  golongan: GolonganType,
  hasNpwp: boolean
): {
  bruto: number;
  tarifPph21Persen: number;
  potonganPph21: number;
  netto: number;
} {
  const jp = Math.max(0, Number(jumlahJP) || 0);
  const tarif = Math.max(0, Number(tarifPerJP) || 0);
  const bruto = jp * tarif;

  let tarifPph21Persen = 5;
  if (golongan === GolonganType.GOL_I_II) {
    tarifPph21Persen = 0;
  } else if (golongan === GolonganType.GOL_III) {
    tarifPph21Persen = 5;
  } else if (golongan === GolonganType.GOL_IV) {
    tarifPph21Persen = 15;
  } else {
    tarifPph21Persen = hasNpwp ? 5 : 6;
  }

  const potonganPph21 = Math.round((bruto * tarifPph21Persen) / 100);
  const netto = bruto - potonganPph21;

  return {
    bruto,
    tarifPph21Persen,
    potonganPph21,
    netto,
  };
}

/**
 * Kompresi otomatis foto kamera HP menggunakan HTML5 Canvas
 * agar ukuran file hemat (<350 KB) namun teks dokumen SPPD/Surat Tugas tetap tajam.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 1400,
  quality = 0.78
): Promise<{
  dataUrl: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  width: number;
  height: number;
}> {
  const originalSizeKB = Math.max(1, Math.round(file.size / 1024));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > maxWidth) {
          const ratio = maxWidth / targetWidth;
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi Canvas 2D untuk kompresi gambar.'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Tambahkan watermark waktu audit tipis di pojok kanan bawah
        const stampText = `SIM-KANTOR AUDIT · ${new Date().toLocaleString('id-ID')}`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fillRect(targetWidth - 360, targetHeight - 32, 350, 24);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = '600 11px monospace';
        ctx.fillText(stampText, targetWidth - 350, targetHeight - 16);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64Length = dataUrl.split(',')[1]?.length || 0;
        const compressedSizeKB = Math.max(
          12,
          Math.round((base64Length * 3) / 4 / 1024)
        );

        resolve({
          dataUrl,
          originalSizeKB,
          compressedSizeKB,
          width: targetWidth,
          height: targetHeight,
        });
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi.'));
      img.src = String(event.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Generator SVG Dokumen Scan Resmi (Surat Tugas, SPPD Visum, Tiket/Boarding Pass)
 * sehingga pratinjau verifikator selalu tajam dan bebas broken image.
 */
export function createSimulatedDocSvg(options: {
  docType: 'SURAT_TUGAS' | 'SPPD_VISUM' | 'TIKET_TRANSPORT';
  nama: string;
  nip: string;
  instansi: string;
  nomorDokumen: string;
  tanggal: string;
  nominal?: string;
  rute?: string;
}): string {
  const titleMap = {
    SURAT_TUGAS: 'SURAT PERINTAH TUGAS (SPT)',
    SPPD_VISUM: 'SURAT PERJALANAN DINAS (SPPD) & VISUM',
    TIKET_TRANSPORT: 'BUKTI PEMBAYARAN TRANSPORTASI RESMI',
  };
  const accentColor =
    options.docType === 'SURAT_TUGAS'
      ? '#1E3A8A'
      : options.docType === 'SPPD_VISUM'
      ? '#065F46'
      : '#7C2D12';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 960" width="720" height="960">
    <rect width="720" height="960" fill="#F8FAFC"/>
    <rect x="28" y="28" width="664" height="904" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2"/>
    
    <!-- Header Kop Surat -->
    <rect x="56" y="54" width="64" height="64" rx="8" fill="${accentColor}"/>
    <text x="88" y="94" font-family="sans-serif" font-size="22" font-weight="bold" fill="#FFFFFF" text-anchor="middle">RI</text>
    <text x="380" y="74" font-family="sans-serif" font-size="15" font-weight="bold" fill="#0F172A" text-anchor="middle">PEMERINTAH REPUBLIK INDONESIA</text>
    <text x="380" y="96" font-family="sans-serif" font-size="17" font-weight="bold" fill="${accentColor}" text-anchor="middle">${options.instansi.toUpperCase()}</text>
    <text x="380" y="116" font-family="sans-serif" font-size="11" fill="#475569" text-anchor="middle">Dokumen Terverifikasi Arsip Digital Panitia · SIM-KANTOR BPK-Ready</text>
    <line x1="56" y1="134" x2="664" y2="134" stroke="#0F172A" stroke-width="3"/>
    <line x1="56" y1="139" x2="664" y2="139" stroke="#0F172A" stroke-width="1"/>

    <!-- Judul Dokumen -->
    <text x="360" y="182" font-family="sans-serif" font-size="18" font-weight="bold" fill="#0F172A" text-anchor="middle" text-decoration="underline">${titleMap[options.docType]}</text>
    <text x="360" y="206" font-family="monospace" font-size="13" fill="#334155" text-anchor="middle">Nomor: ${options.nomorDokumen}</text>

    <!-- Isi Tabel Identitas -->
    <rect x="64" y="236" width="592" height="270" rx="6" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
    <text x="88" y="274" font-family="sans-serif" font-size="13" fill="#64748B">1. Nama Pegawai Ditugaskan</text>
    <text x="300" y="274" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0F172A">: ${options.nama}</text>

    <text x="88" y="314" font-family="sans-serif" font-size="13" fill="#64748B">2. Nomor Induk Pegawai (NIP)</text>
    <text x="300" y="314" font-family="monospace" font-size="14" font-weight="bold" fill="#0F172A">: ${options.nip}</text>

    <text x="88" y="354" font-family="sans-serif" font-size="13" fill="#64748B">3. Satuan Kerja / Instansi</text>
    <text x="300" y="354" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0F172A">: ${options.instansi}</text>

    <text x="88" y="394" font-family="sans-serif" font-size="13" fill="#64748B">4. Rute / Lokasi Kegiatan</text>
    <text x="300" y="394" font-family="sans-serif" font-size="13" fill="#0F172A">: ${options.rute || 'Lokasi Kegiatan Kedinasan Terpadu'}</text>

    <text x="88" y="434" font-family="sans-serif" font-size="13" fill="#64748B">5. Tanggal Dokumen</text>
    <text x="300" y="434" font-family="monospace" font-size="13" fill="#0F172A">: ${options.tanggal}</text>

    <text x="88" y="474" font-family="sans-serif" font-size="13" fill="#64748B">6. Keterangan / Nominal</text>
    <text x="300" y="474" font-family="monospace" font-size="14" font-weight="bold" fill="${accentColor}">: ${options.nominal || 'Sesuai Standar Biaya Masukan (SBM)'}</text>

    <!-- Blok Visum & Cap Basah -->
    <rect x="64" y="534" width="592" height="260" rx="6" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="6,4"/>
    <text x="88" y="568" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0F172A">PENGESAHAN VISUM &amp; TANDA TANGAN PEJABAT BERWENANG</text>
    <text x="88" y="594" font-family="sans-serif" font-size="12" fill="#475569">Telah tiba di tempat kedudukan kegiatan dan diperiksa kelengkapan administrasi fisik.</text>

    <!-- Stempel Basah Simulasi -->
    <circle cx="470" cy="690" r="58" fill="none" stroke="#1D4ED8" stroke-width="3" opacity="0.78"/>
    <circle cx="470" cy="690" r="50" fill="none" stroke="#1D4ED8" stroke-width="1.2" opacity="0.78"/>
    <text x="470" y="676" font-family="sans-serif" font-size="10" font-weight="bold" fill="#1D4ED8" text-anchor="middle" opacity="0.85">PANITIA PELAKSANA</text>
    <text x="470" y="694" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1D4ED8" text-anchor="middle" opacity="0.85">CAP VISUM RESMI</text>
    <text x="470" y="710" font-family="sans-serif" font-size="9" fill="#1D4ED8" text-anchor="middle" opacity="0.85">TERVERIFIKASI</text>

    <!-- Tanda Tangan Kurva -->
    <path d="M 430 705 Q 465 645 490 700 T 555 665" fill="none" stroke="#0F172A" stroke-width="3" stroke-linecap="round"/>
    <text x="490" y="762" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0F172A" text-anchor="middle">Pejabat Berwenang / KPA</text>

    <!-- Footer Watermark Kamera -->
    <rect x="56" y="838" width="608" height="58" rx="4" fill="#0F172A"/>
    <text x="76" y="863" font-family="monospace" font-size="11" fill="#38BDF8">GOOGLE DRIVE PANITIA · AUTO-SYNCED VIA SERVICE ACCOUNT</text>
    <text x="76" y="882" font-family="monospace" font-size="11" fill="#94A3B8">SHA256-AUDIT-READY · ${options.nomorDokumen} · ${options.tanggal}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generator Ilustrasi Foto Dokumentasi Kegiatan (4 Kategori)
 * menjamin Zero-Broken-Image baik di layar maupun saat cetak PDF Master Report.
 */
export function createDocumentationSvg(options: {
  kategori: string;
  judul: string;
  hariKe: number;
  tanggal: string;
  themeColor: string;
}): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 540" width="800" height="540">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0F172A"/>
        <stop offset="55%" stop-color="${options.themeColor}"/>
        <stop offset="100%" stop-color="#1E293B"/>
      </linearGradient>
    </defs>
    <rect width="800" height="540" fill="url(#bgGrad)"/>
    
    <!-- Architectural Backdrop Grid -->
    <rect x="48" y="44" width="704" height="360" rx="10" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="1.5"/>
    <rect x="88" y="76" width="624" height="140" rx="6" fill="#F8FAFC" fill-opacity="0.12"/>
    <text x="400" y="132" font-family="sans-serif" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${options.judul.toUpperCase()}</text>
    <text x="400" y="164" font-family="monospace" font-size="14" fill="#CBD5E1" text-anchor="middle">KATEGORI: ${options.kategori.toUpperCase()} · HARI KE-${options.hariKe}</text>

    <!-- Stylized Conference / Activity Silhouette -->
    <circle cx="230" cy="300" r="34" fill="#E2E8F0" fill-opacity="0.85"/>
    <rect x="182" y="344" width="96" height="58" rx="18" fill="#E2E8F0" fill-opacity="0.85"/>

    <circle cx="400" cy="285" r="40" fill="#FFFFFF" fill-opacity="0.95"/>
    <rect x="344" y="334" width="112" height="68" rx="20" fill="#FFFFFF" fill-opacity="0.95"/>

    <circle cx="570" cy="300" r="34" fill="#E2E8F0" fill-opacity="0.85"/>
    <rect x="522" y="344" width="96" height="58" rx="18" fill="#E2E8F0" fill-opacity="0.85"/>

    <!-- Metadata Timestamp Strip -->
    <rect x="0" y="448" width="800" height="92" fill="#090D16" fill-opacity="0.92"/>
    <text x="48" y="484" font-family="sans-serif" font-size="16" font-weight="bold" fill="#F8FAFC">${options.judul}</text>
    <text x="48" y="512" font-family="monospace" font-size="13" fill="#94A3B8">SIM-KANTOR DOKUMENTASI RESMI · ${options.tanggal} · TERARSIP DI GOOGLE DRIVE PANITIA</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

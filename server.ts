import dotenv from 'dotenv';
import express from 'express';
import { google } from 'googleapis';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  ActivityConfig,
  AuditLogEntry,
  DocumentationPhoto,
  DocumentStatus,
  GolonganType,
  InputMode,
  ParticipantRecord,
  PhotoCategory,
  ResourceMaterial,
  SimKantorState,
  SpeakerRecord,
  SpeakerRole,
  SpprItem,
} from './src/types/simkantor.ts';
import {
  calculateHonorariumPPh21,
  createDocumentationSvg,
  createSimulatedDocSvg,
} from './src/utils/spjCalculators.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cek apakah kredensial Google Service Account sudah dikonfigurasi secara penuh
function isLiveGoogleServiceConfigured(): boolean {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const key = process.env.GOOGLE_PRIVATE_KEY || '';
  const sheetId = process.env.GOOGLE_SHEET_ID || '';
  const folderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '';
  return (
    Boolean(email && key && sheetId && folderId) &&
    !email.includes('project-id.iam.gserviceaccount.com') &&
    !key.includes('YOUR_PRIVATE_KEY_HERE')
  );
}

function getGoogleServiceClients() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  };
}

async function syncToGoogleDriveAndSheets(options: {
  nip: string;
  nama: string;
  fileName: string;
  base64DataUrl?: string;
  sheetTab: string;
  rowValues: (string | number)[];
}): Promise<{ folderId?: string; folderUrl?: string; fileId?: string; fileUrl?: string }> {
  if (!isLiveGoogleServiceConfigured()) {
    return {};
  }

  try {
    const { sheets, drive } = getGoogleServiceClients();
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!;
    const sheetId = process.env.GOOGLE_SHEET_ID!;
    const folderName = `${options.nip} - ${options.nama.replace(/[^a-zA-Z0-9 .,()-]/g, '')}`;

    // 1. Cari atau buat folder peserta di Google Drive Panitia
    let folderId = parentFolderId;
    let folderUrl = `https://drive.google.com/drive/folders/${parentFolderId}`;

    const searchRes = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`,
      fields: 'files(id, name, webViewLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      folderId = searchRes.data.files[0].id || parentFolderId;
      folderUrl = searchRes.data.files[0].webViewLink || folderUrl;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });
      folderId = createRes.data.id || parentFolderId;
      folderUrl = createRes.data.webViewLink || folderUrl;
    }

    // 2. Upload file jika ada base64DataUrl
    let fileId: string | undefined;
    let fileUrl: string | undefined;
    if (options.base64DataUrl && options.base64DataUrl.startsWith('data:')) {
      const matches = options.base64DataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        const uploadRes = await drive.files.create({
          requestBody: {
            name: options.fileName,
            parents: [folderId],
          },
          media: {
            mimeType,
            body: Readable.from(buffer),
          },
          fields: 'id, name, webViewLink',
          supportsAllDrives: true,
        });
        fileId = uploadRes.data.id || undefined;
        fileUrl = uploadRes.data.webViewLink || undefined;
      }
    }

    // 3. Catat baris ke Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${options.sheetTab}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [options.rowValues],
      },
    });

    return { folderId, folderUrl, fileId, fileUrl };
  } catch (err) {
    console.warn('Google API Live Sync Warning (fallback ke Hybrid Store):', err);
    return {};
  }
}

// Inisialisasi Data Awal yang Realistis & Siap Audit BPK
const initialConfig: ActivityConfig = {
  namaKegiatan:
    'Rapat Koordinasi Teknis & Bimbingan Teknis Tata Kelola Keuangan Daerah / Bosnas',
  instansiPenyelenggara: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi',
  satuanKerja: 'Balai Besar Penjaminan Mutu Pendidikan (BBPMP) & Panitia Terpadu',
  tahunAnggaran: 2026,
  nomorDpa: 'SP-DIPA-023.04.2.690415/2026',
  kodeMak: '524119.004.A',
  lokasiKegiatan: 'Hotel Grand Mercure Kemayoran, Jakarta Pusat',
  tanggalMulai: '2026-10-28',
  tanggalSelesai: '2026-10-30',
  jumlahHariKegiatan: 3,
  namaPptk: 'Dr. H. Hendra Wijaya, S.E., M.Ak.',
  nipPptk: '197804122003121004',
  namaPpk: 'Dra. Hj. Ratna Kusumawardhani, M.Si.',
  nipPpk: '197509182000032001',
  namaBendahara: 'Rizky Pratama Putra, S.E.',
  nipBendahara: '198911242014021002',
  tarifUangHarianSbm: 170000, // Uang Harian Paket Fullboard sesuai PMK SBM
  plafonTransportLokal: 450000,
  paguDpaTotal: 45000000,
  paguUangHarian: 12000000,
  paguTransportPeserta: 10500000,
  paguHonorNarasumber: 11500000,
  paguKonsumsiOperasional: 11000000,
  realisasiKonsumsiOperasional: 9450000,
};

const initialParticipants: ParticipantRecord[] = [
  {
    id: 'pst-001',
    nama: 'Drs. Rahmat Hidayat, M.Pd.',
    email: 'rahmat.hidayat.sma1@gmail.com',
    nip: '197605142002121003',
    pangkatGolongan: GolonganType.GOL_IV,
    jabatan: 'Kepala Sekolah',
    instansi: 'SMA Negeri 1 Tanjungpinang',
    kabupatenKota: 'Kota Tanjungpinang',
    noHp: '081270448911',
    namaBank: 'BRI',
    noRekening: '0184-01-029384-50-7',
    statusBerkas: DocumentStatus.TERVERIFIKASI,
    inputMode: InputMode.MANDIRI,
    driveFolderId: 'DRV-FOLDER-197605142002121003',
    driveFolderName: '197605142002121003 - Drs. Rahmat Hidayat, M.Pd.',
    driveFolderUrl:
      'https://drive.google.com/drive/folders/PANITIA_197605142002121003',
    attendance: [
      {
        dayIndex: 1,
        tanggal: '2026-10-28',
        checkInTime: '08:14:22 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
      {
        dayIndex: 2,
        tanggal: '2026-10-29',
        checkInTime: '07:52:10 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
      {
        dayIndex: 3,
        tanggal: '2026-10-30',
        checkInTime: '08:05:40 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
    ],
    documents: {
      suratTugas: {
        fileName: 'SURAT_TUGAS_197605142002121003_Rahmat_Hidayat.jpg',
        uploadedAt: '2026-10-28 08:16 WIB',
        uploadedBy: 'Drs. Rahmat Hidayat, M.Pd.',
        isProxy: false,
        originalSizeKB: 3840,
        compressedSizeKB: 248,
        driveFileId: 'DRV-ST-001',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-ST-001/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'SURAT_TUGAS',
          nama: 'Drs. Rahmat Hidayat, M.Pd.',
          nip: '197605142002121003',
          instansi: 'Dinas Pendidikan Prov. Kepri / SMAN 1 Tanjungpinang',
          nomorDokumen: '800/1428/SMAN1-TPI/X/2026',
          tanggal: '27 Oktober 2026',
        }),
      },
      sppdVisum: {
        fileName: 'SPPD_VISUM_197605142002121003_Rahmat_Hidayat.jpg',
        uploadedAt: '2026-10-28 08:18 WIB',
        uploadedBy: 'Drs. Rahmat Hidayat, M.Pd.',
        isProxy: false,
        originalSizeKB: 4120,
        compressedSizeKB: 274,
        driveFileId: 'DRV-SPPD-001',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-SPPD-001/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'SPPD_VISUM',
          nama: 'Drs. Rahmat Hidayat, M.Pd.',
          nip: '197605142002121003',
          instansi: 'SMA Negeri 1 Tanjungpinang',
          nomorDokumen: '090/512/SPPD-DISDIK/2026',
          tanggal: '28 Oktober 2026',
        }),
      },
      buktiTransport: {
        fileName: 'TIKET_TRANSPORT_197605142002121003_Rahmat_Hidayat.jpg',
        uploadedAt: '2026-10-28 08:20 WIB',
        uploadedBy: 'Drs. Rahmat Hidayat, M.Pd.',
        isProxy: false,
        originalSizeKB: 2910,
        compressedSizeKB: 215,
        driveFileId: 'DRV-TR-001',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-TR-001/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'TIKET_TRANSPORT',
          nama: 'Drs. Rahmat Hidayat, M.Pd.',
          nip: '197605142002121003',
          instansi: 'Maskapai & Taksi Bandara Resmi (PP)',
          nomorDokumen: 'TKT-GA-9982412',
          tanggal: '28 Oktober 2026',
          nominal: 'Rp 1.450.000',
          rute: 'Tanjungpinang - Jakarta (PP)',
        }),
      },
    },
    spprItems: [],
    verification: {
      hariDisetujui: 3,
      tarifUangHarian: 170000,
      totalUangHarian: 510000,
      transportDisetujui: 1450000,
      gunakanSppr: false,
      totalDiterima: 1960000,
      statusBayar: 'SUDAH_DIBAYAR',
      noKuitansi: 'KUI/SPJ/2026/001',
      tanggalVerifikasi: '2026-10-29 14:10 WIB',
      verifikatorName: 'Rizky Pratama Putra, S.E.',
      catatanVerifikator: 'Berkas SPT, SPPD ber-visum, dan boarding pass lengkap.',
    },
    updatedAt: '2026-10-29 14:10 WIB',
  },
  {
    id: 'pst-002',
    nama: 'Siti Aminah, S.Pd.SD.',
    email: 'siti.aminah.pulautiga@gmail.com',
    nip: '198408192009032008',
    pangkatGolongan: GolonganType.GOL_III,
    jabatan: 'Bendahara BOS Sekolah',
    instansi: 'SD Negeri 003 Pulau Tiga',
    kabupatenKota: 'Kab. Natuna (Kepulauan)',
    noHp: '081364992018',
    namaBank: 'Bank Riau Kepri Syariah',
    noRekening: '109-20-88391-0',
    statusBerkas: DocumentStatus.MENUNGGU_VERIFIKASI,
    inputMode: InputMode.MANDIRI,
    driveFolderId: 'DRV-FOLDER-198408192009032008',
    driveFolderName: '198408192009032008 - Siti Aminah, S.Pd.SD.',
    driveFolderUrl:
      'https://drive.google.com/drive/folders/PANITIA_198408192009032008',
    attendance: [
      {
        dayIndex: 1,
        tanggal: '2026-10-28',
        checkInTime: '08:25:04 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
      {
        dayIndex: 2,
        tanggal: '2026-10-29',
        checkInTime: '08:01:45 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
      {
        dayIndex: 3,
        tanggal: '2026-10-30',
        checkInTime: '08:11:19 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
    ],
    documents: {
      suratTugas: {
        fileName: 'SURAT_TUGAS_198408192009032008_Siti_Aminah.jpg',
        uploadedAt: '2026-10-28 09:05 WIB',
        uploadedBy: 'Siti Aminah, S.Pd.SD.',
        isProxy: false,
        originalSizeKB: 3650,
        compressedSizeKB: 230,
        driveFileId: 'DRV-ST-002',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-ST-002/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'SURAT_TUGAS',
          nama: 'Siti Aminah, S.Pd.SD.',
          nip: '198408192009032008',
          instansi: 'SD Negeri 003 Pulau Tiga - Kab. Natuna',
          nomorDokumen: '421.2/089/SDN003-PT/X/2026',
          tanggal: '26 Oktober 2026',
        }),
      },
      sppdVisum: {
        fileName: 'SPPD_VISUM_198408192009032008_Siti_Aminah.jpg',
        uploadedAt: '2026-10-28 09:08 WIB',
        uploadedBy: 'Siti Aminah, S.Pd.SD.',
        isProxy: false,
        originalSizeKB: 3920,
        compressedSizeKB: 262,
        driveFileId: 'DRV-SPPD-002',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-SPPD-002/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'SPPD_VISUM',
          nama: 'Siti Aminah, S.Pd.SD.',
          nip: '198408192009032008',
          instansi: 'Dinas Pendidikan Kab. Natuna',
          nomorDokumen: '090/311/SPPD-NTN/2026',
          tanggal: '28 Oktober 2026',
        }),
      },
      spprGenerated: {
        nomorSppr: 'SPPR/2026/PST-002',
        generatedAt: '2026-10-28 09:15 WIB',
        totalNominal: 650000,
        driveFileId: 'DRV-SPPR-002',
        items: [
          {
            id: 'sppr-item-1',
            tanggal: '2026-10-27',
            ruteAsal: 'Dermaga Pulau Tiga',
            ruteTujuan: 'Pelabuhan Selat Lampa Ranai',
            modaTransport: 'Pompon / Ketinting Laut Sewaan (PP)',
            alasanTanpaTiket:
              'Angkutan laut tradisional antar-pulau milik nelayan lokal tidak menerbitkan karcis/tiket bercap resmi.',
            nominal: 450000,
          },
          {
            id: 'sppr-item-2',
            tanggal: '2026-10-27',
            ruteAsal: 'Pelabuhan Selat Lampa',
            ruteTujuan: 'Bandara Raden Sadjad Ranai',
            modaTransport: 'Ojek / Angkutan Pedesaan (PP)',
            alasanTanpaTiket:
              'Transportasi ojek pedalaman menuju bandara tidak memiliki struk atau perusahaan operator resmi.',
            nominal: 200000,
          },
        ],
      },
    },
    spprItems: [
      {
        id: 'sppr-item-1',
        tanggal: '2026-10-27',
        ruteAsal: 'Dermaga Pulau Tiga',
        ruteTujuan: 'Pelabuhan Selat Lampa Ranai',
        modaTransport: 'Pompon / Ketinting Laut Sewaan (PP)',
        alasanTanpaTiket:
          'Angkutan laut tradisional antar-pulau milik nelayan lokal tidak menerbitkan karcis/tiket bercap resmi.',
        nominal: 450000,
      },
      {
        id: 'sppr-item-2',
        tanggal: '2026-10-27',
        ruteAsal: 'Pelabuhan Selat Lampa',
        ruteTujuan: 'Bandara Raden Sadjad Ranai',
        modaTransport: 'Ojek / Angkutan Pedesaan (PP)',
        alasanTanpaTiket:
          'Transportasi ojek pedalaman menuju bandara tidak memiliki struk atau perusahaan operator resmi.',
        nominal: 200000,
      },
    ],
    verification: {
      hariDisetujui: 3,
      tarifUangHarian: 170000,
      totalUangHarian: 510000,
      transportDisetujui: 650000,
      gunakanSppr: true,
      totalDiterima: 1160000,
      statusBayar: 'SIAP_BAYAR',
      noKuitansi: 'KUI/SPJ/2026/002',
      catatanVerifikator:
        'Menggunakan SPPR untuk transport ketinting laut & ojek lokal Pulau Tiga. Nominal wajar sesuai SBM Kab. Natuna.',
    },
    updatedAt: '2026-10-28 09:15 WIB',
  },
  {
    id: 'pst-003',
    nama: 'H. Burhanuddin, S.Ag.',
    email: 'burhanuddin.kemenag@gmail.com',
    nip: '196903101995031002',
    pangkatGolongan: GolonganType.GOL_IV,
    jabatan: 'Pengawas Madrasah Senior',
    instansi: 'Kantor Kemenag Kab. Lingga',
    kabupatenKota: 'Kab. Lingga',
    noHp: '08117702914',
    namaBank: 'BSI (Bank Syariah Indonesia)',
    noRekening: '7149283910',
    statusBerkas: DocumentStatus.TERVERIFIKASI,
    inputMode: InputMode.PROXY_PANITIA,
    proxyOfficerName: 'Andi Saputra (Helpdesk Panitia)',
    proxyReason: 'Layar smartphone peserta rusak saat perjalanan kapal ferry Dabo Singkep',
    driveFolderId: 'DRV-FOLDER-196903101995031002',
    driveFolderName: '196903101995031002 - H. Burhanuddin, S.Ag.',
    driveFolderUrl:
      'https://drive.google.com/drive/folders/PANITIA_196903101995031002',
    attendance: [
      {
        dayIndex: 1,
        tanggal: '2026-10-28',
        checkInTime: '08:40:12 WIB',
        lokasi: 'Meja Helpdesk Registrasi Panitia',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'PROXY: Andi Saputra (Helpdesk Panitia)',
        isProxy: true,
      },
      {
        dayIndex: 2,
        tanggal: '2026-10-29',
        checkInTime: '08:10:05 WIB',
        lokasi: 'Meja Helpdesk Registrasi Panitia',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'PROXY: Andi Saputra (Helpdesk Panitia)',
        isProxy: true,
      },
      {
        dayIndex: 3,
        tanggal: '2026-10-30',
        checkInTime: '08:02:30 WIB',
        lokasi: 'Meja Helpdesk Registrasi Panitia',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'PROXY: Andi Saputra (Helpdesk Panitia)',
        isProxy: true,
      },
    ],
    documents: {
      suratTugas: {
        fileName: 'PROXY_SURAT_TUGAS_196903101995031002_Burhanuddin.jpg',
        uploadedAt: '2026-10-28 08:45 WIB',
        uploadedBy: 'Andi Saputra (Helpdesk Panitia)',
        isProxy: true,
        auditNote:
          'AUDIT FLAG: Diinput melalui Proxy Mode karena layar HP peserta rusak saat di kapal.',
        originalSizeKB: 4210,
        compressedSizeKB: 268,
        driveFileId: 'DRV-ST-003',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-ST-003/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'SURAT_TUGAS',
          nama: 'H. Burhanuddin, S.Ag.',
          nip: '196903101995031002',
          instansi: 'Kantor Kementerian Agama Kab. Lingga',
          nomorDokumen: 'B-1102/Kk.32.04/1/Kp.01.1/10/2026',
          tanggal: '26 Oktober 2026',
        }),
      },
      sppdVisum: {
        fileName: 'PROXY_SPPD_VISUM_196903101995031002_Burhanuddin.jpg',
        uploadedAt: '2026-10-28 08:47 WIB',
        uploadedBy: 'Andi Saputra (Helpdesk Panitia)',
        isProxy: true,
        auditNote: 'AUDIT FLAG: Difoto langsung dari berkas fisik asli di meja panitia.',
        originalSizeKB: 3980,
        compressedSizeKB: 255,
        driveFileId: 'DRV-SPPD-003',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-SPPD-003/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'SPPD_VISUM',
          nama: 'H. Burhanuddin, S.Ag.',
          nip: '196903101995031002',
          instansi: 'Kantor Kementerian Agama Kab. Lingga',
          nomorDokumen: 'SPPD-449/Kk.32.04/X/2026',
          tanggal: '28 Oktober 2026',
        }),
      },
      buktiTransport: {
        fileName: 'PROXY_TIKET_196903101995031002_Burhanuddin.jpg',
        uploadedAt: '2026-10-28 08:49 WIB',
        uploadedBy: 'Andi Saputra (Helpdesk Panitia)',
        isProxy: true,
        originalSizeKB: 3100,
        compressedSizeKB: 210,
        driveFileId: 'DRV-TR-003',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-TR-003/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'TIKET_TRANSPORT',
          nama: 'H. Burhanuddin, S.Ag.',
          nip: '196903101995031002',
          instansi: 'Ferry Cepat & Pesawat Udara (PP)',
          nomorDokumen: 'FERRY-LIN-88392',
          tanggal: '27 Oktober 2026',
          nominal: 'Rp 1.620.000',
          rute: 'Dabo Singkep - Batam - Jakarta (PP)',
        }),
      },
    },
    spprItems: [],
    verification: {
      hariDisetujui: 3,
      tarifUangHarian: 170000,
      totalUangHarian: 510000,
      transportDisetujui: 1620000,
      gunakanSppr: false,
      totalDiterima: 2130000,
      statusBayar: 'SUDAH_DIBAYAR',
      noKuitansi: 'KUI/SPJ/2026/003',
      tanggalVerifikasi: '2026-10-29 15:30 WIB',
      verifikatorName: 'Rizky Pratama Putra, S.E.',
      catatanVerifikator:
        'Berkas fisik diinput via Helpdesk Proxy (Andi Saputra) dan telah dicocokkan dengan dokumen asli.',
    },
    updatedAt: '2026-10-29 15:30 WIB',
  },
  {
    id: 'pst-004',
    nama: 'Yohanes Kristianto, S.Kom.',
    email: 'yohanes.smkn2batam@gmail.com',
    nip: '199104222019031005',
    pangkatGolongan: GolonganType.GOL_III,
    jabatan: 'Operator Dapodik & ARKAS',
    instansi: 'SMK Negeri 2 Batam',
    kabupatenKota: 'Kota Batam',
    noHp: '085264119023',
    namaBank: 'Bank Mandiri',
    noRekening: '109-00-1827364-5',
    statusBerkas: DocumentStatus.BELUM_LENGKAP,
    inputMode: InputMode.MANDIRI,
    driveFolderId: 'DRV-FOLDER-199104222019031005',
    driveFolderName: '199104222019031005 - Yohanes Kristianto, S.Kom.',
    driveFolderUrl:
      'https://drive.google.com/drive/folders/PANITIA_199104222019031005',
    attendance: [
      {
        dayIndex: 1,
        tanggal: '2026-10-28',
        checkInTime: '08:19:50 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
      {
        dayIndex: 2,
        tanggal: '2026-10-29',
        checkInTime: '08:04:11 WIB',
        lokasi: 'Ballroom Utama Lt. 3 - Grand Mercure',
        koordinat: '-6.1538, 106.8499',
        recordedBy: 'Peserta Mandiri (Google Auth)',
        isProxy: false,
      },
    ],
    documents: {
      suratTugas: {
        fileName: 'SURAT_TUGAS_199104222019031005_Yohanes.jpg',
        uploadedAt: '2026-10-28 10:12 WIB',
        uploadedBy: 'Yohanes Kristianto, S.Kom.',
        isProxy: false,
        originalSizeKB: 3420,
        compressedSizeKB: 218,
        driveFileId: 'DRV-ST-004',
        driveViewUrl: 'https://drive.google.com/file/d/DRV-ST-004/view',
        dataUrl: createSimulatedDocSvg({
          docType: 'SURAT_TUGAS',
          nama: 'Yohanes Kristianto, S.Kom.',
          nip: '199104222019031005',
          instansi: 'SMK Negeri 2 Kota Batam',
          nomorDokumen: '800/419/SMKN2-BTM/X/2026',
          tanggal: '27 Oktober 2026',
        }),
      },
    },
    spprItems: [],
    verification: {
      hariDisetujui: 2,
      tarifUangHarian: 170000,
      totalUangHarian: 340000,
      transportDisetujui: 1150000,
      gunakanSppr: false,
      totalDiterima: 1490000,
      statusBayar: 'BELUM_DIBAYAR',
      noKuitansi: 'KUI/SPJ/2026/004',
      catatanVerifikator:
        'Menunggu peserta memotret lembar SPPD Visum & Tiket Transport (atau membuat SPPR).',
    },
    updatedAt: '2026-10-29 08:04 WIB',
  },
];

const initialSpeakers: SpeakerRecord[] = [
  {
    id: 'spk-001',
    nama: 'Prof. Dr. Irwan Syahputra, Ak., CA.',
    peran: SpeakerRole.NARASUMBER,
    instansi: 'Inspektorat Jenderal Kementerian / BPKP',
    golongan: GolonganType.GOL_IV,
    npwp: '08.412.991.4-215.000',
    hasNpwp: true,
    namaBank: 'BNI',
    noRekening: '0293847162',
    materiJudul: 'Mitigasi Temuan Audit BPK pada Pertanggungjawaban Perjalanan Dinas & SPJ Digital',
    jumlahJP: 4,
    tarifPerJP: 1000000,
    ...calculateHonorariumPPh21(4, 1000000, GolonganType.GOL_IV, true),
    noKuitansi: 'KUI/HONOR/2026/001',
    statusBayar: 'SUDAH_DIBAYAR',
    tanggalKegiatan: '2026-10-28',
  },
  {
    id: 'spk-002',
    nama: 'Dr. Rina Marlina, S.E., M.Si.',
    peran: SpeakerRole.NARASUMBER,
    instansi: 'Direktorat Jenderal Perbendaharaan (Kemenkeu)',
    golongan: GolonganType.GOL_IV,
    npwp: '09.118.442.1-012.000',
    hasNpwp: true,
    namaBank: 'Bank Mandiri',
    noRekening: '124-00-9988271-3',
    materiJudul: 'Penerapan Standar Biaya Masukan (PMK SBM) & Validasi Pengeluaran Riil (SPPR)',
    jumlahJP: 4,
    tarifPerJP: 900000,
    ...calculateHonorariumPPh21(4, 900000, GolonganType.GOL_IV, true),
    noKuitansi: 'KUI/HONOR/2026/002',
    statusBayar: 'SUDAH_DIBAYAR',
    tanggalKegiatan: '2026-10-29',
  },
  {
    id: 'spk-003',
    nama: 'Dedi Kurniawan, S.Pd., M.M.',
    peran: SpeakerRole.MODERATOR,
    instansi: 'BBPMP / Panitia Teknis',
    golongan: GolonganType.GOL_III,
    npwp: '74.229.110.8-215.000',
    hasNpwp: true,
    namaBank: 'BRI',
    noRekening: '0331-01-009281-53-2',
    materiJudul: 'Moderator Sesi Pleno Kebijakan & Diskusi Panel',
    jumlahJP: 2,
    tarifPerJP: 700000,
    ...calculateHonorariumPPh21(2, 700000, GolonganType.GOL_III, true),
    noKuitansi: 'KUI/HONOR/2026/003',
    statusBayar: 'TERVERIFIKASI',
    tanggalKegiatan: '2026-10-28',
  },
  {
    id: 'spk-004',
    nama: 'Nadia Putri Lestari, S.I.Kom.',
    peran: SpeakerRole.MC,
    instansi: 'Subbagian Protokol & Kehumasan',
    golongan: GolonganType.GOL_III,
    npwp: '81.902.331.2-215.000',
    hasNpwp: true,
    namaBank: 'BSI',
    noRekening: '7200192834',
    materiJudul: 'Pembawa Acara (MC) Pembukaan & Penutupan Resmi',
    jumlahJP: 2,
    tarifPerJP: 400000,
    ...calculateHonorariumPPh21(2, 400000, GolonganType.GOL_III, true),
    noKuitansi: 'KUI/HONOR/2026/004',
    statusBayar: 'TERVERIFIKASI',
    tanggalKegiatan: '2026-10-28',
  },
];

const initialPhotos: DocumentationPhoto[] = [
  {
    id: 'dok-001',
    kategori: PhotoCategory.SESI_UTAMA,
    judul: 'Pembukaan Resmi & Sidang Pleno Tata Kelola SPJ Kedinasan',
    caption:
      'Suasana pembukaan kegiatan dan pengarahan PPTK diikuti oleh seluruh peserta utusan Kabupaten/Kota di Ballroom Utama.',
    hariKe: 1,
    tanggal: '2026-10-28',
    timestamp: '2026-10-28 09:30 WIB',
    uploader: 'Seksi Dokumentasi (Fajar Pratama)',
    driveFileId: 'DRV-FOTO-SESI-01',
    originalSizeKB: 4480,
    compressedSizeKB: 310,
    imageUrl: createDocumentationSvg({
      kategori: PhotoCategory.SESI_UTAMA,
      judul: 'Pembukaan Resmi & Sidang Pleno Tata Kelola SPJ',
      hariKe: 1,
      tanggal: '28 Oktober 2026 · 09:30 WIB',
      themeColor: '#1E3A8A',
    }),
  },
  {
    id: 'dok-002',
    kategori: PhotoCategory.NARASUMBER,
    judul: 'Paparan Materi Mitigasi Audit BPK oleh Prof. Dr. Irwan Syahputra',
    caption:
      'Narasumber menyampaikan simulasi pemeriksaan bukti SPPD, tiket resmi, serta validitas penggunaan SPPR bagi daerah kepulauan.',
    hariKe: 1,
    tanggal: '2026-10-28',
    timestamp: '2026-10-28 13:45 WIB',
    uploader: 'Seksi Dokumentasi (Fajar Pratama)',
    driveFileId: 'DRV-FOTO-NARSUM-02',
    originalSizeKB: 3910,
    compressedSizeKB: 285,
    imageUrl: createDocumentationSvg({
      kategori: PhotoCategory.NARASUMBER,
      judul: 'Paparan Narasumber: Mitigasi Audit BPK & SBM',
      hariKe: 1,
      tanggal: '28 Oktober 2026 · 13:45 WIB',
      themeColor: '#065F46',
    }),
  },
  {
    id: 'dok-003',
    kategori: PhotoCategory.KONSUMSI_SNACK,
    judul: 'Penyediaan Konsumsi Prasmanan & Coffee Break Peserta',
    caption:
      'Dokumentasi pemenuhan standar layanan konsumsi dan kudapan (snack) peserta kegiatan sebagai lampiran bukti fisik belanja paket meeting.',
    hariKe: 2,
    tanggal: '2026-10-29',
    timestamp: '2026-10-29 10:15 WIB',
    uploader: 'Seksi Dokumentasi (Fajar Pratama)',
    driveFileId: 'DRV-FOTO-KONSUMSI-03',
    originalSizeKB: 3560,
    compressedSizeKB: 260,
    imageUrl: createDocumentationSvg({
      kategori: PhotoCategory.KONSUMSI_SNACK,
      judul: 'Layanan Coffee Break & Konsumsi Peserta',
      hariKe: 2,
      tanggal: '29 Oktober 2026 · 10:15 WIB',
      themeColor: '#9A3412',
    }),
  },
  {
    id: 'dok-004',
    kategori: PhotoCategory.AKTIVITAS_LAIN,
    judul: 'Layanan Meja Helpdesk Proxy & Klinik Verifikasi Dokumen Fisik',
    caption:
      'Panitia membantu peserta memotret berkas SPPD ber-visum dan pendampingan pencetakan Surat Pernyataan Pengeluaran Riil (SPPR).',
    hariKe: 2,
    tanggal: '2026-10-29',
    timestamp: '2026-10-29 15:00 WIB',
    uploader: 'Seksi Dokumentasi (Fajar Pratama)',
    driveFileId: 'DRV-FOTO-LAIN-04',
    originalSizeKB: 4120,
    compressedSizeKB: 295,
    imageUrl: createDocumentationSvg({
      kategori: PhotoCategory.AKTIVITAS_LAIN,
      judul: 'Meja Helpdesk Proxy & Klinik Verifikasi SPJ',
      hariKe: 2,
      tanggal: '29 Oktober 2026 · 15:00 WIB',
      themeColor: '#3730A3',
    }),
  },
];

const initialMaterials: ResourceMaterial[] = [
  {
    id: 'mat-001',
    judul: 'Modul 01 — Pedoman Standar Biaya Masukan (PMK SBM) & Perjalanan Dinas',
    narasumber: 'Dr. Rina Marlina, S.E., M.Si. (Kemenkeu)',
    kategori: 'Regulasi Keuangan',
    ukuranFile: '2.4 MB (PDF)',
    updatedAt: '28 Okt 2026',
    ringkasan:
      'Memuat rincian tarif uang harian perjalanan dinas dalam negeri, ketentuan tiket resmi, serta format baku Daftar Pengeluaran Riil (SPPR).',
  },
  {
    id: 'mat-002',
    judul: 'Modul 02 — Checklist Kepatuhan Audit BPK & Inspektorat untuk Bendahara',
    narasumber: 'Prof. Dr. Irwan Syahputra, Ak., CA.',
    kategori: 'Audit & Kepatuhan',
    ukuranFile: '3.1 MB (PDF)',
    updatedAt: '28 Okt 2026',
    ringkasan:
      'Daftar periksa kelengkapan Surat Tugas, SPPD ber-visum, kesesuaian tanggal tiket dengan penugasan, dan bukti potong PPh Pasal 21.',
  },
  {
    id: 'mat-003',
    judul: 'Template Resmi Surat Pernyataan Pengeluaran Riil (SPPR) Transport Lokal',
    narasumber: 'Sekretariat Panitia SIM-KANTOR',
    kategori: 'Template Dokumen',
    ukuranFile: '420 KB (DOCX/PDF)',
    updatedAt: '28 Okt 2026',
    ringkasan:
      'Panduan pengisian SPPR bagi peserta dari wilayah kepulauan/pedalaman yang menggunakan speedboat sewaan, ketinting, atau ojek lokal.',
  },
];

const initialAuditLogs: AuditLogEntry[] = [
  {
    id: 'aud-001',
    timestamp: '2026-10-28 08:16:12 WIB',
    actorName: 'Drs. Rahmat Hidayat, M.Pd.',
    actorRole: 'PESERTA',
    actionType: 'UPLOAD_DOKUMEN_MANDIRI',
    targetName: 'Drs. Rahmat Hidayat, M.Pd. (197605142002121003)',
    details:
      'Mengunggah Surat Tugas, SPPD Visum & Tiket Pesawat ke subfolder Google Drive Panitia (Kompresi Canvas 3.8MB -> 248KB).',
  },
  {
    id: 'aud-002',
    timestamp: '2026-10-28 08:45:30 WIB',
    actorName: 'Andi Saputra (Helpdesk Panitia)',
    actorRole: 'PANITIA_PROXY',
    actionType: 'PROXY_ASSISTED_UPLOAD',
    targetName: 'H. Burhanuddin, S.Ag. (196903101995031002)',
    details:
      'PROXY FLAG: Menginput biodata & memotret dokumen fisik peserta dari akun panitia. Alasan: Layar HP peserta rusak saat di kapal ferry.',
    isFlaggedProxy: true,
  },
  {
    id: 'aud-003',
    timestamp: '2026-10-28 09:15:04 WIB',
    actorName: 'Siti Aminah, S.Pd.SD.',
    actorRole: 'PESERTA',
    actionType: 'GENERATE_SPPR_TRANSPORT',
    targetName: 'Siti Aminah, S.Pd.SD. (198408192009032008)',
    details:
      'Men-generate draf PDF SPPR Nomor SPPR/2026/PST-002 senilai Rp 650.000 (Moda: Ketinting Laut Pulau Tiga & Ojek Lokal).',
  },
  {
    id: 'aud-004',
    timestamp: '2026-10-29 14:10:00 WIB',
    actorName: 'Rizky Pratama Putra, S.E.',
    actorRole: 'VERIFIKATOR_SPJ',
    actionType: 'VERIFIKASI_KEUANGAN_DISETUJUI',
    targetName: 'Drs. Rahmat Hidayat, M.Pd.',
    details:
      'Menyetujui SPJ KUI/SPJ/2026/001: Uang Harian 3 Hari (Rp 510.000) + Transport Riil (Rp 1.450.000) = Rp 1.960.000.',
  },
];

const appState: SimKantorState = {
  connectionMode: isLiveGoogleServiceConfigured()
    ? 'GOOGLE_SERVICE_ACCOUNT_LIVE'
    : 'HYBRID_AUDIT_SANDBOX',
  serviceAccountEmail:
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    'sim-kantor-bot@simkantor-instansi.iam.gserviceaccount.com',
  googleSheetId:
    process.env.GOOGLE_SHEET_ID || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  googleDriveParentFolderId:
    process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID || '1PANITIA_OFFICIAL_SPJ_ROOT_2026',
  config: initialConfig,
  participants: initialParticipants,
  speakers: initialSpeakers,
  photos: initialPhotos,
  materials: initialMaterials,
  auditLogs: initialAuditLogs,
};

function prependAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
  const nowStr =
    new Date().toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB';

  appState.auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: nowStr,
    ...entry,
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Izinkan payload JSON hingga 12MB untuk base64 gambar terkompresi
  app.use(express.json({ limit: '12mb' }));

  // 1. Ambil state lengkap SIM-KANTOR
  app.get('/api/simkantor/state', (_req, res) => {
    appState.connectionMode = isLiveGoogleServiceConfigured()
      ? 'GOOGLE_SERVICE_ACCOUNT_LIVE'
      : 'HYBRID_AUDIT_SANDBOX';
    res.json(appState);
  });

  // 2. Presensi / Check-in Harian Peserta (Mandiri atau Proxy)
  app.post('/api/simkantor/checkin', async (req, res) => {
    const { participantId, dayIndex, lokasi, koordinat, isProxy, proxyOfficerName } =
      req.body;

    const participant = appState.participants.find((p) => p.id === participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    }

    const dayNum = Number(dayIndex) || participant.attendance.length + 1;
    const alreadyChecked = participant.attendance.find((a) => a.dayIndex === dayNum);
    if (alreadyChecked) {
      return res.json({ state: appState, message: 'Sudah tercatat hadir pada hari ini.' });
    }

    const checkInTime =
      new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB';
    const tanggal = new Date().toISOString().slice(0, 10);

    participant.attendance.push({
      dayIndex: dayNum,
      tanggal,
      checkInTime,
      lokasi: lokasi || appState.config.lokasiKegiatan,
      koordinat: koordinat || '-6.1538, 106.8499',
      recordedBy: isProxy
        ? `PROXY: ${proxyOfficerName || 'Petugas Helpdesk'}`
        : 'Peserta Mandiri (Google Auth)',
      isProxy: Boolean(isProxy),
    });

    // Update kalkulasi hari hadir pada verifikasi keuangan
    participant.verification.hariDisetujui = participant.attendance.length;
    participant.verification.totalUangHarian =
      participant.verification.hariDisetujui * participant.verification.tarifUangHarian;
    participant.verification.totalDiterima =
      participant.verification.totalUangHarian +
      participant.verification.transportDisetujui;
    participant.updatedAt = checkInTime;

    await syncToGoogleDriveAndSheets({
      nip: participant.nip,
      nama: participant.nama,
      fileName: `PRESENSI_HARI_${dayNum}.txt`,
      sheetTab: 'Presensi_Harian',
      rowValues: [
        new Date().toISOString(),
        participant.nip,
        participant.nama,
        `Hari ke-${dayNum}`,
        checkInTime,
        lokasi || appState.config.lokasiKegiatan,
        isProxy ? `PROXY_BY_${proxyOfficerName}` : 'MANDIRI',
      ],
    });

    prependAuditLog({
      actorName: isProxy ? proxyOfficerName || 'Panitia Helpdesk' : participant.nama,
      actorRole: isProxy ? 'PANITIA_PROXY' : 'PESERTA',
      actionType: `CHECKIN_PRESENSI_HARI_${dayNum}`,
      targetName: `${participant.nama} (${participant.nip})`,
      details: `Check-in presensi Hari ke-${dayNum} pada pukul ${checkInTime} di ${
        lokasi || appState.config.lokasiKegiatan
      }. Total hadir: ${participant.attendance.length} hari.`,
      isFlaggedProxy: Boolean(isProxy),
    });

    return res.json({ state: appState });
  });

  // 3. Simpan / Update Biodata Peserta (Mandiri atau Tambah Peserta via Helpdesk Proxy)
  app.post('/api/simkantor/participant/upsert', async (req, res) => {
    const {
      id,
      nama,
      email,
      nip,
      pangkatGolongan,
      jabatan,
      instansi,
      kabupatenKota,
      noHp,
      namaBank,
      noRekening,
      inputMode,
      proxyOfficerName,
      proxyReason,
    } = req.body;

    let participant = appState.participants.find((p) => p.id === id || p.nip === nip);
    const isProxy = inputMode === InputMode.PROXY_PANITIA;

    if (!participant) {
      const newIndex = appState.participants.length + 1;
      const cleanNip = nip || `19900101202012100${newIndex}`;
      participant = {
        id: `pst-00${newIndex}`,
        nama,
        email: email || `${nama.toLowerCase().replace(/[^a-z]/g, '.')}@instansi.go.id`,
        nip: cleanNip,
        pangkatGolongan: pangkatGolongan || GolonganType.GOL_III,
        jabatan: jabatan || 'Staf Pelaksana / Utusan',
        instansi: instansi || 'Instansi Daerah',
        kabupatenKota: kabupatenKota || 'Kabupaten/Kota',
        noHp: noHp || '081200000000',
        namaBank: namaBank || 'BRI',
        noRekening: noRekening || '-',
        statusBerkas: DocumentStatus.BELUM_LENGKAP,
        inputMode: isProxy ? InputMode.PROXY_PANITIA : InputMode.MANDIRI,
        proxyOfficerName: isProxy ? proxyOfficerName : undefined,
        proxyReason: isProxy ? proxyReason : undefined,
        driveFolderId: `DRV-FOLDER-${cleanNip}`,
        driveFolderName: `${cleanNip} - ${nama}`,
        driveFolderUrl: `https://drive.google.com/drive/folders/PANITIA_${cleanNip}`,
        attendance: [
          {
            dayIndex: 1,
            tanggal: new Date().toISOString().slice(0, 10),
            checkInTime: new Date().toLocaleTimeString('id-ID') + ' WIB',
            lokasi: appState.config.lokasiKegiatan,
            koordinat: '-6.1538, 106.8499',
            recordedBy: isProxy ? `PROXY: ${proxyOfficerName}` : 'Peserta Mandiri',
            isProxy,
          },
        ],
        documents: {},
        spprItems: [],
        verification: {
          hariDisetujui: 1,
          tarifUangHarian: appState.config.tarifUangHarianSbm,
          totalUangHarian: appState.config.tarifUangHarianSbm,
          transportDisetujui: 0,
          gunakanSppr: false,
          totalDiterima: appState.config.tarifUangHarianSbm,
          statusBayar: 'BELUM_DIBAYAR',
          noKuitansi: `KUI/SPJ/${appState.config.tahunAnggaran}/00${newIndex}`,
          catatanVerifikator: isProxy
            ? `Peserta diinput melalui Helpdesk Proxy oleh ${proxyOfficerName} (${proxyReason}).`
            : 'Biodata terdaftar. Menunggu kelengkapan upload dokumen.',
        },
        updatedAt: new Date().toLocaleTimeString('id-ID') + ' WIB',
      };
      appState.participants.unshift(participant);
    } else {
      participant.nama = nama ?? participant.nama;
      participant.email = email ?? participant.email;
      participant.nip = nip ?? participant.nip;
      participant.pangkatGolongan = pangkatGolongan ?? participant.pangkatGolongan;
      participant.jabatan = jabatan ?? participant.jabatan;
      participant.instansi = instansi ?? participant.instansi;
      participant.kabupatenKota = kabupatenKota ?? participant.kabupatenKota;
      participant.noHp = noHp ?? participant.noHp;
      participant.namaBank = namaBank ?? participant.namaBank;
      participant.noRekening = noRekening ?? participant.noRekening;
      participant.driveFolderName = `${participant.nip} - ${participant.nama}`;
      if (isProxy) {
        participant.inputMode = InputMode.PROXY_PANITIA;
        participant.proxyOfficerName = proxyOfficerName;
        participant.proxyReason = proxyReason;
      }
      participant.updatedAt = new Date().toLocaleTimeString('id-ID') + ' WIB';
    }

    await syncToGoogleDriveAndSheets({
      nip: participant.nip,
      nama: participant.nama,
      fileName: 'BIODATA_PESERTA.json',
      sheetTab: 'Peserta',
      rowValues: [
        new Date().toISOString(),
        participant.nip,
        participant.nama,
        participant.pangkatGolongan,
        participant.instansi,
        participant.kabupatenKota,
        participant.noHp,
        participant.namaBank,
        participant.noRekening,
        participant.inputMode,
        participant.proxyReason || '-',
      ],
    });

    prependAuditLog({
      actorName: isProxy ? proxyOfficerName || 'Panitia Helpdesk' : participant.nama,
      actorRole: isProxy ? 'PANITIA_PROXY' : 'PESERTA',
      actionType: isProxy ? 'PROXY_BIODATA_UPSERT' : 'UPDATE_BIODATA_MANDIRI',
      targetName: `${participant.nama} (${participant.nip})`,
      details: isProxy
        ? `PROXY FLAG: Biodata peserta disimpan oleh petugas ${proxyOfficerName}. Kendala peserta: ${proxyReason}. Folder Google Drive Panitia: /${participant.driveFolderName}/`
        : `Memperbarui biodata & rekening penerima (${participant.namaBank} ${participant.noRekening}).`,
      isFlaggedProxy: isProxy,
    });

    return res.json({ state: appState, participantId: participant.id });
  });

  // 4. Upload Dokumen Kamera (Surat Tugas, SPPD/Visum, Bukti Transport, atau Bukti Bayar Susulan Verifikator)
  app.post('/api/simkantor/participant/upload-doc', async (req, res) => {
    const {
      participantId,
      docType, // 'suratTugas' | 'sppdVisum' | 'buktiTransport' | 'buktiBayarSusulan'
      dataUrl,
      originalSizeKB,
      compressedSizeKB,
      uploadedBy,
      isProxy,
      isLateFinanceUpload,
      auditNote,
      nominalTransport,
    } = req.body;

    const participant = appState.participants.find((p) => p.id === participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    }

    const prefixMap: Record<string, string> = {
      suratTugas: 'SURAT_TUGAS',
      sppdVisum: 'SPPD_VISUM',
      buktiTransport: 'TIKET_TRANSPORT',
      buktiBayarSusulan: 'BUKTI_SUSULAN_KEUANGAN',
    };
    const prefix = prefixMap[docType] || 'DOKUMEN';
    const cleanName = participant.nama.replace(/[^a-zA-Z0-9]/g, '_');
    const standardizedFileName = `${
      isProxy ? 'PROXY_' : ''
    }${prefix}_${participant.nip}_${cleanName}.jpg`;

    const syncResult = await syncToGoogleDriveAndSheets({
      nip: participant.nip,
      nama: participant.nama,
      fileName: standardizedFileName,
      base64DataUrl: dataUrl,
      sheetTab: 'Dokumen_Drive',
      rowValues: [
        new Date().toISOString(),
        participant.nip,
        participant.nama,
        prefix,
        standardizedFileName,
        `${compressedSizeKB} KB`,
        uploadedBy || participant.nama,
        auditNote || 'OK',
      ],
    });

    const driveFileId = syncResult.fileId || `DRV-${prefix}-${Date.now().toString().slice(-5)}`;
    const uploadedDoc = {
      fileName: standardizedFileName,
      uploadedAt:
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
        ' WIB',
      uploadedBy: uploadedBy || participant.nama,
      isProxy: Boolean(isProxy),
      isLateFinanceUpload: Boolean(isLateFinanceUpload),
      auditNote: auditNote || undefined,
      originalSizeKB: Number(originalSizeKB) || 2400,
      compressedSizeKB: Number(compressedSizeKB) || 220,
      driveFileId,
      driveViewUrl:
        syncResult.fileUrl || `https://drive.google.com/file/d/${driveFileId}/view`,
      dataUrl,
    };

    if (docType === 'suratTugas') {
      participant.documents.suratTugas = uploadedDoc;
    } else if (docType === 'sppdVisum') {
      participant.documents.sppdVisum = uploadedDoc;
    } else if (docType === 'buktiTransport') {
      participant.documents.buktiTransport = uploadedDoc;
      if (nominalTransport !== undefined && Number(nominalTransport) > 0) {
        participant.verification.transportDisetujui = Number(nominalTransport);
        participant.verification.gunakanSppr = false;
        participant.verification.totalDiterima =
          participant.verification.totalUangHarian +
          participant.verification.transportDisetujui;
      }
    } else if (docType === 'buktiBayarSusulan') {
      participant.documents.buktiBayarSusulan = uploadedDoc;
    }

    // Evaluasi otomatis status kelengkapan berkas peserta
    const hasSt = Boolean(participant.documents.suratTugas);
    const hasSppd = Boolean(participant.documents.sppdVisum);
    const hasTransport = Boolean(
      participant.documents.buktiTransport ||
        participant.documents.spprGenerated ||
        participant.documents.buktiBayarSusulan
    );

    if (
      hasSt &&
      hasSppd &&
      hasTransport &&
      participant.statusBerkas === DocumentStatus.BELUM_LENGKAP
    ) {
      participant.statusBerkas = DocumentStatus.MENUNGGU_VERIFIKASI;
    }

    prependAuditLog({
      actorName: uploadedBy || participant.nama,
      actorRole: isLateFinanceUpload
        ? 'VERIFIKATOR_SPJ'
        : isProxy
        ? 'PANITIA_PROXY'
        : 'PESERTA',
      actionType: isLateFinanceUpload
        ? 'UPLOAD_BUKTI_SUSULAN_VERIFIKATOR'
        : `UPLOAD_${prefix}`,
      targetName: `${participant.nama} (${participant.nip})`,
      details: `File ${standardizedFileName} (${uploadedDoc.originalSizeKB}KB -> ${
        uploadedDoc.compressedSizeKB
      }KB) tersimpan di Google Drive Panitia /${participant.driveFolderName}/. ${
        auditNote ? `Catatan Audit: ${auditNote}` : ''
      }`,
      isFlaggedProxy: Boolean(isProxy || isLateFinanceUpload),
    });

    return res.json({ state: appState });
  });

  // 5. Simpan & Generate Surat Pernyataan Pengeluaran Riil (SPPR - Smart Transport)
  app.post('/api/simkantor/participant/sppr', async (req, res) => {
    const { participantId, items, actorName, isProxy } = req.body as {
      participantId: string;
      items: SpprItem[];
      actorName?: string;
      isProxy?: boolean;
    };

    const participant = appState.participants.find((p) => p.id === participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    }

    participant.spprItems = items;
    const totalSppr = items.reduce((sum, item) => sum + (Number(item.nominal) || 0), 0);
    const nomorSppr = `SPPR/${appState.config.tahunAnggaran}/${participant.id.toUpperCase()}`;

    participant.documents.spprGenerated = {
      nomorSppr,
      generatedAt:
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
        ' WIB',
      totalNominal: totalSppr,
      items,
      driveFileId: `DRV-SPPR-${participant.nip}`,
    };

    participant.verification.transportDisetujui = totalSppr;
    participant.verification.gunakanSppr = true;
    participant.verification.totalDiterima =
      participant.verification.totalUangHarian + totalSppr;

    if (participant.documents.suratTugas && participant.documents.sppdVisum) {
      if (participant.statusBerkas === DocumentStatus.BELUM_LENGKAP) {
        participant.statusBerkas = DocumentStatus.MENUNGGU_VERIFIKASI;
      }
    }

    prependAuditLog({
      actorName: actorName || participant.nama,
      actorRole: isProxy ? 'PANITIA_PROXY' : 'PESERTA',
      actionType: 'GENERATE_SPPR_TRANSPORT_RIIL',
      targetName: `${participant.nama} (${participant.nip})`,
      details: `Membuat SPPR Nomor ${nomorSppr} (${items.length} rute lokal non-tiket) dengan total Rp ${totalSppr.toLocaleString(
        'id-ID'
      )}. Tersimpan di Google Drive Panitia.`,
      isFlaggedProxy: Boolean(isProxy),
    });

    return res.json({ state: appState });
  });

  // 6. Verifikasi Keuangan Peserta (Pusat SPJ Tab 1)
  app.post('/api/simkantor/finance/verify', async (req, res) => {
    const {
      participantId,
      hariDisetujui,
      tarifUangHarian,
      transportDisetujui,
      gunakanSppr,
      statusBerkas,
      statusBayar,
      catatanVerifikator,
      verifikatorName,
    } = req.body;

    const participant = appState.participants.find((p) => p.id === participantId);
    if (!participant) {
      return res.status(404).json({ error: 'Peserta tidak ditemukan.' });
    }

    const hari = Math.max(0, Number(hariDisetujui));
    const tarif = Math.max(0, Number(tarifUangHarian));
    const transport = Math.max(0, Number(transportDisetujui));
    const totalUh = hari * tarif;
    const totalAll = totalUh + transport;

    participant.statusBerkas = statusBerkas || DocumentStatus.TERVERIFIKASI;
    participant.verification = {
      ...participant.verification,
      hariDisetujui: hari,
      tarifUangHarian: tarif,
      totalUangHarian: totalUh,
      transportDisetujui: transport,
      gunakanSppr: Boolean(gunakanSppr),
      totalDiterima: totalAll,
      statusBayar: statusBayar || 'SIAP_BAYAR',
      catatanVerifikator: catatanVerifikator || participant.verification.catatanVerifikator,
      verifikatorName: verifikatorName || appState.config.namaBendahara,
      tanggalVerifikasi:
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
        ' WIB',
    };

    await syncToGoogleDriveAndSheets({
      nip: participant.nip,
      nama: participant.nama,
      fileName: `VERIFIKASI_SPJ_${participant.nip}.json`,
      sheetTab: 'Keuangan_SPJ',
      rowValues: [
        new Date().toISOString(),
        participant.nip,
        participant.nama,
        hari,
        tarif,
        totalUh,
        transport,
        totalAll,
        participant.statusBerkas,
        participant.verification.statusBayar,
        catatanVerifikator || '-',
      ],
    });

    prependAuditLog({
      actorName: verifikatorName || appState.config.namaBendahara,
      actorRole: 'VERIFIKATOR_SPJ',
      actionType: `VERIFIKASI_SPJ_${participant.statusBerkas}`,
      targetName: `${participant.nama} (${participant.nip})`,
      details: `Status: ${participant.statusBerkas} (${
        participant.verification.statusBayar
      }). Uang Harian: ${hari} hr x Rp ${tarif.toLocaleString(
        'id-ID'
      )} = Rp ${totalUh.toLocaleString(
        'id-ID'
      )} | Transport: Rp ${transport.toLocaleString(
        'id-ID'
      )} | Total: Rp ${totalAll.toLocaleString('id-ID')}.`,
    });

    return res.json({ state: appState });
  });

  // 7. Tambah / Update Narasumber & Petugas (Pusat SPJ Tab 2)
  app.post('/api/simkantor/speakers/upsert', async (req, res) => {
    const {
      id,
      nama,
      peran,
      instansi,
      golongan,
      npwp,
      hasNpwp,
      namaBank,
      noRekening,
      materiJudul,
      jumlahJP,
      tarifPerJP,
      statusBayar,
    } = req.body;

    const calc = calculateHonorariumPPh21(
      Number(jumlahJP),
      Number(tarifPerJP),
      golongan as GolonganType,
      Boolean(hasNpwp)
    );

    const existing = appState.speakers.find((s) => s.id === id);
    if (existing) {
      existing.nama = nama;
      existing.peran = peran;
      existing.instansi = instansi;
      existing.golongan = golongan;
      existing.npwp = npwp;
      existing.hasNpwp = Boolean(hasNpwp);
      existing.namaBank = namaBank;
      existing.noRekening = noRekening;
      existing.materiJudul = materiJudul;
      existing.jumlahJP = Number(jumlahJP);
      existing.tarifPerJP = Number(tarifPerJP);
      existing.bruto = calc.bruto;
      existing.tarifPph21Persen = calc.tarifPph21Persen;
      existing.potonganPph21 = calc.potonganPph21;
      existing.netto = calc.netto;
      existing.statusBayar = statusBayar || existing.statusBayar;
    } else {
      const idx = appState.speakers.length + 1;
      appState.speakers.push({
        id: `spk-00${idx}`,
        nama,
        peran: peran || SpeakerRole.NARASUMBER,
        instansi: instansi || 'Instansi Narasumber',
        golongan: golongan || GolonganType.GOL_IV,
        npwp: npwp || '-',
        hasNpwp: Boolean(hasNpwp),
        namaBank: namaBank || 'BNI',
        noRekening: noRekening || '-',
        materiJudul: materiJudul || 'Paparan Materi Sesi Kegiatan',
        jumlahJP: Number(jumlahJP) || 2,
        tarifPerJP: Number(tarifPerJP) || 900000,
        ...calc,
        noKuitansi: `KUI/HONOR/${appState.config.tahunAnggaran}/00${idx}`,
        statusBayar: statusBayar || 'TERVERIFIKASI',
        tanggalKegiatan: new Date().toISOString().slice(0, 10),
      });
    }

    prependAuditLog({
      actorName: appState.config.namaBendahara,
      actorRole: 'VERIFIKATOR_SPJ',
      actionType: 'VERIFIKASI_HONOR_NARASUMBER',
      targetName: `${nama} (${peran})`,
      details: `Honorarium ${jumlahJP} JP: Bruto Rp ${calc.bruto.toLocaleString(
        'id-ID'
      )}, PPh 21 (${calc.tarifPph21Persen}%): Rp ${calc.potonganPph21.toLocaleString(
        'id-ID'
      )}, Netto: Rp ${calc.netto.toLocaleString('id-ID')}.`,
    });

    return res.json({ state: appState });
  });

  // 8. Upload Foto Seksi Dokumentasi (Modul D)
  app.post('/api/simkantor/documentation/upload', async (req, res) => {
    const {
      kategori,
      judul,
      caption,
      hariKe,
      uploader,
      imageUrl,
      originalSizeKB,
      compressedSizeKB,
    } = req.body;

    const newIndex = appState.photos.length + 1;
    const tanggal = new Date().toISOString().slice(0, 10);
    const driveFileId = `DRV-FOTO-0${newIndex}-${Date.now().toString().slice(-4)}`;

    const finalImageUrl =
      imageUrl ||
      createDocumentationSvg({
        kategori: kategori || PhotoCategory.SESI_UTAMA,
        judul: judul || 'Dokumentasi Kegiatan Kedinasan',
        hariKe: Number(hariKe) || 1,
        tanggal,
        themeColor: '#1E3A8A',
      });

    appState.photos.unshift({
      id: `dok-00${newIndex}`,
      kategori: kategori || PhotoCategory.SESI_UTAMA,
      judul: judul || 'Dokumentasi Kegiatan',
      caption: caption || '-',
      hariKe: Number(hariKe) || 1,
      tanggal,
      timestamp:
        `${tanggal} ` +
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
        ' WIB',
      uploader: uploader || 'Seksi Dokumentasi',
      driveFileId,
      originalSizeKB: Number(originalSizeKB) || 3200,
      compressedSizeKB: Number(compressedSizeKB) || 260,
      imageUrl: finalImageUrl,
    });

    prependAuditLog({
      actorName: uploader || 'Seksi Dokumentasi',
      actorRole: 'DOKUMENTASI',
      actionType: 'UPLOAD_FOTO_DOKUMENTASI',
      targetName: `[${kategori}] ${judul}`,
      details: `Mengunggah foto dokumentasi Hari ke-${hariKe} ke folder Google Drive Panitia (${driveFileId}).`,
    });

    return res.json({ state: appState });
  });

  // 9. Update Konfigurasi Kegiatan & Tarif SBM (Modul E - PPTK)
  app.put('/api/simkantor/config', (req, res) => {
    const newConfig = req.body as Partial<ActivityConfig>;
    const oldSbm = appState.config.tarifUangHarianSbm;
    appState.config = {
      ...appState.config,
      ...newConfig,
    };

    // Jika tarif SBM uang harian berubah, sinkronkan kalkulasi uang harian peserta
    if (
      newConfig.tarifUangHarianSbm &&
      Number(newConfig.tarifUangHarianSbm) !== oldSbm
    ) {
      const updatedTarif = Number(newConfig.tarifUangHarianSbm);
      appState.participants.forEach((p) => {
        p.verification.tarifUangHarian = updatedTarif;
        p.verification.totalUangHarian = p.verification.hariDisetujui * updatedTarif;
        p.verification.totalDiterima =
          p.verification.totalUangHarian + p.verification.transportDisetujui;
      });
    }

    prependAuditLog({
      actorName: appState.config.namaPptk,
      actorRole: 'PPTK',
      actionType: 'UPDATE_PARAMETER_SBM_DPA',
      targetName: appState.config.nomorDpa,
      details: `Memperbarui konfigurasi kegiatan & tarif SBM Uang Harian menjadi Rp ${appState.config.tarifUangHarianSbm.toLocaleString(
        'id-ID'
      )}/hari.`,
    });

    return res.json({ state: appState });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIM-KANTOR Server running on http://localhost:${PORT}`);
  });
}

startServer();

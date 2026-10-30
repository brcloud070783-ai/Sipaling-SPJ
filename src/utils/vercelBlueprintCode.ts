export interface BlueprintCodeFile {
  id: string;
  fileName: string;
  title: string;
  description: string;
  language: string;
  code: string;
}

export const VERCEL_SERVERLESS_FILES: BlueprintCodeFile[] = [
  {
    id: 'google-service',
    fileName: 'api/_lib/googleService.js',
    title: '1. Koneksi Google Cloud Service Account (Sheets & Drive Panitia)',
    description:
      'Menginisialisasi JWT Auth menggunakan Service Account tanpa Google Apps Script. Otomatis membuat subfolder peserta di Google Drive Panitia dan menulis log ke Google Sheets.',
    language: 'javascript',
    code: `// api/_lib/googleService.js
import { google } from 'googleapis';
import { Readable } from 'stream';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

export function getGoogleClients() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Kredensial GOOGLE_SERVICE_ACCOUNT_EMAIL atau GOOGLE_PRIVATE_KEY belum diset di Vercel Environment.');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  return { auth, sheets, drive };
}

/**
 * Mencari atau membuat otomatis subfolder khusus Peserta di dalam Folder Google Drive Panitia:
 * Struktur: /[Folder_Induk_Panitia]/[NIP - Nama Peserta]/
 */
export async function ensureParticipantDriveFolder(drive, parentFolderId, nip, nama) {
  const folderName = \`\${nip} - \${nama.replace(/[^a-zA-Z0-9 .,()-]/g, '')}\`;

  const searchRes = await drive.files.list({
    q: \`'\${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '\${folderName}' and trashed = false\`,
    fields: 'files(id, name, webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return searchRes.data.files[0];
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id, name, webViewLink',
    supportsAllDrives: true,
  });

  return createRes.data;
}

/**
 * Mengunggah Buffer Base64 (hasil kompresi kamera HP) langsung ke Google Drive milik Panitia
 */
export async function uploadBase64ToPanitiaDrive(drive, folderId, fileName, base64DataUrl) {
  const matches = base64DataUrl.match(/^data:([A-Za-z-+\\/]+);base64,(.+)$/);
  const mimeType = matches ? matches[1] : 'image/jpeg';
  const base64Payload = matches ? matches[2] : base64DataUrl;
  const buffer = Buffer.from(base64Payload, 'base64');

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, name, webViewLink, webContentLink',
    supportsAllDrives: true,
  });

  return response.data;
}`,
  },
  {
    id: 'peserta-upload',
    fileName: 'api/peserta/upload-dokumen.js',
    title: '2. Endpoint Serverless Upload Kamera & Biodata Peserta / Proxy',
    description:
      'Vercel Serverless Function untuk menyimpan biodata peserta, mengunggah hasil foto Surat Tugas/SPPD/Tiket ke Google Drive Panitia, dan mencatat baris audit di Google Sheets.',
    language: 'javascript',
    code: `// api/peserta/upload-dokumen.js
import {
  getGoogleClients,
  ensureParticipantDriveFolder,
  uploadBase64ToPanitiaDrive,
} from '../_lib/googleService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      nama,
      nip,
      instansi,
      kabupatenKota,
      noHp,
      email,
      jenisDokumen, // 'SURAT_TUGAS' | 'SPPD_VISUM' | 'BUKTI_TRANSPORT' | 'SPPR'
      base64Image,
      inputMode, // 'MANDIRI' | 'PROXY_PANITIA'
      proxyOfficerName,
      proxyReason,
    } = req.body;

    const { sheets, drive } = getGoogleClients();
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    // 1. Pastikan folder peserta tersedia di Google Drive Panitia
    const folder = await ensureParticipantDriveFolder(drive, parentFolderId, nip, nama);

    // 2. Upload file gambar yang sudah dikompresi ke folder peserta
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const standardizedFileName = \`\${jenisDokumen}_\${nip}_\${nama.replace(/\\s+/g, '_')}_\${timestamp}.jpg\`;
    const uploadedFile = await uploadBase64ToPanitiaDrive(
      drive,
      folder.id,
      standardizedFileName,
      base64Image
    );

    // 3. Catat ke Google Sheets (Tab: Peserta_Dokumen & Audit_Log)
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Peserta_Dokumen!A:K',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toISOString(),
          nip,
          nama,
          instansi,
          kabupatenKota,
          noHp,
          email,
          jenisDokumen,
          uploadedFile.webViewLink,
          inputMode,
          inputMode === 'PROXY_PANITIA' ? \`PROXY BY \${proxyOfficerName}: \${proxyReason}\` : 'MANDIRI_PESERTA',
        ]],
      },
    });

    return res.status(200).json({
      success: true,
      folderUrl: folder.webViewLink,
      fileId: uploadedFile.id,
      fileUrl: uploadedFile.webViewLink,
    });
  } catch (error) {
    console.error('SIM-KANTOR Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}`,
  },
  {
    id: 'verifikasi-spj',
    fileName: 'api/keuangan/verifikasi-spj.js',
    title: '3. Endpoint Serverless Verifikasi Keuangan SPJ & Pajak PPh 21',
    description:
      'Menyimpan hasil verifikasi nominal Uang Harian (Hari Hadir x SBM), Transport/SPPR, dan Honorarium Narasumber beserta catatan audit ke Google Sheets.',
    language: 'javascript',
    code: `// api/keuangan/verifikasi-spj.js
import { getGoogleClients } from '../_lib/googleService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      nip,
      nama,
      hariDisetujui,
      tarifUangHarian,
      transportDisetujui,
      gunakanSppr,
      verifikatorName,
      catatanVerifikator,
      statusBerkas,
    } = req.body;

    const totalUangHarian = Number(hariDisetujui) * Number(tarifUangHarian);
    const totalDiterima = totalUangHarian + Number(transportDisetujui);

    const { sheets } = getGoogleClients();
    const sheetId = process.env.GOOGLE_SHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Keuangan_SPJ!A:J',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toISOString(),
          nip,
          nama,
          hariDisetujui,
          tarifUangHarian,
          totalUangHarian,
          transportDisetujui,
          gunakanSppr ? 'SPPR_TRANSPORT_LOKAL' : 'TIKET_RESMI',
          totalDiterima,
          \`\${statusBerkas} oleh \${verifikatorName} (\${catatanVerifikator || '-'}) \`,
        ]],
      },
    });

    return res.status(200).json({
      success: true,
      totalUangHarian,
      totalDiterima,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}`,
  },
  {
    id: 'vercel-json',
    fileName: 'vercel.json',
    title: '4. Konfigurasi Deployment Vercel (vercel.json)',
    description:
      'Mengatur batas memori dan durasi eksekusi Vercel Serverless Functions untuk pemrosesan upload dokumen ke Google Drive.',
    language: 'json',
    code: `{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}`,
  },
];

export const SERVICE_ACCOUNT_SETUP_STEPS = [
  {
    step: '01',
    title: 'Buat Project & Aktifkan API di Google Cloud Console',
    detail:
      'Buka console.cloud.google.com, buat project baru (misal: sim-kantor-instansi), lalu masuk ke menu "APIs & Services > Library" dan aktifkan dua API wajib: (1) Google Sheets API dan (2) Google Drive API.',
  },
  {
    step: '02',
    title: 'Buat Google Service Account & Unduh Kunci JSON',
    detail:
      'Masuk ke "IAM & Admin > Service Accounts > Create Service Account". Beri nama sim-kantor-bot. Pada tab "Keys", klik "Add Key > Create new key > JSON". Simpan file JSON yang terunduh.',
  },
  {
    step: '03',
    title: 'Bagikan (Share) Folder Google Drive Panitia & Google Sheet ke Email Bot',
    detail:
      'Salin alamat client_email dari file JSON (contoh: sim-kantor-bot@....iam.gserviceaccount.com). Buka Folder Induk Google Drive milik Panitia dan file Google Sheets Database, klik "Bagikan (Share)", lalu tambahkan email Service Account tersebut sebagai "Editor". Ini menjamin 100% file masuk ke Drive Panitia, bukan Drive peserta.',
  },
  {
    step: '04',
    title: 'Pasang Variabel Environment di Dashboard Vercel',
    detail:
      'Pada project Vercel Anda ("Settings > Environment Variables"), tambahkan: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (isi private_key dari JSON), GOOGLE_SHEET_ID, dan GOOGLE_DRIVE_PARENT_FOLDER_ID.',
  },
];

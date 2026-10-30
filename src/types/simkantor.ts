export enum AppModule {
  PESERTA = 'PESERTA',
  PROXY_PANITIA = 'PROXY_PANITIA',
  VERIFIKATOR_SPJ = 'VERIFIKATOR_SPJ',
  DOKUMENTASI = 'DOKUMENTASI',
  PPTK_EXECUTIVE = 'PPTK_EXECUTIVE',
}

export enum DocumentStatus {
  BELUM_LENGKAP = 'BELUM_LENGKAP',
  MENUNGGU_VERIFIKASI = 'MENUNGGU_VERIFIKASI',
  TERVERIFIKASI = 'TERVERIFIKASI',
  PERLU_REVISI = 'PERLU_REVISI',
}

export enum InputMode {
  MANDIRI = 'MANDIRI',
  PROXY_PANITIA = 'PROXY_PANITIA',
}

export enum GolonganType {
  GOL_I_II = 'Golongan I / II',
  GOL_III = 'Golongan III',
  GOL_IV = 'Golongan IV',
  NON_PNS = 'Non-ASN / Praktisi',
}

export enum SpeakerRole {
  NARASUMBER = 'Narasumber Utama',
  MODERATOR = 'Moderator Sesi',
  MC = 'Pembawa Acara (MC)',
  DOA = 'Pembaca Doa',
}

export enum PhotoCategory {
  SESI_UTAMA = 'Sesi Utama',
  NARASUMBER = 'Narasumber',
  KONSUMSI_SNACK = 'Konsumsi / Snack',
  AKTIVITAS_LAIN = 'Aktivitas Lain',
}

export interface SpprItem {
  id: string;
  tanggal: string;
  ruteAsal: string;
  ruteTujuan: string;
  modaTransport: string;
  alasanTanpaTiket: string;
  nominal: number;
}

export interface UploadedDocFile {
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  isProxy: boolean;
  isLateFinanceUpload?: boolean;
  auditNote?: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  driveFileId: string;
  driveViewUrl: string;
  dataUrl: string;
}

export interface ParticipantDocuments {
  suratTugas?: UploadedDocFile;
  sppdVisum?: UploadedDocFile;
  buktiTransport?: UploadedDocFile;
  spprGenerated?: {
    nomorSppr: string;
    generatedAt: string;
    totalNominal: number;
    items: SpprItem[];
    driveFileId: string;
  };
  buktiBayarSusulan?: UploadedDocFile;
}

export interface AttendanceRecord {
  dayIndex: number;
  tanggal: string;
  checkInTime: string;
  lokasi: string;
  koordinat: string;
  recordedBy: string;
  isProxy: boolean;
}

export interface FinanceVerification {
  hariDisetujui: number;
  tarifUangHarian: number;
  totalUangHarian: number;
  transportDisetujui: number;
  gunakanSppr: boolean;
  totalDiterima: number;
  statusBayar: 'BELUM_DIBAYAR' | 'SIAP_BAYAR' | 'SUDAH_DIBAYAR';
  noKuitansi: string;
  tanggalVerifikasi?: string;
  verifikatorName?: string;
  catatanVerifikator: string;
}

export interface ParticipantRecord {
  id: string;
  nama: string;
  email: string;
  nip: string;
  pangkatGolongan: GolonganType;
  jabatan: string;
  instansi: string;
  kabupatenKota: string;
  noHp: string;
  namaBank: string;
  noRekening: string;
  statusBerkas: DocumentStatus;
  inputMode: InputMode;
  proxyOfficerName?: string;
  proxyReason?: string;
  driveFolderId: string;
  driveFolderName: string;
  driveFolderUrl: string;
  attendance: AttendanceRecord[];
  documents: ParticipantDocuments;
  spprItems: SpprItem[];
  verification: FinanceVerification;
  updatedAt: string;
}

export interface SpeakerRecord {
  id: string;
  nama: string;
  peran: SpeakerRole;
  instansi: string;
  golongan: GolonganType;
  npwp: string;
  hasNpwp: boolean;
  namaBank: string;
  noRekening: string;
  materiJudul: string;
  jumlahJP: number;
  tarifPerJP: number;
  bruto: number;
  tarifPph21Persen: number;
  potonganPph21: number;
  netto: number;
  noKuitansi: string;
  statusBayar: 'TERVERIFIKASI' | 'SUDAH_DIBAYAR';
  tanggalKegiatan: string;
}

export interface DocumentationPhoto {
  id: string;
  kategori: PhotoCategory;
  judul: string;
  caption: string;
  hariKe: number;
  tanggal: string;
  timestamp: string;
  uploader: string;
  driveFileId: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  imageUrl: string;
}

export interface ResourceMaterial {
  id: string;
  judul: string;
  narasumber: string;
  kategori: string;
  ukuranFile: string;
  updatedAt: string;
  ringkasan: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: 'PESERTA' | 'PANITIA_PROXY' | 'VERIFIKATOR_SPJ' | 'DOKUMENTASI' | 'PPTK';
  actionType: string;
  targetName: string;
  details: string;
  isFlaggedProxy?: boolean;
}

export interface ActivityConfig {
  namaKegiatan: string;
  instansiPenyelenggara: string;
  satuanKerja: string;
  tahunAnggaran: number;
  nomorDpa: string;
  kodeMak: string;
  lokasiKegiatan: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jumlahHariKegiatan: number;
  namaPptk: string;
  nipPptk: string;
  namaPpk: string;
  nipPpk: string;
  namaBendahara: string;
  nipBendahara: string;
  tarifUangHarianSbm: number;
  plafonTransportLokal: number;
  paguDpaTotal: number;
  paguUangHarian: number;
  paguTransportPeserta: number;
  paguHonorNarasumber: number;
  paguKonsumsiOperasional: number;
  realisasiKonsumsiOperasional: number;
}

export interface SimKantorState {
  connectionMode: 'GOOGLE_SERVICE_ACCOUNT_LIVE' | 'HYBRID_AUDIT_SANDBOX';
  serviceAccountEmail: string;
  googleSheetId: string;
  googleDriveParentFolderId: string;
  config: ActivityConfig;
  participants: ParticipantRecord[];
  speakers: SpeakerRecord[];
  photos: DocumentationPhoto[];
  materials: ResourceMaterial[];
  auditLogs: AuditLogEntry[];
}

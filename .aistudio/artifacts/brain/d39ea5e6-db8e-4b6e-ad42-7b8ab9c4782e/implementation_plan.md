# Sistem Informasi Manajemen Kegiatan Kedinasan (SIM-KANTOR)

Platform manajemen kegiatan kedinasan dan pertanggungjawaban keuangan (SPJ) terpadu yang menghubungkan peserta, panitia helpdesk, verifikator keuangan, tim dokumentasi, dan PPTK dengan penyimpanan terpusat di Google Sheets & Google Drive Panitia yang siap diaudit oleh BPK/Inspektorat.

### User Review & Critical Decisions

> [!IMPORTANT]
> Berikut adalah keputusan produk dan arsitektur yang telah dikonfirmasi dari tahap klarifikasi dan menjadi landasan pembangunan aplikasi:

- **Cakupan Modul Terintegrasi (Confirmed)**: Membangun kelima modul fungsional secara lengkap dan interaktif dalam satu aplikasi web (Dashboard Peserta Mobile-First, Panitia & Helpdesk Proxy Mode, Pusat SPJ Verifikator Keuangan & Narasumber, Seksi Dokumentasi, serta Executive Dashboard PPTK), dilengkapi panel Kode & Panduan Deploy Vercel Serverless (`googleapis`) siap pakai.
- **Arsitektur Penyimpanan Hybrid Google APIs (Confirmed)**: Backend mendukung integrasi langsung ke Google Sheets dan Google Drive milik panitia menggunakan Google Cloud Service Account (`googleapis`) saat kredensial environment dikonfigurasi, serta otomatis berjalan dalam Mode Simulasi Audit-Ready (sinkronisasi penyimpanan persisten server + pratinjau struktur folder Google Drive Panitia) agar seluruh fitur dapat diuji coba secara langsung tanpa hambatan.
- **Standar Tarif SBM & Kop Dokumen (Confirmed)**: Menggunakan standar PMK Standar Biaya Masukan (SBM) Nasional sebagai bawaan untuk kalkulator uang harian, biaya transport, dan honorarium/PPh 21 narasumber, disertai pengaturan parameter kegiatan (nama instansi, nomor DIPA/DPA, tarif SBM, lokasi kegiatan) yang dapat diubah secara dinamis oleh panitia.

---

### 1. Overview & Core Concept

- **What It Does**: Mengotomatiskan siklus administrasi dan SPJ kegiatan kedinasan mulai dari registrasi peserta dengan identitas Google, presensi harian berbasis waktu server & lokasi, pemotretan dokumen langsung dari kamera ponsel dengan kompresi otomatis di sisi klien, pembuatan Surat Pernyataan Pengeluaran Riil (SPPR) untuk transport non-tiket resmi, hingga verifikasi keuangan side-by-side dan pencetakan 1-klik dokumen SPJ resmi (Rekap Nominatif, Kuitansi dengan Terbilang Otomatis, BAST, Honorarium PPh 21, dan Master Laporan Akhir PPTK).
- **Target Audience / Persona**:
  - **Peserta Kegiatan**: Pegawai/utusan instansi atau sekolah yang membutuhkan antarmuka cepat di smartphone untuk absen, memotret Surat Tugas/SPPD/tiket, membuat SPPR, dan mengunduh materi.
  - **Panitia Helpdesk (Proxy)**: Petugas meja registrasi yang membantu peserta terkendala perangkat dengan jejak audit (`PROXY_INPUT_BY_COMMITTEE`) yang transparan.
  - **Verifikator Keuangan (Bendahara/Staf SPJ)**: Pemeriksa dokumen di layar desktop yang memvalidasi bukti fisik terhadap nominal uang harian/transport dan mencetak bendel SPJ.
  - **Seksi Dokumentasi**: Tim lapangan yang mengunggah foto kegiatan berkategori beserta keterangan untuk Laporan Dokumentasi.
  - **PPTK / Pejabat Pembuat Komitmen**: Pengambil keputusan yang memantau serapan pagu DPA secara real-time dan mengunduh Master Laporan Akhir Kegiatan siap jilid.
- **Key Value**: Menghilangkan risiko tercecernya berkas fisik dan kendala hak akses file di Google Drive pribadi peserta karena seluruh dokumen masuk ke struktur folder terpusat milik panitia dengan penamaan standar audit BPK/Inspektorat.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Alur Peserta (Mobile-First Ergonomics)**: Peserta masuk dengan identitas Google -> melihat Smart Alert Banner status kelengkapan berkas -> menekan tombol Check-In Presensi Harian (validasi waktu server & geolokasi kegiatan) -> mengisi biodata (Nama, NIP, Instansi, Golongan, No. HP, Bank/Rekening) -> memotret Surat Tugas, SPPD/Visum, dan Bukti Transport melalui kamera ponsel (otomatis dikompresi & diberi cap metadata) -> jika memakai transport lokal tanpa tiket (ketinting/ojek/sewa), mengisi form Smart Transport untuk mencetak PDF SPPR otomatis -> mengakses Pusat Materi & Galeri Harian.
  2. **Alur Panitia Helpdesk (Proxy Mode)**: Panitia memilih mode Proxy -> mencari atau menambah peserta yang terkendala perangkat -> menginput biodata, presensi manual beralasan, dan memotret dokumen fisik peserta -> sistem mencatat flag audit `PROXY_BY_PANITIA` beserta nama petugas dan alasan bantuan.
  3. **Alur Verifikator Keuangan (Split-Screen SPJ Workstation)**:
     - *Tab 1 (Verifikasi Peserta)*: Memilih baris peserta dari tabel antrean -> layar kanan menampilkan pratinjau gambar Surat Tugas, SPPD, dan Tiket/SPPR berdampingan dengan kalkulator uang harian (`Hari Hadir × Tarif SBM`) dan validasi transport -> menyetujui atau meminta revisi -> mengunggah bukti bayar/transfer susulan dengan catatan audit -> mencetak PDF Rekap Uang Harian Nominatif, Kuitansi Pembayaran (dengan fungsi Terbilang Otomatis), Rekap Transport, BAST, atau Bendel Arsip Lengkap per peserta.
     - *Tab 2 (Verifikasi Narasumber & Petugas)*: Menginput/memverifikasi Narasumber, Moderator, MC, dan Pembaca Doa (Golongan/Pangkat, Status PNS/Non-PNS, NPWP, No. Rekening, Jam Pelajaran/JP) -> kalkulator otomatis menghitung Honorarium Bruto, Tarif PPh 21 (`0%` Gol I-II, `5%` Gol III, `15%` Gol IV, atau tarif Non-PNS), dan Netto Diterima -> mencetak Daftar Nominatif Honorarium & Kuitansi Narasumber.
  4. **Alur Seksi Dokumentasi**: Memilih kategori foto (`Sesi Utama`, `Narasumber`, `Konsumsi/Snack`, `Aktivitas Lain`) -> memotret/mengunggah foto dengan kompresi otomatis, waktu pengambilan, dan caption -> mencetak PDF Laporan Dokumentasi Kegiatan berformat tabel foto resmi.
  5. **Alur PPTK Executive Dashboard & Kode Vercel**: Memantau barometer kehadiran harian, grafik serapan anggaran Pagu DPA terhadap realisasi (Uang Harian, Transport, Honorarium, Konsumsi/Operasional) -> mengunduh PDF Master Laporan Akhir Pelaksanaan Kegiatan (gabungan eksekutif, rekap kehadiran, rekap keuangan SPJ, dan dokumentasi foto) -> membuka modal Arsitektur & Kode Vercel Serverless untuk menyalin kode backend produksi dan panduan konfigurasi Google Cloud Service Account.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: **Institutional Precision & Civic Modernism** — memadukan ketegasan tata kelola pemerintahan yang kredibel dan bersih dengan ketajaman aplikasi finansial modern.
  - *Color Palette & Mood* (60-30-10 Discipline):
    - **60% Dominant Neutral Canvas**: Crisp Alabaster Slate (`#F8FAFC`) untuk ruang kerja utama dan Pure White (`#FFFFFF`) untuk permukaan dokumen dan tabel.
    - **30% Structural Surfaces**: Deep Institutional Navy (`#0F172A`) untuk bilah navigasi utama dan header dokumen resmi, dipadukan dengan garis pembatas halus (`#E2E8F0`) dan teks sekunder (`#475569`).
    - **10% Accent & Semantic Budget**: Royal Civic Blue (`#1D4ED8`) untuk aksi utama; Emerald Audit (`#15803D`) untuk berkas lengkap/terverifikasi; Amber Review (`#B45309`) untuk berkas menunggu verifikasi/mode proxy; Crimson Alert (`#B91C1C`) untuk berkas kurang/ditolak. Setiap status selalu disertai teks label eksplisit (bukan hanya warna).
  - *Typography & Hierarchy* (2+1 Font Rule):
    - **Display & Headings**: `Plus Jakarta Sans` (SemiBold/Bold 600–700) dengan `text-wrap: balance` untuk judul modul dan ringkasan eksekutif.
    - **Body & Form Controls**: `Public Sans` (Regular/Medium 400–500) untuk keterbacaan formulir pemerintahan dan dokumen resmi yang padat.
    - **Data, NIP, Nominal Rupiah & Audit Timestamps**: `JetBrains Mono` dengan `font-variant-numeric: tabular-nums` agar seluruh angka keuangan, NIP, dan perhitungan pajak sejajar sempurna secara vertikal.
  - *Component Styling & Layout*:
    - Mengikuti **Top Bar Contract** satu baris dengan 3 zona tegas: Identitas SIM-KANTOR di kiri, 5 tautan modul utama (`Peserta`, `Helpdesk Proxy`, `Verifikator SPJ`, `Dokumentasi`, `PPTK & Laporan`) di tengah, dan tombol akses `Kode Vercel & Konfigurasi` di kanan.
    - Pada tampilan mobile peserta, menggunakan ergonomika **Natural Thumb Zone** dengan target sentuh minimal `44×44px` dan navigasi bawah yang ringkas (maksimal <15% tinggi layar).
    - Pada tampilan desktop Verifikator dan PPTK, memanfaatkan kanvas lebar penuh (`1440px` baseline) dengan tabel berdensitas tinggi dan panel inspeksi dokumen *side-by-side* satu tingkat elevasi (tanpa kartu bersarang).
    - Metadata status dan jejak audit ditampilkan sebagai teks bersih dengan pemisah tipografis (`·` / `/`) sesuai prinsip *Zero-Pill Discipline*.

- **Interactive Feedback & Motion**:
  - Transisi antar-tab dan pembukaan pratinjau dokumen merespons dalam `<150ms` menggunakan properti kompositor (`opacity`, `transform`).
  - Indikator kompresi gambar real-time saat peserta/panitia mengambil foto dokumen (menampilkan ukuran asli vs ukuran setelah kompresi Canvas JPEG sebelum diunggah).
  - Generator PDF menghasilkan dokumen berformat cetak resmi (lengkap dengan Kop Instansi, tabel nominatif rapi, kolom tanda tangan PPK/PPTK/Bendahara, dan QR/ID Audit) yang langsung dapat dilihat di jendela pratinjau cetak maupun diunduh.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Pemrosesan & Kompresi Kamera di Sisi Klien sebelum Upload ke Google Drive Panitia**
  - *Chosen Approach*: Menggunakan HTML5 `<input type="file" accept="image/*" capture="environment">` yang diproses melalui HTML5 Canvas untuk mereduksi resolusi ke batas optimal audit (maks lebar 1600px, kualitas JPEG 0.78) sebelum dikirim ke endpoint Serverless.
  - *Why*: Kamera smartphone modern menghasilkan foto 8–15 MB yang sering gagal diunggah pada jaringan lokasi kegiatan yang lemah dan melampaui batas payload Vercel Serverless Function (4.5 MB). Kompresi di klien memangkas ukuran menjadi ~250–400 KB dengan ketajaman teks Surat Tugas/SPPD yang tetap terbaca jelas oleh BPK.
  - *Alternatives Considered*: Upload file mentah langsung ke backend, yang berisiko terkena error `413 Payload Too Large` di Vercel.

- **Decision 2: Mesin Konversi "Terbilang Otomatis" & Kalkulator Pajak PPh 21 Deterministik**
  - *Chosen Approach*: Membangun fungsi utilitas deterministik bahasa Indonesia (`terbilangRupiah`) dan kalkulator PPh 21 sesuai regulasi PMK (Golongan I/II: 0%, Golongan III: 5%, Golongan IV: 15% dengan kepemilikan NPWP) yang terhubung langsung ke state verifikator dan generator kuitansi.
  - *Why*: Kesalahan penulisan angka terbilang pada kuitansi manual dan salah hitung potongan pajak narasumber adalah temuan administratif paling umum dalam pemeriksaan Inspektorat/BPK.

- **Decision 3: Mode Penyimpanan Hybrid (Live Google Service Account + Local Audit Store)**
  - *Chosen Approach*: Backend API memeriksa ketersediaan kredensial `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, dan `GOOGLE_DRIVE_PARENT_FOLDER_ID`. Jika tersedia, API langsung membuat subfolder per peserta (`[NIP] - [Nama Peserta]`) di Google Drive Panitia dan mencatat baris ke Google Sheets (`Peserta`, `Presensi`, `Keuangan_SPJ`, `Narasumber`, `Dokumentasi`, `Audit_Log`). Jika belum dikonfigurasi di environment pratinjau, backend menyimpan perubahan secara persisten di memori server disertai simulasi struktur folder Drive Panitia dan data awal yang realistis.
  - *Why*: Memastikan aplikasi langsung berfungsi 100% saat diuji coba oleh pengguna, sekaligus menyediakan kode produksi Vercel Serverless yang autentik dan siap dihubungkan ke Google Cloud.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        SIM-KANTOR UNIFIED WEB APPLICATION                            │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  Top Navigation Bar (3-Zone Contract)                                                │
│  [SIM-KANTOR] ── [Peserta | Helpdesk Proxy | Verifikator SPJ | Dokumentasi | PPTK]   │
│                  ── [Kode Vercel & Panduan Service Account]                          │
└───────────────┬──────────────────────────────────────────────────────┬───────────────┘
                │                                                      │
   ┌────────────▼────────────┐                            ┌────────────▼────────────┐
   │  CLIENT WORKSPACE VIEWS │                            │  DOCUMENT & PDF ENGINE  │
   ├─────────────────────────┤                            ├─────────────────────────┤
   │ • Modul A: Peserta      │                            │ • SPPR (Transport Riil) │
   │   - Google Identity     │                            │ • Kuitansi + Terbilang  │
   │   - Presensi Harian     │                            │ • Nominatif Uang Harian │
   │   - Camera Capture +    │                            │ • Rekap & Bukti Transp. │
   │     Canvas Compressor   │                            │ • BAST & Bendel Peserta │
   │   - Smart Transport SPPR│                            │ • Nominatif Honor + PPh │
   │   - Materi & Galeri     │                            │ • Laporan Dokumentasi   │
   │ • Modul B: Proxy Mode   │                            │ • Master Laporan PPTK   │
   │   - Assisted Input +    │                            └────────────▲────────────┘
   │     Audit Trail Flag    │                                         │
   │ • Modul C: Pusat SPJ    │                            ┌────────────┴────────────┐
   │   - Tab 1: Split-Screen │                            │ DETERMINISTIC UTILITIES │
   │     Doc Viewer & Calc   │                            ├─────────────────────────┤
   │   - Tab 2: Narasumber & │                            │ • terbilangRupiah()     │
   │     PPh 21 Calculator   │                            │ • calculateSBM()        │
   │ • Modul D: Dokumentasi  │                            │ • calculatePPh21()      │
   │   - Categorized Photo   │                            │ • compressImageCanvas() │
   │ • Modul E: PPTK Exec    │                            └─────────────────────────┘
   │   - Attendance & DPA    │
   └────────────┬────────────┘
                │ REST JSON / Base64 Compressed Upload
┌───────────────▼──────────────────────────────────────────────────────────────────────┐
│                     SERVERLESS API LAYER (/api/simkantor/*)                          │
│  • POST /api/auth/google-verify     • POST /api/participants/upsert                  │
│  • POST /api/attendance/checkin     • POST /api/documents/upload                     │
│  • POST /api/sppr/generate          • POST /api/finance/verify                       │
│  • POST /api/speakers/upsert        • POST /api/documentation/upload                 │
│  • PUT  /api/config/sbm             • GET  /api/state & /api/vercel-blueprint        │
└─────────────────────────┬────────────────────────────────────────┬───────────────────┘
                          │                                        │
        ┌─────────────────▼──────────────────┐   ┌─────────────────▼──────────────────┐
        │   GOOGLE CLOUD SERVICE ACCOUNT     │   │    HYBRID AUDIT SANDBOX STORE      │
        │   (googleapis - Production Mode)   │   │   (Active when Env Vars Empty)     │
        ├────────────────────────────────────┤   ├────────────────────────────────────┤
        │ • Google Drive API v3:             │   │ • Mirrors exact Sheets tabs &      │
        │   Auto-creates Panitia Folder      │   │   Panitia Drive folder tree        │
        │   /[Kegiatan]/[NIP_Nama_Peserta]/  │   │ • Pre-seeded with realistic        │
        │ • Google Sheets API v4:            │   │   participants, SPPD scans,        │
        │   Tabs: Peserta, Presensi, SPJ,    │   │   speakers, photos & DPA budget    │
        │   Narasumber, Dokumentasi, Audit   │   │ • Full CRUD & live audit logging   │
        └────────────────────────────────────┘   └────────────────────────────────────┘
```

- **Data Model & State**:
  - **ActivityConfig**: Nama Kegiatan, Instansi Penyelenggara, Tahun Anggaran, Nomor DIPA/DPA, Pagu Anggaran Total, Lokasi & Tanggal Kegiatan, serta Parameter Tarif SBM (Uang Harian Fullboard/Fullday, Plafon Transport Lokal, Tarif Honor Eselon/Golongan).
  - **ParticipantRecord**: `id`, `nama`, `nip`, `pangkatGolongan`, `instansi`, `kabupatenKota`, `noHp`, `email`, `namaBank`, `noRekening`, `statusBerkas` (`BELUM_LENGKAP` | `MENUNGGU_VERIFIKASI` | `TERVERIFIKASI` | `PERLU_REVISI`), `inputMode` (`MANDIRI` | `PROXY_PANITIA`), `proxyOfficerName`, `proxyReason`, `driveFolderId`, `driveFolderUrl`, `attendanceDays` (array tanggal & timestamp check-in), `documents` (Surat Tugas, SPPD/Visum, Tiket Transport, SPPR, Bukti Transfer Susulan), `spprData` (daftar item rute transport riil без tiket & alasan), dan `verification` (jumlah hari disetujui, tarif uang harian, total uang harian, total transport disetujui, catatan verifikator, status bayar, waktu verifikasi).
  - **SpeakerRecord (Narasumber & Petugas)**: `id`, `nama`, `peran` (`NARASUMBER` | `MODERATOR` | `MC` | `DOA`), `instansi`, `golongan` (`III` | `IV` | `II` | `NON_PNS`), `npwp`, `namaBank`, `noRekening`, `jumlahJP`, `tarifPerJP`, `bruto`, `tarifPajakPersen`, `potonganPPh21`, `netto`, `materiTitle`, `materiUrl`, `statusVerifikasi`.
  - **DocumentationPhoto**: `id`, `kategori` (`SESI_UTAMA` | `NARASUMBER` | `KONSUMSI_SNACK` | `AKTIVITAS_LAIN`), `judul`, `caption`, `hariKe`, `timestamp`, `uploader`, `imageUrl`, `driveFileId`.
  - **AuditLogEntry**: `id`, `timestamp`, `actorName`, `actorRole`, `actionType`, `targetParticipant`, `details`.

- **Interactive Component & State Mapping**:
  - **Modul A (Peserta)**:
    - *Simulasi / Login Identitas Google*: Mengisi otomatis nama & email peserta atau memilih profil peserta aktif untuk menguji skenario peserta yang berbeda.
    - *Check-in Harian*: Menambahkan rekaman kehadiran hari berjalan dengan timestamp server dan koordinat lokasi kegiatan, langsung memperbarui jumlah hari hadir pada kalkulator uang harian.
    - *Kamera & Upload Berkas*: Memilih foto dari kamera/perangkat -> dikompresi dengan Canvas -> diunggah ke server -> otomatis membuat/memperbarui struktur folder Google Drive Panitia (`Drive Panitia / Peserta / [NIP] - [Nama]`) dan mengubah Smart Alert Banner.
    - *Generator SPPR (Smart Transport)*: Menambahkan rincian perjalanan lokal tanpa tiket (misal: sewa ketinting penyeberangan pulau atau ojek pedalaman), menghitung total riil, menyimpan ke berkas peserta sebagai pengganti/pendamping tiket, dan membuka cetak PDF SPPR resmi.
  - **Modul B (Helpdesk Proxy Mode)**:
    - *Form Input Bantuan Panitia*: Memilih peserta atau membuat peserta baru, memasukkan Nama Petugas Panitia & alasan kendala (`HP Rusak`, `Tidak Bawa Smartphone`, `Kendala Teknis/Usia`), mengunggah foto dokumen fisik, dan mencatat entri khusus di `Audit_Log`.
  - **Modul C (Verifikator Keuangan - Pusat SPJ)**:
    - *Split-Screen Inspeksi*: Mengklik peserta di tabel kiri langsung memuat gambar dokumen di panel tengah dan kalkulator nominal di panel kanan. Perubahan jumlah hari atau nominal transport langsung memperbarui *Terbilang Otomatis* dan total penyerapan anggaran DPA.
    - *Upload Bukti Bayar Susulan*: Verifikator dapat mengunggah bukti tiket/transfer susulan pasca-kegiatan yang langsung tercatat di log audit.
    - *1-Click PDF Generators*: Setiap tombol cetak (`Rekap Nominatif Uang Harian`, `Kuitansi Pembayaran`, `Rekap Transport`, `BAST`, `Bendel Lengkap Peserta`, `Daftar Nominatif & Kuitansi Narasumber`) menghasilkan dokumen cetak berformat resmi dengan fungsi *Terbilang Rupiah* otomatis.
  - **Modul D (Seksi Dokumentasi)**:
    - *Upload & Filter Kategori*: Mengunggah foto dengan kompresi otomatis, menyaring galeri berdasarkan 4 kategori wajib, dan men-generate PDF `Laporan Dokumentasi Kegiatan`.
  - **Modul E (PPTK Executive Dashboard & Blueprint Vercel)**:
    - *Monitoring Real-Time & Pengaturan SBM*: Menampilkan persentase kehadiran, rincian penyerapan Pagu DPA per pos belanja, tabel log audit BPK, editor pengaturan SBM/Kegiatan, serta tombol cetak `Master Laporan Akhir Pelaksanaan Kegiatan (PDF)`.
    - *Modal Kode & Panduan Vercel Serverless*: Menyajikan kode sumber lengkap file Serverless Function Vercel (`api/google-service.js`, `api/upload-drive.js`, `api/sheets-sync.js`, `vercel.json`) dengan tombol *Copy Code* dan panduan langkah demi langkah konfigurasi Google Cloud Service Account.

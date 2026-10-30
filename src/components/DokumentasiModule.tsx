import React, { useState } from 'react';
import { Camera, Image as ImageIcon, Printer, Upload } from 'lucide-react';
import {
  ActivityConfig,
  DocumentationPhoto,
  PhotoCategory,
} from '../types/simkantor';
import {
  generateLaporanDokumentasiDocument,
  PrintableDocumentPayload,
} from '../utils/pdfGenerator';
import { compressImageFile, createDocumentationSvg } from '../utils/spjCalculators';

interface DokumentasiModuleProps {
  config: ActivityConfig;
  photos: DocumentationPhoto[];
  onUploadPhoto: (payload: {
    kategori: PhotoCategory;
    judul: string;
    caption: string;
    hariKe: number;
    uploader: string;
    imageUrl?: string;
    originalSizeKB?: number;
    compressedSizeKB?: number;
  }) => Promise<void>;
  onOpenDocumentPreview: (doc: PrintableDocumentPayload) => void;
}

export const DokumentasiModule: React.FC<DokumentasiModuleProps> = ({
  config,
  photos,
  onUploadPhoto,
  onOpenDocumentPreview,
}) => {
  const [kategori, setKategori] = useState<PhotoCategory>(PhotoCategory.SESI_UTAMA);
  const [judul, setJudul] = useState('');
  const [caption, setCaption] = useState('');
  const [hariKe, setHariKe] = useState<number>(1);
  const [uploader, setUploader] = useState('Seksi Dokumentasi (Fajar Pratama)');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [sizeInfo, setSizeInfo] = useState<{ orig: number; comp: number } | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFile(file, 1400, 0.8);
    setPreviewDataUrl(compressed.dataUrl);
    setSizeInfo({
      orig: compressed.originalSizeKB,
      comp: compressed.compressedSizeKB,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim() || !caption.trim()) return;
    setIsUploading(true);
    try {
      const finalImage =
        previewDataUrl ||
        createDocumentationSvg({
          kategori,
          judul: judul.trim(),
          hariKe,
          tanggal: new Date().toLocaleDateString('id-ID'),
          themeColor: '#1E3A8A',
        });

      await onUploadPhoto({
        kategori,
        judul: judul.trim(),
        caption: caption.trim(),
        hariKe,
        uploader,
        imageUrl: finalImage,
        originalSizeKB: sizeInfo?.orig || 3600,
        compressedSizeKB: sizeInfo?.comp || 275,
      });

      setJudul('');
      setCaption('');
      setPreviewDataUrl(null);
      setSizeInfo(null);
      setToast(
        'Foto dokumentasi kegiatan berhasil diunggah ke Google Drive Panitia & siap dimasukkan ke Laporan PDF.'
      );
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredPhotos =
    filterCategory === 'ALL'
      ? photos
      : photos.filter((p) => p.kategori === filterCategory);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-950">
          {toast}
        </div>
      )}

      {/* Header Modul D & Tombol Cetak Laporan Dokumentasi PDF */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700">
              <ImageIcon className="h-4 w-4" />
              <span>MODUL D — SEKSI DOKUMENTASI KEGIATAN (MOBILE &amp; DESKTOP)</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900">
              Arsip Foto Kegiatan Terstruktur &amp; Generator Laporan Dokumentasi
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Setiap foto dikelompokkan berdasarkan 4 kategori bukti fisik pemeriksaan
              (Sesi Utama, Narasumber, Konsumsi/Snack, Aktivitas Lain).
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenDocumentPreview(generateLaporanDokumentasiDocument(photos, config))
            }
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4" />
            <span>Generator Laporan Dokumentasi Kegiatan (PDF)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Form Upload Foto Ber-kategori */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <h2 className="text-base font-bold text-slate-900">
              Form Upload Foto Dokumentasi Kegiatan
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Kategori Bukti Dokumentasi
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as PhotoCategory)}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  {Object.values(PhotoCategory).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Pelaksanaan Hari Ke-
                </label>
                <select
                  value={hariKe}
                  onChange={(e) => setHariKe(Number(e.target.value))}
                  className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                >
                  <option value={1}>Hari ke-1</option>
                  <option value={2}>Hari ke-2</option>
                  <option value={3}>Hari ke-3</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Judul Foto / Sesi Kegiatan
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Sesi Diskusi Kelompok Penyusunan RKAS..."
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Caption / Keterangan Lengkap (Tampil di Laporan PDF)
              </label>
              <textarea
                rows={3}
                required
                placeholder="Tuliskan deskripsi waktu, narasumber, atau aktivitas yang berlangsung dalam foto..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Petugas Seksi Dokumentasi
              </label>
              <input
                type="text"
                value={uploader}
                onChange={(e) => setUploader(e.target.value)}
                className="mt-1 w-full min-h-[42px] rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            {/* Pemilih Kamera / File Foto */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-600 transition-colors">
                  <Camera className="h-4 w-4" />
                  <span>Ambil Foto Kamera / Galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                {sizeInfo && (
                  <span className="font-mono text-[11px] text-emerald-800">
                    Terkompresi: {sizeInfo.orig} KB &rarr; {sizeInfo.comp} KB
                  </span>
                )}
              </div>

              {previewDataUrl && (
                <img
                  src={previewDataUrl}
                  alt="Pratinjau Unggahan"
                  className="mt-3 h-36 w-full rounded border border-slate-200 object-cover"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <Upload className="h-4 w-4" />
              <span>Simpan Foto ke Google Drive Panitia</span>
            </button>
          </form>
        </div>

        {/* Right: Galeri Terstruktur per Kategori */}
        <div className="lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Daftar Foto Dokumentasi ({filteredPhotos.length})
              </h2>

              <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setFilterCategory('ALL')}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    filterCategory === 'ALL'
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Semua
                </button>
                {Object.values(PhotoCategory).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFilterCategory(cat)}
                    className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                      filterCategory === cat
                        ? 'bg-white text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                >
                  <img
                    src={photo.imageUrl}
                    alt={photo.judul}
                    referrerPolicy="no-referrer"
                    className="h-44 w-full object-cover"
                  />
                  <div className="p-3.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-bold text-blue-700">{photo.kategori}</span>
                      <span aria-hidden="true">·</span>
                      <span>Hari ke-{photo.hariKe}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{photo.compressedSizeKB} KB</span>
                    </div>
                    <h3 className="mt-1 text-xs font-bold text-slate-900">
                      {photo.judul}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {photo.caption}
                    </p>
                    <div className="mt-2 border-t border-slate-200 pt-2 font-mono text-[10px] text-slate-500">
                      Drive ID: {photo.driveFileId} · Oleh: {photo.uploader}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

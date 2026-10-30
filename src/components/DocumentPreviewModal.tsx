import React, { useRef } from 'react';
import { Download, FileCheck2, Printer, X } from 'lucide-react';
import { PrintableDocumentPayload } from '../utils/pdfGenerator';

interface DocumentPreviewModalProps {
  doc: PrintableDocumentPayload | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  doc,
  onClose,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  if (!doc) return null;

  const fullHtmlDocument = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${doc.title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm;
    }
    body {
      font-family: 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      line-height: 1.45;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${doc.htmlContent}
</body>
</html>`;

  const handlePrintPdf = () => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([fullHtmlDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = doc.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <FileCheck2 className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="font-mono">{doc.docCode}</span>
              <span aria-hidden="true">·</span>
              <span>Dokumen Standar Pemeriksaan BPK / Inspektorat</span>
            </div>
            <h2 className="mt-1 truncate text-lg font-bold text-white">{doc.title}</h2>
            <p className="truncate text-xs text-slate-300">{doc.subtitle}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-100 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4" />
              <span>Unduh File Arsip</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau dokumen"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Document Sheet Preview Area */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-6">
          <div className="mx-auto max-w-4xl rounded-lg border border-slate-300 bg-white shadow-sm">
            <iframe
              ref={iframeRef}
              title={doc.title}
              srcDoc={fullHtmlDocument}
              className="h-[72vh] w-full rounded-lg border-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Paperclip, Pencil, Trash2, Eye, Upload } from 'lucide-react';

// ——— Types ———
export type ProjectRow = {
  id: string;
  name: string;
  date: string; // ISO or display string
  attached: number; // count of files attached
  ocrText?: string; // optional OCR text preview
  previewUrl?: string; // Object URL/Data URL for preview
};

// ——— Helpers ———
function formatDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ——— Component ———
export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate from localStorage if available
  const [rows, setRows] = useState<ProjectRow[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('AHA_ROWS');
        if (cached) return JSON.parse(cached) as ProjectRow[];
      } catch {}
    }
    return [
      {
        id: 'PX-1001',
        name: 'Oil Filter Audit',
        date: formatDate('2025-10-14'),
        attached: 2,
      },
      {
        id: 'PX-1002',
        name: 'Breakfast Forecast',
        date: formatDate('2025-10-18'),
        attached: 0,
      },
      {
        id: 'PX-1003',
        name: 'SAFE Prep Photos',
        date: formatDate('2025-10-21'),
        attached: 4,
      },
    ];
  });

  // Persist rows to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('AHA_ROWS', JSON.stringify(rows));
    } catch {}
  }, [rows]);

  const [isUploading, setUploading] = useState(false);
  const hasData = useMemo(() => rows.length > 0, [rows]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const objectUrl = URL.createObjectURL(file);

    // Create a new row immediately; populate OCR text after processing
    const newId = `PX-${uid().toUpperCase()}`;
    const newRow: ProjectRow = {
      id: newId,
      name: file.name.replace(/\.[^.]+$/, '') || 'Untitled Attachment',
      date: formatDate(new Date()),
      attached: 1,
      previewUrl: objectUrl,
    };
    setRows((prev) => [newRow, ...prev]);

    try {
      const text = await runEasyOCR(file);
      setRows((prev) =>
        prev.map((r) => (r.id === newId ? { ...r, ocrText: text } : r))
      );
    } catch (err) {
      console.error(err);
      // Leave row without OCR text on failure
    } finally {
      setUploading(false);
      // reset input so same file can be selected again if desired
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /**
   * Calls an OCR endpoint. By default this posts to /api/ocr expecting JSON { text } back.
   * With node-easyocr, implement the /api/ocr route to do the OCR server-side.
   */
  async function runEasyOCR(file: File): Promise<string> {
    const endpoint = '/api/ocr';

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch(endpoint, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) throw new Error(`OCR failed with ${res.status}`);
      const data = (await res.json()) as { text?: string };
      return data.text ?? '';
    } catch (e) {
      console.warn(
        'Falling back to mock OCR text. Replace runEasyOCR with your real backend.'
      );
      await new Promise((r) => setTimeout(r, 600));
      return 'Sample OCR text (replace with EasyOCR output).';
    }
  }

  function handleDelete(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <main className="min-h-dvh bg-gray-50 text-gray-900 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              AHA Project
            </h1>
            <p className="text-sm text-gray-600">
              Main projects overview · OCR-enabled attachments
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              id="file-upload"
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm hover:shadow md:text-base"
              disabled={isUploading}
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Uploading…' : 'Add Attachment'}
            </button>
          </div>
        </header>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Attached</th>
                <th className="px-4 py-3 font-medium">Accions</th>
              </tr>
            </thead>
            <tbody>
              {hasData ? (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3 font-mono text-[13px]">{r.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium">{r.name}</span>
                          {r.ocrText ? (
                            <span
                              className="mt-0.5 line-clamp-1 text-xs text-gray-500"
                              title={r.ocrText}
                            >
                              {r.ocrText}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs">
                        <Paperclip className="h-3.5 w-3.5" /> {r.attached}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/views/view?id=${encodeURIComponent(r.id)}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs hover:bg-gray-100"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Link>
                        <button
                          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs hover:bg-gray-100"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50/60 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-100"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No projects yet. Use{' '}
                    <span className="font-medium">Add Attachment</span> to
                    create one from an image or PDF.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer hint */}
        <p className="mt-4 text-xs text-gray-500">
          OCR uses your EasyOCR backend via{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">/api/ocr</code>.
          Replace the endpoint in{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">runEasyOCR()</code>{' '}
          if you host it elsewhere.
        </p>
      </div>
    </main>
  );
}

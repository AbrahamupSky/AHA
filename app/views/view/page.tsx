'use client';

import React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Download, Paperclip } from 'lucide-react';

// Keep in sync with the type on the main page
export type ProjectRow = {
  id: string;
  name: string;
  date: string;
  attached: number;
  ocrText?: string;
  previewUrl?: string;
};

function getRowFromCache(id: string): ProjectRow | null {
  try {
    const cached = localStorage.getItem('AHA_ROWS');
    if (!cached) return null;
    const rows = JSON.parse(cached) as ProjectRow[];
    return rows.find(r => r.id === id) ?? null;
  } catch {
    return null;
  }
}

export default function ViewPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id') || '';
  const [row, setRow] = React.useState<ProjectRow | null>(null);
  const [edited, setEdited] = React.useState<string>('');
  const [findWord, setFindWord] = React.useState('');
  const [replaceWord, setReplaceWord] = React.useState('');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    const r = getRowFromCache(id);
    setRow(r);
    setEdited(r?.ocrText ?? '');
    setSaved(false);
  }, [id]);

  function copyText() {
    const txt = edited || row?.ocrText || '';
    if (!txt) return;
    navigator.clipboard.writeText(txt).catch(() => {});
  };
  

  function downloadText() {
    const txt = edited || row?.ocrText || '';
    if (!txt) return;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(row?.name || row?.id || 'ocr')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function persistUpdate(updated: Partial<ProjectRow>) {
    if (!row) return;
    try {
      const cached = localStorage.getItem('AHA_ROWS');
      if (!cached) return;
      const list = JSON.parse(cached) as ProjectRow[];
      const next = list.map((r) => (r.id === row.id ? { ...r, ...updated } : r));
      localStorage.setItem('AHA_ROWS', JSON.stringify(next));
      setRow((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch {}
  }

  function saveEdits() {
    persistUpdate({ ocrText: edited });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  function resetEdits() {
    setEdited(row?.ocrText ?? '');
    setSaved(false);
  }

  function applyFindReplace() {
    if (!findWord) return;
    const escaped = findWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    setEdited((prev) => prev.replace(re, replaceWord));
  }

  if (!id) {
    return (
      <main className="min-h-dvh bg-gray-50 p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            Missing id parameter.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-gray-50 text-gray-900 p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm text-gray-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {row ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Image / Preview */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Attachment</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-700">
                  <Paperclip className="h-3.5 w-3.5" /> {row.attached}
                </span>
              </div>

              {row.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.previewUrl}
                  alt={row.name}
                  className="w-full rounded-xl border border-gray-100 object-contain"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
                  No preview available.
                </div>
              )}

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">ID</dt>
                  <dd className="font-mono">{row.id}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Date</dt>
                  <dd>{row.date}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium">{row.name}</dd>
                </div>
              </dl>
            </section>

            {/* Right: OCR Text */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">OCR Result</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyText}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs hover:bg-gray-100"
                    disabled={!row.ocrText}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  <button
                    onClick={downloadText}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs hover:bg-gray-100"
                    disabled={!row.ocrText}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
                <input
                  value={findWord}
                  onChange={(e) => setFindWord(e.target.value)}
                  placeholder="Find…"
                  className="sm:col-span-5 rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={replaceWord}
                  onChange={(e) => setReplaceWord(e.target.value)}
                  placeholder="Replace with…"
                  className="sm:col-span-5 rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={applyFindReplace}
                  className="sm:col-span-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-100"
                >
                  Apply
                </button>
              </div>

              <textarea
                value={edited}
                onChange={(e) => setEdited(e.target.value)}
                placeholder="OCR text will appear here…"
                className="h-[50vh] w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={saveEdits}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-black"
                >
                  Save corrections
                </button>
                <button
                  onClick={resetEdits}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs hover:bg-gray-100"
                >
                  Reset
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-600 shadow-sm">
            Could not find the item in local storage. Return to the main page and try opening it again.
          </div>
        )}
      </div>
    </main>
  );
}

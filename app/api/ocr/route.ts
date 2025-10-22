import { NextRequest, NextResponse } from 'next/server';
import { EasyOCR } from 'node-easyocr';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawnSync } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Silence progress/warnings printed by Python libs
process.env.TQDM_DISABLE = '1';
process.env.PYTHONWARNINGS = 'ignore';

const MODELS_DIR = path.join(process.cwd(), 'tmp', 'easyocr-models');
function ensureModelsDir() {
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
}

function resolvePythonPath() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) return process.env.PYTHON_PATH;
  const candidates = [
    path.join(process.cwd(), 'venv', 'Scripts', 'python.exe'), // Windows venv
    path.join(process.cwd(), 'venv', 'bin', 'python'),         // *nix venv
    'python', 'python3',
  ];
  for (const p of candidates) {
    try {
      const r = spawnSync(p, ['--version'], { encoding: 'utf8' });
      if (r.status === 0) return p;
    } catch {}
  }
  return undefined;
}

let ocrReader: EasyOCR | null = null;
let pythonPath: string | undefined;

async function getReader() {
  if (!ocrReader) {
    ensureModelsDir();
    pythonPath = resolvePythonPath();
    if (!pythonPath) throw new Error('Set PYTHON_PATH in .env.local to your venv python (e.g. .\\venv\\Scripts\\python.exe).');

    ocrReader = new EasyOCR({
      pythonPath,            // use your venv python
      // debug: true,        // uncomment for extra logs
    });

    // GPU off on Windows CPU boxes; point to stable model dir; quiet init
    await ocrReader.init(['en', 'es'], {
      gpu: false,
      verbose: false,
      modelStoragePath: MODELS_DIR, // node-easyocr option name
    });
  }
  return ocrReader;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `${uuidv4()}-${file.name}`);
    fs.writeFileSync(filePath, buffer);

    try {
      const reader = await getReader();
      // Pass quiet flags if supported by your node-easyocr version:
      const results = await reader.readText(filePath, { verbose: false });
      const text = results.map((r) => r.text).join(' ');
      return NextResponse.json({ text });
    } catch (ocrErr: any) {
      console.error('[OCR-ERROR]', ocrErr?.message || ocrErr);
      console.error('Using python at:', pythonPath);
      return NextResponse.json(
        { error: ocrErr?.message || 'OCR failed (Python crashed)' },
        { status: 500 }
      );
    } finally {
      try { fs.unlinkSync(filePath); } catch {}
    }
  } catch (err: any) {
    console.error('[API-ERROR]', err?.message || err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 500 });
  }
}

// Optional: sanity GET remains the same as you had
export async function GET() {
  try {
    const p = resolvePythonPath();
    if (!p) throw new Error('No python found');
    const v = spawnSync(p, ['-c', 'import sys;print(sys.version)'], { encoding: 'utf8' });
    return NextResponse.json({
      pythonPath: p,
      pythonStdout: v.stdout?.trim(),
      pythonStderr: v.stderr?.trim(),
      status: v.status,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}

# =========================
# 1. Base build stage
# =========================
FROM node:20-bullseye AS base

# Install system packages we need:
# - python3 / pip for EasyOCR runtime
# - build tools for some native deps
# - libgl1, libglib2.0-0 for OpenCV inside EasyOCR
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip python3-dev \
      build-essential \
      libgl1 \
      libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Make app dir
WORKDIR /app

# Copy Node deps manifests first for better layer caching
COPY package.json package-lock.json* bun.lockb* pnpm-lock.yaml* yarn.lock* ./

# Install Node deps
# (We’ll assume npm. If you use pnpm/yarn/bun, adjust this step.)
RUN npm install

# =========================
# 2. Python venv stage inside the same image
# =========================
# Create and populate the same style venv you were using locally.
# We'll call it /app/venv so our code can resolve PYTHON_PATH=/app/venv/bin/python
COPY requirements.txt ./requirements.txt
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install -r requirements.txt

# =========================
# 3. Copy the source code
# =========================
COPY . .

# Ensure Next.js can load node-easyocr without bundling issues
# (same as your next.config.ts experimental.serverComponentsExternalPackages)
# ^ nothing to RUN here, just reminding: make sure next.config.ts is in the repo

# Set env vars for runtime
ENV NODE_ENV=development
# Tell our OCR route which python to use
ENV PYTHON_PATH=/app/venv/bin/python
# Silence tqdm progress bars in EasyOCR
ENV TQDM_DISABLE=1
ENV PYTHONWARNINGS=ignore

# Create the tmp dirs used by OCR
RUN mkdir -p /app/tmp /app/tmp/easyocr-models

# Pre-warm OCR models to avoid crashing at first request.
# We'll run a tiny inline python script that imports easyocr and downloads models
# for ['en','es'] into /app/tmp/easyocr-models
RUN /app/venv/bin/python - << 'PY'\n\
import os, pathlib, easyocr\n\
os.environ['TQDM_DISABLE'] = '1'\n\
os.environ['PYTHONWARNINGS'] = 'ignore'\n\
models_dir = '/app/tmp/easyocr-models'\n\
pathlib.Path(models_dir).mkdir(parents=True, exist_ok=True)\n\
reader = easyocr.Reader(['en','es'], gpu=False, model_storage_directory=models_dir, verbose=False)\n\
print('Model warm-up complete')\n\
PY

# Expose Next.js port
EXPOSE 3000

# By default we'll run the dev server so you still get hot-refresh
# (in production you'd want `npm run build` then `npm run start`)
CMD ["npm", "run", "dev"]

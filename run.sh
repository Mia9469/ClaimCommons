#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -x ".venv-runtime/bin/python" ]] && .venv-runtime/bin/python -c "import uvicorn" 2>/dev/null; then
  PYTHON=".venv-runtime/bin/python"
elif [[ -x ".venv/bin/python" ]] && .venv/bin/python -c "import uvicorn" 2>/dev/null; then
  PYTHON=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="python3"
else
  PYTHON="python"
fi

"$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

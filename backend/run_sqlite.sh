#!/usr/bin/env bash

set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Override any PostgreSQL URL for this local process.
export DATABASE_URL="sqlite:///./portfolio.db"

if [[ -x ".venv/bin/python" ]]; then
    python_executable=".venv/bin/python"
elif [[ -x "venv/bin/python" ]]; then
    python_executable="venv/bin/python"
else
    python3 -m venv .venv
    python_executable=".venv/bin/python"
fi

"$python_executable" -m pip install --requirement requirements.txt
exec "$python_executable" -m uvicorn app.main:app \
    --host 127.0.0.1 --port "${LOCAL_BACKEND_PORT:-8000}" --reload

#!/usr/bin/env bash
# macOS/Linux launcher: backend in the background, frontend in the foreground. Ctrl+C stops both.
# Run with:  bash start.sh      (no need to chmod)
set -e
root="$(cd "$(dirname "$0")" && pwd)"
cd "$root/backend"
[ -f .env ] || { cp .env.example .env; echo "Created backend/.env: paste your GEMINI_API_KEY and GITHUB_TOKEN into it (optional)."; }
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
# pip runs only when requirements.txt changed
h="$( (shasum requirements.txt 2>/dev/null || sha1sum requirements.txt) | cut -d' ' -f1 )"
if [ ! -f .venv/.req-hash ] || [ "$(cat .venv/.req-hash)" != "$h" ]; then
  pip install -q -r requirements.txt && echo "$h" > .venv/.req-hash
fi
uvicorn main:app --reload &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT
cd "$root/frontend"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run dev

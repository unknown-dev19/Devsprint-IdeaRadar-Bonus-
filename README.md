# IdeaRadar

Paste a project proposal. IdeaRadar finds similar GitHub repos and past college projects, scores originality,
explains the overlap, and shows where you can be different.

It runs with **no keys** (offline fallbacks, approximate results). Add your own keys for the real thing.

**You need:** Python 3.10+ and Node 20+.

## Quick start

**Windows**
```
.\start.cmd
```
**macOS / Linux**
```
bash start.sh
```
The first run installs everything (a few minutes) and creates `backend/.env`. Then open http://localhost:5173.

## Add your keys (both optional)
Open `backend/.env` (created from `backend/.env.example` on first run, or copy it yourself) and paste:
- `GEMINI_API_KEY`: free at https://aistudio.google.com/apikey
- `GITHUB_TOKEN`: https://github.com/settings/tokens (a classic token with no scopes is enough)

Restart the backend after editing. The chips at the top right show whether the backend, Gemini and the GitHub token were detected.
`.env` is git-ignored: never commit or upload it. To keep it elsewhere, set the `IDEARADAR_ENV_PATH` environment variable.

## Manual setup (two terminals)
**Backend**
```
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python scripts/test_keys.py         # optional: checks keys, lists real model names
uvicorn main:app --reload           # http://127.0.0.1:8000/docs
```
**Frontend**
```
cd frontend
npm install
npm run dev                         # http://localhost:5173
```
Never open `index.html` directly (blank page).

## Troubleshooting
- `start.ps1 is not digitally signed`: use `.\start.cmd` instead (files from a downloaded zip are marked untrusted by Windows).
- "Gemini off" chip: `backend/.env` is missing or the value is empty / `PLACEHOLDER`.
- "Backend offline" chip: start uvicorn from inside `backend/`.
- Many "LLM error ... 404" lines: a Gemini model name is wrong. Run `python scripts/test_keys.py` and fix the names in `backend/config.py` (the only place they live).

## Demo safety
Run each example once with internet. Results, GitHub responses, LLM output and embeddings are cached in `backend/cache/`
(git-ignored), so demos replay instantly and offline. Delete that folder to force fresh results.

Full architecture and API reference: `IDEARADAR-PROJECT.md`.

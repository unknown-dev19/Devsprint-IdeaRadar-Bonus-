# IdeaRadar: complete project guide

> One file for the whole project: both modes, how to run it, how it works, what is verified and what is not.
> Put it in the project root (rename to `CLAUDE.md` if you use Claude Code so it loads automatically).

## 1. What this is

IdeaRadar was built in a GDG IIIT Surat DevSprint hackathon (6 hours, team of 3-4). It now has **two modes** in one app:

| Mode | Hackathon round | Problem statement |
|---|---|---|
| **Idea overlap** (original) | Round 1, PS-5 | Analyse project proposals and existing repos to find similar ideas, overlapping features and opportunities for innovation; explain similarities and recommend ways to be more distinctive. |
| **Blind-spot finder** (new) | Round 2 | Analyse project documents, datasets or workflows to identify missing assumptions, overlooked constraints and important unasked questions; prioritise by potential impact; give evidence-based recommendations. |

Both modes share the same engine: Gemini wrapper, disk cache, embeddings, GitHub search, college project archive, async job polling, and the UI kit. Round 2 was added on top of Round 1, not rewritten.

### Hard constraints (keep respecting these)
- Easy implementation and easy troubleshooting over scale or polish.
- No auth, no Docker, no cloud deployment, no vector DB (numpy cosine in memory, JSON files for cache).
- Free-tier APIs with a simple key only. Popular libraries only.
- Backend Python 3.11+ / FastAPI. Frontend React + Vite + Tailwind v4, **JavaScript not TypeScript**.
- **Every feature degrades gracefully** (no Gemini key, GitHub rate limit, bad JSON, empty results) so a live demo never breaks.
- Model names live in **one place only**: `backend/config.py`.
- Wording rule: say "relatively unexplored", "not mentioned in your text", "not covered in the compared set". Never "guaranteed opportunity" or "proof that something is missing".

## 2. Repository layout

```
IdeaRadar/
├─ README.md  CHANGES.md  IDEARADAR-PROJECT.md  start.cmd  start.ps1  start.sh  .gitignore  .gitattributes
├─ backend/                        # flat modules, run FROM this folder
│  ├─ main.py                      # FastAPI routes, demos, in-memory job store (both modes)
│  ├─ config.py                    # model names, weights, thresholds, keys (read from backend/.env)
│  ├─ llm.py                       # Gemini JSON call: cache, repair+retry, model fallback, fallback value
│  ├─ embed.py                     # Gemini embeddings, falls back to local hashing embeddings
│  ├─ github.py                    # repo search + README fetch, disk cached, None on failure
│  ├─ cache.py                     # sha1-keyed JSON files in backend/cache/
│  │  -- Round 1: idea overlap --
│  ├─ pipeline.py                  # extract / retrieve / rank / compare / score / recommend
│  ├─ landscape.py                 # PCA + KMeans map, cluster labels, white-space, unexplored regions
│  ├─ data/seed_projects.json      # 16 past college projects (institutional memory)
│  │  -- Round 2: blind spots --
│  ├─ blindspots.py                # orchestration, AI prompt, quote verification, scoring, references
│  ├─ checklist.py                 # 20-topic rule checklist (works with no key)
│  ├─ dataset.py                   # deterministic CSV profiler (csv module, no pandas)
│  ├─ demos.py                     # 3 demo inputs: document + workflow + messy dataset
│  ├─ scripts/test_keys.py         # lists Gemini models, tests LLM, embedding, GitHub rate limit
│  ├─ requirements.txt             # fastapi uvicorn httpx numpy pydantic python-dotenv google-genai scikit-learn
│  └─ cache/                       # created at runtime
└─ frontend/
   ├─ package.json  vite.config.js (proxies /api to 127.0.0.1:8000)  jsconfig.json  components.json
   ├─ index.html                   # Geist + Geist Mono from Google Fonts, with fallbacks
   └─ src/
      ├─ main.jsx  index.css       # Tailwind v4, class-based dark mode, terrain colour variables
      ├─ App.jsx                   # hero, mode toggle, both forms, demos, polling, error handling
      ├─ Results.jsx  Landscape.jsx          # Round 1 results + idea landscape
      ├─ BlindSpots.jsx                      # Round 2 results
      ├─ lib/utils.js
      └─ components/
         ├─ ui.jsx                 # Icon, Chip, Card, Meter, Segmented, SectionTitle (inline SVG icons)
         ├─ Stepper.jsx            # progress rail; takes a `steps` prop (OVERLAP_STEPS / BLIND_STEPS)
         └─ effects/               # topo-background.jsx, idea-terrain.jsx (vendored canvas effects, recoloured)
```

## 3. Run it

### macOS / Linux (Terminal)
```bash
# Terminal 1: backend (run from inside backend/)
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/test_keys.py        # confirms real model names, optional but recommended
uvicorn main:app --reload          # API docs at http://127.0.0.1:8000/docs

# Terminal 2: frontend (Node 20+). Delete any copied node_modules first: it may be built for another OS.
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev                        # open http://localhost:5173 and hard-refresh (Cmd+Shift+R)
```
Or run both with `./start.sh` from the project root. Windows users: `start.ps1`, or the same steps with `.venv\Scripts\Activate.ps1`.

Do not open `index.html` directly (blank page).
If the build complains about `tailwindcss` or PostCSS, delete `tailwind.config.js` and `postcss.config.js` (Tailwind v4 does not use them).

### Keys and the .env file
Keys live in `backend/.env`, which is git-ignored and never committed. Copy `backend/.env.example` to `backend/.env` (the launchers do this for you on first run) and paste your own keys. To keep the file somewhere else, set the `IDEARADAR_ENV_PATH` environment variable to its path; that takes priority.

The file contains:

```
GEMINI_API_KEY=your_key_here
GITHUB_TOKEN=your_token_here
```

- Gemini key: https://aistudio.google.com/apikey
- GitHub token: Settings > Developer settings > Personal access tokens, **no scopes**. Authenticated search allows about 30 requests per minute.
- The file wins over system variables (`override=True`). Empty, `PLACEHOLDER` or `YOUR_KEY_HERE` count as "no key".
- On startup uvicorn prints `[config] env file: ... | Gemini key: set/MISSING | GitHub token: set/MISSING`. Use that line to confirm the right file loaded.
- Security check: no keys in source, cache or `.env.example`, and no real `.env` is included in the repo. Never commit or upload your real `.env` (GitHub's website uploader ignores `.gitignore`, so do not drag it in).

## 4. API reference

Both modes use the same job pattern: `POST` returns a `job_id`; the UI polls `GET /api/jobs/{id}` once per second (gives up after 3 minutes).

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | `{ok, gemini, github}` for the status chips |
| `GET /api/demos` | Round 1 demos `[{id,title}]` (`attendance`, `expense`, `resume`) |
| `POST /api/analyze` | Round 1. Body `{title, description, features[], tech_stack[], demo_id?}` -> `{job_id}` |
| `GET /api/bs-demos` | Round 2 demos (`placement`, `clinic`, `energy`) |
| `POST /api/blindspots` | Round 2. Body `{title, document, workflow, dataset, dataset_name, demo_id?}` -> `{job_id}`. `dataset` is CSV text, max about 2.5 MB |
| `GET /api/jobs/{id}` | `{status: running|done|error, stage, result?, error?}` |

Errors are clear messages: empty input returns 400, unknown demo returns 404, an oversized dataset returns 400, a restarted server returns "Job not found, run again".

---

## 5. Mode A: Idea overlap (Round 1)

**Pipeline**
1. **Extract** (LLM): `{core_problem, target_users, features, tech, keywords[4]}`. Fallback: raw form fields.
2. **Retrieve:** up to 4 GitHub queries x 8 repos (deduped) plus all seed projects. GitHub failure adds a warning and uses the archive only.
3. **Embed** the proposal and every candidate. Fallback: local hashing embedding.
4. **Rank:** cosine normalised with `THRESH[mode]`: `clip((cos - lo) / (hi - lo), 0, 1)`. Gemini `(0.55, 0.90)` is **not calibrated yet**; local `(0.10, 0.45)` was calibrated on the 3 demos.
5. **Compare** the top 4 (LLM per repo): feature-overlap table, same problem/approach, 2-sentence summary. README text is fetched only for these 4.
6. **Score:** `S` = top similarity, `F` = best feature coverage (yes = 1, partial = 0.5), `Cr` = min(1, highly similar count / 5).
   `originality = round(100 x (1 - (0.45 S + 0.40 F + 0.15 Cr)))`. Bands: >=70 distinctive, 40-69 crowded, <40 saturated.
7. **Recommend** (LLM): gaps, 3-5 add/pivot suggestions, positioning statement.
8. **Landscape:** PCA(2) (deterministic) + KMeans, cluster labels and white-space opportunities from the LLM, unexplored regions from an empty-cell grid. `landscape` is `null` with fewer than 3 points.

**UI:** originality ring with a "where the points went" breakdown, match cards with similarity bars, expandable feature table, advice, and the landscape tab (Terrain view and hand-written SVG Points view).

---

## 6. Mode B: Blind-spot finder (Round 2)

### Idea
A team's biggest risks are things they never wrote down. The system reads what they did write (document, workflow, dataset) and finds what is missing, then ranks the findings so the worst get fixed first, and shows evidence for each so nothing is a bare opinion.

### Input
- **Document:** pasted text or a loaded `.txt/.md/.json/.csv/.log` file (up to 12,000 characters used).
- **Workflow:** one step per line (up to 3,000 characters used).
- **Dataset:** CSV/TSV upload (first 20,000 rows and 60 columns profiled).
- Any one of the three is enough. PDF upload is not supported.

### Pipeline (`blindspots.py`)
1. **Read:** `checklist.coverage()` scans the text for 20 topics (privacy, security, scale, performance, failure and recovery, data quality, data source and labels, bias and fairness, success metrics, stakeholders, cost, legal, dependencies, accessibility, monitoring, human oversight, deployment, ownership, testing, timeline). A topic is "mentioned" if its keywords appear anywhere. Some topics (bias, provenance, human oversight) only apply to ML/data projects.
2. **Profile dataset** (`dataset.py`): measured facts, each with an id (`D1`, `D2`...): missing values per column, exact duplicate rows, extreme values (3x IQR), mixed types, constant columns, personal data (column names plus email/phone value patterns), sensitive attributes, target class imbalance (>=80%), time span under 120 days, data older than 2 years, sample too small (under 200 rows or under 10 rows per column).
3. **Reason (one Gemini call):** gets the text, the unmentioned topics and the measured facts. Returns a summary, 3 search queries and 6-10 findings, each with type, category, title, description, an exact quote, dataset refs, impact, likelihood, recommendation, question and effort.
4. **Verify:** the quote must appear word-for-word in the user's text (whitespace and quote-mark insensitive) or it is dropped. Dataset refs must exist. Bad types or categories are normalised. Junk rows are skipped.
5. **Merge:** AI findings + one finding per measured data fact + rule findings for unmentioned topics the AI did not already cover.
6. **Score and rank** (below), keep the top 20.
7. **Attach references:** embed each finding and the pool (GitHub results + archive); attach the top 2 related projects if topic similarity is at least 35%. Shown as "related project, N% similar topic", never as proof.

### Finding types
`assumption` (hidden assumption), `constraint` (overlooked constraint), `question` (unasked question), `conflict` (text contradicts the data or workflow, or the data is stale or too short for the claim).

### Scoring (shown to the user in full)

```
priority = round( 100 x (impact / 5) x (likelihood / 5) x evidence_confidence )
```

| Evidence | Confidence |
|---|---|
| Measured in the dataset | 100% |
| Quote verified in the user's text, or supported by a dataset fact (AI finding) | 95% |
| AI inference with no quote or data | 70% |
| Rule: topic never mentioned | 60% |

Tiers: **critical >= 60**, **high >= 40**, **medium >= 20**, else low.
Measured data findings use likelihood 4 (the fact is certain, whether it hurts is not).
**Exposure score** = average of the 5 highest open priorities. Marking a finding "Addressed" or "Not relevant" recomputes it live.

These weights and cut-offs are judgement calls, not calibrated.

### Result shape (what `BlindSpots.jsx` renders)

```json
{
  "mode": "live | degraded | cached",
  "warnings": ["..."],
  "title": "", "summary": "",
  "exposure": {"score": 70, "tier": "critical", "critical": 7, "high": 3},
  "counts": {"assumption": 10, "constraint": 6, "question": 0, "conflict": 1},
  "coverage": [{"id": "privacy", "name": "Privacy & consent", "mentioned": false, "applies": true}],
  "findings": [{
    "id": "F1", "type": "constraint", "category": "data_quality", "origin": "data|ai|rule",
    "title": "", "description": "",
    "quote": "", "quote_claimed": false,
    "data": [{"id": "D3", "fact": ""}],
    "references": [{"name": "", "url": null, "source": "github|internal", "stars": 0, "description": "", "similarity_pct": 52}],
    "impact": 4, "likelihood": 4, "confidence": 1.0, "priority": 64, "tier": "critical",
    "recommendation": "", "question": "", "effort": "low|med|high"
  }],
  "dataset": {"name": "", "rows": 243, "cols": 10, "duplicates": 3, "columns": [{"name": "", "type": "", "missing_pct": 0, "unique": 0}]},
  "formula": "priority = 100 x (impact/5) x (likelihood/5) x evidence confidence"
}
```

### UI (`BlindSpots.jsx`)
- **Header card:** exposure number and tier, counts by type, AI summary, the scoring formula in plain words, Markdown export.
- **Findings tab:** ranked cards (first two open), filter by type. Each card shows an origin badge (Measured in dataset / Quoted from your text / AI inference / Not mentioned in your text), the evidence, the recommendation with effort, the question to ask, impact / likelihood / confidence meters, and Mark addressed / Not relevant.
- **Impact map tab:** 5x5 impact-versus-likelihood matrix with numbered dots (click to jump to the finding) and the "what your text mentions" checklist.
- **Questions tab:** all questions in priority order with a "why?" link and Copy all.
- **Dataset tab:** per-column profile with missing-% bars and flags (personal, sensitive, target distribution, extreme values).

### Demos (`demos.py`, deterministic)
| id | Project | Planted problems |
|---|---|---|
| `placement` | Campus Placement Predictor | 88% class imbalance, 16% missing CGPA, duplicates, personal data (name, email), sensitive gender column, "90% accuracy" goal |
| `clinic` | Rural Clinic Appointment Scheduler | 84% no-show imbalance, 26% missing phone numbers (and the plan relies on SMS), only 40 days of data, small sample, an impossible 480 km value |
| `energy` | Smart Campus Energy Dashboard | Only 31 days of data, irregular gaps, negative and 9999 readings, missing temperatures, plan promises a forecast and rupee savings |

---

## 7. Graceful degradation

| Failure | What happens |
|---|---|
| No Gemini key | Offline mode: Mode A uses local embeddings and heuristics; Mode B shows rule-based and data findings only. A banner says so. |
| Wrong model name (404) | The model is marked dead for the session; the call moves to the fallback model, then to fallback text. |
| Rate limit (429) | Short backoff, then fallback. |
| Bad or malformed JSON | Repair and retry once; all LLM output is validated and normalised. |
| Embedding rejects `task_type` | Retries without it, then falls back to local embeddings. |
| GitHub unavailable | Warning, archive-only retrieval. |
| Dataset unreadable | Warning; the rest of the analysis still runs. |
| Landscape or reference step errors | Warning; the rest of the result is kept. |

**Caching** (`backend/cache/`, keyed by hash): LLM outputs, embeddings, GitHub responses and the final result. A final result is cached **only when there are no warnings**, so degraded runs are never frozen. The cache key includes `CACHE_VERSION` and both model names. **Bump `CACHE_VERSION` in `config.py` after editing any prompt.** Running each demo once online makes it replay offline.

## 8. Verified vs. not verified

**Verified**
- Round 1: backend install and run, frontend build, headless-browser run of all 3 demos and a typed form with no JS errors, mocked Gemini failures (wrong model name, task_type rejected, malformed JSON, every call failing). See `CHANGES.md`.
- Round 2: the pipeline runs offline on all 3 demos; the AI path with a mocked LLM (fabricated quote rejected, invalid dataset ids dropped, junk rows skipped); every changed JSX file parses; `BlindSpots` server-renders with a real backend result and with an empty one.

**Not verified (check these first)**
1. `python scripts/test_keys.py`: confirm `gemini-3.8-flash`, `gemini-embedding-2` and the fallback `gemini-3.1-flash-lite` exist.
2. Real Gemini output for Blind-spot mode. If findings look generic, tune `build_prompt` in `blindspots.py`, then bump `CACHE_VERSION`.
3. Real GitHub results and the reference matches.
4. Visual layout in `vite dev` (Tailwind v4, dark and light, mobile widths) for the new screens.
5. **Calibrate `THRESH["gemini"]`** in `config.py` with 5 known pairs (duplicate / related / unrelated). Mode A's similarity % and Mode B's reference matches depend on it.
6. If outputs look odd at `temperature=0.2` on Gemini 3.x models, try removing it in `llm.py`.

Quick API smoke test:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
$j = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/blindspots -ContentType "application/json" -Body '{"demo_id":"placement"}'
Invoke-RestMethod "http://127.0.0.1:8000/api/jobs/$($j.job_id)"
```

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Unstyled page or PostCSS error mentioning `tailwindcss` | Delete `postcss.config.js` and `tailwind.config.js`; restart `npm run dev`. |
| "Failed to resolve import @/..." | Restart the dev server so the `vite.config.js` alias loads. |
| "Backend offline" chip | Start uvicorn from inside `backend\`. |
| "Gemini off (approximate mode)" chip | `backend/.env` is missing or the value is empty; check the `[config]` line at startup and restart uvicorn after editing. |
| Blank page | You opened `index.html` directly; use http://localhost:5173. |
| Many "LLM error ... 404" lines | Wrong model name; run `scripts/test_keys.py` and fix `config.py`. |
| Result looks stale after a prompt edit | Bump `CACHE_VERSION` in `config.py`. |
| Contours missing on the hero | Colour comes from the `text-*` class on `<TopoBackground>` in `App.jsx`. |
| `Dataset could not be read` banner | Needs a header row plus data rows, comma/semicolon/tab/pipe separated. |

## 10. Known limits
- No PDF input; datasets must be CSV/TSV under about 2 MB.
- The job store is in memory (capped at 50); restarting the server loses running jobs.
- Rule findings only check whether a topic is mentioned, not whether it is handled well.
- Reference matches are topic similarity, not evidence that a project solved the issue.
- Deferred by decision: Firebase and n8n. If they return: Firestore on the free Spark plan only, keys stay in `.env` (never in Firestore), and n8n stays off the critical path (a short-timeout, try/except webhook after a job finishes).

## 11. Pitch and demo script

**Round 2 line:** "Teams don't fail on what they planned, they fail on what they never wrote down. We find that, rank it by impact, and show the evidence."

**3-minute demo**
1. Hook: "Every team here has a plan. Which of your assumptions are wrong?"
2. Run **Campus Placement Predictor**. Point at the exposure score and the one-sentence summary.
3. Top finding: class imbalance. "A model that always says 'placed' scores 88% accuracy, so the 90% goal is meaningless." Show the measured data evidence.
4. An AI finding with a **word-for-word quote** from the document and the "Found word-for-word in your text" badge. Say that fabricated quotes are rejected automatically.
5. Impact map: click a dot, jump to its finding.
6. Questions tab: "These are the questions to take to your mentor or client." Copy all.
7. Mark two findings "Addressed" and watch the exposure score drop. Export the report.
8. Close: "Round 1 told you if your idea exists. Round 2 tells you what you haven't thought of. Same engine."

**Wording rule:** "not mentioned in your text", "AI inference", "related project"; never claim certainty the evidence does not support.

## 12. Suggested next steps (by value)
1. Run the keys test, run all six demos once online (this warms the cache), and tune the Blind-spot prompt after seeing real output.
2. Calibrate `THRESH["gemini"]`.
3. Add PDF input (`pypdf` on the backend).
4. Grow `seed_projects.json` to 20+ entries.
5. Stretch: an evaluator batch view that ranks many submitted proposals by exposure; a print-to-PDF report; a GitHub repo URL as input.

**Cut order if behind:** stretch items > PDF export > Dataset tab > Impact map > reference matching > AI review (rules and data findings still deliver). **Never cut:** the ranked findings, the evidence on each finding, the dataset facts, demo caching.

## 13. Working agreement for any future session
- Read the code before changing it. Make small, targeted edits; do not refactor working modules.
- Keep the flat `backend/` layout (run `uvicorn main:app` from inside `backend/`).
- Any new external call needs a timeout, a try/except and a fallback.
- No heavy dependencies (no LangChain, Chroma, sentence-transformers, pandas).
- Model names only in `config.py`. Bump `CACHE_VERSION` after prompt changes.
- State assumptions at the top of each reply; ask at most one question at a time.

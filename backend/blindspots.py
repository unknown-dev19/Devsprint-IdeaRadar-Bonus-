"""Blind-Spot Finder: documents + workflow + dataset -> ranked, evidence-backed findings.
Evidence comes from 3 places: (1) verbatim quotes checked against the user's text, (2) measured dataset facts,
(3) related real projects (GitHub + college archive) retrieved with the IdeaRadar engine. Works offline via rules."""
import json, re
import numpy as np
import config as C, cache, llm, github, checklist, dataset
from embed import embed
from pipeline import SEED

MAX_DOC, MAX_FLOW, MAX_FINDINGS, REF_MIN = 12000, 3000, 20, 0.35
norm_ws = lambda s: re.sub(r"\s+", " ", re.sub(r"[\"'“”‘’]", "'", s)).strip().lower()
TYPES = {"assumption", "constraint", "question", "conflict"}

def tier(p): return "critical" if p >= 60 else "high" if p >= 40 else "medium" if p >= 20 else "low"
def clamp(v, d=3):
    try: return max(1, min(5, round(float(v))))
    except Exception: return d

def score(f):
    """priority = 100 x (impact x likelihood / 25) x confidence. Shown to the user in full."""
    conf = f["confidence"]; f["priority"] = round(100 * f["impact"] * f["likelihood"] / 25 * conf); f["tier"] = tier(f["priority"]); return f

def build_prompt(p, text, cov, facts, flow):
    unc = [f"{c['id']} ({c['name']})" for c in cov if not c["mentioned"] and c["applies"]]
    known = [f"{d['id']}: {d['fact']}" for d in facts]
    return ("You are a sceptical reviewer finding what a project team has NOT considered. Use ONLY the material below. JSON only:\n"
            '{"summary":"2 sentences: the biggest blind spot and why","search_queries":["3 GitHub queries, 2-4 words each, about the problem domain"],'
            '"findings":[{"type":"assumption|constraint|question|conflict","category":"<one id from CATEGORY_IDS>","title":"<=10 words","description":"1-2 sentences, specific to THIS project",'
            '"evidence_quote":"EXACT words copied from the document or workflow that reveal the gap, or empty string if the gap is an absence","dataset_refs":["D-ids that support it"],'
            '"impact":1-5,"likelihood":1-5,"recommendation":"concrete action doable in a day","question":"one question a stakeholder should answer","effort":"low|med|high"}]}\n'
            "Rules: 6-10 findings. Only claim what the text or facts support. 'conflict' = document claims contradict the dataset or the workflow. "
            "impact = harm if the gap is real; likelihood = how likely the gap is real. Do NOT repeat the already-measured data facts; use their ids as dataset_refs where relevant. "
            "Prefer topics from NOT_MENTIONED when they genuinely matter for this project; skip ones that do not.\n"
            f"CATEGORY_IDS: {checklist.IDS}\nNOT_MENTIONED: {unc}\nMEASURED_DATA_FACTS: {known}\n"
            f"TITLE: {p['title']}\nDOCUMENT: {p['document'][:MAX_DOC]}\nWORKFLOW: {flow[:MAX_FLOW]}")

def clean_ai(raw, text, fact_ids):
    out = []
    for r in (raw or {}).get("findings", []) if isinstance(raw, dict) else []:
        if not isinstance(r, dict) or not str(r.get("title", "")).strip(): continue
        q = str(r.get("evidence_quote") or "").strip(); ok = bool(q) and norm_ws(q) in norm_ws(text)
        refs = [x for x in (r.get("dataset_refs") or []) if isinstance(x, str) and x in fact_ids]
        out.append({"type": r.get("type") if r.get("type") in TYPES else "assumption",
                    "category": r.get("category") if r.get("category") in checklist.IDS else "other",
                    "title": str(r["title"]).strip()[:120], "description": str(r.get("description", "")).strip(),
                    "quote": q if ok else "", "quote_claimed": bool(q) and not ok, "data_refs": refs,
                    "impact": clamp(r.get("impact")), "likelihood": clamp(r.get("likelihood")),
                    "recommendation": str(r.get("recommendation", "")).strip(), "question": str(r.get("question", "")).strip(),
                    "effort": r.get("effort") if r.get("effort") in ("low", "med", "high") else "med", "origin": "ai",
                    "confidence": 0.95 if (ok or refs) else 0.7})
    return out

def attach_references(findings, queries, warns):
    """Related real projects for each finding via embeddings. Shown with similarity, never as proof."""
    cands, seen = [], set()
    for q in queries[:3]:
        res = github.search(q)
        if res is None: warns.append("GitHub unavailable: related-project references use the college archive only."); break
        for it in res:
            if it["id"] not in seen: seen.add(it["id"]); cands.append(it)
    pool = cands + [{**s, "source": "internal", "url": None, "topics": []} for s in SEED]
    ftxt = [f"{f['title']}. {f['description']} {f['recommendation']}" for f in findings]
    ptxt = [f"{x['title']}. {x['description']} {' '.join(x.get('topics', []))}" for x in pool]
    X, mode = embed(ftxt + ptxt)
    if mode == "local" and llm.client(): warns.append("Gemini embeddings unavailable: related-project matching is approximate.")
    X = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9); lo, hi = C.THRESH[mode]
    sim = np.clip((X[:len(findings)] @ X[len(findings):].T - lo) / (hi - lo), 0, 1)
    for i, f in enumerate(findings):
        refs = []
        for j in np.argsort(-sim[i])[:2]:
            if sim[i, j] >= REF_MIN:
                x = pool[j]; refs.append({"name": x["title"], "url": x.get("url"), "source": x["source"], "stars": x.get("stars"),
                                          "description": x["description"][:160], "similarity_pct": round(float(sim[i, j]) * 100)})
        f["references"] = refs

def run(p, job):
    stage = lambda s: job.update(stage=s)
    ck = cache.key("blind", C.CACHE_VERSION, C.LLM_MODEL, C.EMBED_MODEL, p)
    llm.stats["fail"] = 0
    if (r := cache.get(ck)): return {**r, "mode": "cached"}
    warns = []
    if not llm.client(): warns.append("No Gemini key: running rule-based checks only. AI-written findings are skipped.")
    flow = p.get("workflow", ""); text = f"{p['title']}\n{p['document']}\n{flow}"
    if len(text.strip()) < 40 and not p.get("dataset", "").strip(): raise ValueError("Add a project document, workflow or dataset (at least a couple of sentences).")

    stage("Reading your documents"); cov = checklist.coverage(text, bool(p.get("dataset", "").strip()))
    prof = None
    if p.get("dataset", "").strip():
        stage("Profiling the dataset")
        try: prof = dataset.profile(p["dataset"])
        except Exception as e: warns.append(f"Dataset could not be read: {e}")
    facts = prof["facts"] if prof else []; fids = {d["id"] for d in facts}

    stage("Reasoning about what is missing")
    raw = llm.gen_json(build_prompt(p, text, cov, facts, flow), None) if llm.client() else None
    ai = clean_ai(raw, text, fids)
    if llm.client() and not ai: warns.append("The AI review returned nothing usable, so only rule-based and data findings are shown.")
    summary = str(raw.get("summary", "")).strip() if isinstance(raw, dict) else ""
    queries = [q for q in (raw.get("search_queries") if isinstance(raw, dict) else None) or [] if isinstance(q, str)] or \
              [p["title"], " ".join(re.findall(r"[a-z]{5,}", p["document"].lower())[:4])]

    findings = ai[:]
    for d in facts:  # measured facts are always findings: strongest evidence we have
        findings.append({"type": "conflict" if d["kind"] in ("stale", "short_span") else "constraint", "category": d["category"], "title": d["title"],
                         "description": d["fact"], "quote": "", "quote_claimed": False, "data_refs": [d["id"]], "impact": d["impact"],
                         "likelihood": d["likelihood"], "recommendation": d["recommendation"], "question": d["question"], "effort": "low",
                         "origin": "data", "confidence": 1.0})
    have = {f["category"] for f in ai}
    for r in checklist.rule_findings(cov):  # checklist gaps not already covered by the AI
        if r["category"] in have: continue
        findings.append({**r, "quote": "", "quote_claimed": False, "data_refs": [], "confidence": 0.6})
    fact_by = {d["id"]: d["fact"] for d in facts}
    for f in findings:
        score(f); f["data"] = [{"id": i, "fact": fact_by[i]} for i in f.pop("data_refs")]
    findings.sort(key=lambda f: (-f["priority"], f["title"])); findings = findings[:MAX_FINDINGS]
    for i, f in enumerate(findings, 1): f["id"] = f"F{i}"

    stage("Finding related projects as evidence")
    try: attach_references(findings, queries, warns)
    except Exception as e: print("Reference error", repr(e)); warns.append("Related-project evidence could not be attached for this run.")
    for f in findings: f.setdefault("references", [])
    if llm.client() and llm.stats["fail"]: warns.append("Some AI steps failed (wrong model name or rate limit), so parts of this result use fallback text.")

    stage("Ranking by impact")
    top = [f["priority"] for f in findings[:5]]; exposure = round(sum(top) / max(1, len(top)))
    counts = {t: sum(f["type"] == t for f in findings) for t in TYPES}
    if not summary and findings: summary = f"Biggest blind spot: {findings[0]['title'].lower()}. {findings[0]['description']}"
    res = {"mode": "degraded" if warns else "live", "warnings": warns, "title": p["title"], "summary": summary,
           "exposure": {"score": exposure, "tier": tier(exposure), "critical": sum(f["tier"] == "critical" for f in findings), "high": sum(f["tier"] == "high" for f in findings)},
           "counts": counts, "coverage": cov, "findings": findings,
           "dataset": ({k: prof[k] for k in ("rows", "cols", "columns", "duplicates")} | {"name": p.get("dataset_name", "dataset")}) if prof else None,
           "formula": "priority = 100 x (impact/5) x (likelihood/5) x evidence confidence"}
    if not warns: cache.put(ck, res)
    return res

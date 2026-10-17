import json, re
import numpy as np
from pathlib import Path
import config as C, cache, llm, github, landscape
from embed import embed

SEED = json.loads((Path(__file__).parent / "data" / "seed_projects.json").read_text())
words = lambda s: set(re.findall(r"[a-z]{4,}", s.lower()))
QSTOP = set("that with from this using uses based application platform which web app system".split())

def fallback_keywords(p):
    """Offline search queries (ordered, so cache keys stay stable between runs)."""
    kw = [p["title"]] + [" ".join(f.split()[:3]) for f in p["features"][:2]]
    d = [w for w in re.findall(r"[a-z]{4,}", p["description"].lower()) if w not in QSTOP][:4]
    if d: kw.append(" ".join(d))
    return [k for k in kw if k.strip()]

def extract(p):
    prompt = ("Extract a structured summary from this project proposal. JSON only:\n"
              '{"core_problem":"1 sentence","target_users":["..."],"features":["max 10 short noun phrases"],"tech":["..."],"keywords":["..."]}\n'
              '"keywords" = exactly 4 GitHub search queries, 2-4 words each: one broad (the problem), one about the approach, '
              "one niche/unusual angle, one domain+tech. No quotes or operators.\n"
              f"Title: {p['title']}\nDescription: {p['description']}\nFeatures: {p['features']}\nTech: {p['tech_stack']}")
    fb = {"core_problem": p["description"][:160], "target_users": [], "features": p["features"], "tech": p["tech_stack"],
          "keywords": fallback_keywords(p)}
    out = llm.gen_json(prompt, fb) or fb
    for k, v in fb.items(): out.setdefault(k, v)
    for k in ("target_users", "features", "tech", "keywords"):      # the LLM may return odd shapes: keep lists of strings
        v = out[k] if isinstance(out[k], list) else [out[k]]
        out[k] = [str(x) for x in v if isinstance(x, (str, int, float)) and str(x).strip()]
    if not out["keywords"]: out["keywords"] = fb["keywords"]
    return out

def compare(ex, it, sim):
    prompt = ('Compare the PROPOSAL with the REPO using ONLY the repo text given; if a feature is not mentioned, mark "no". JSON only:\n'
              '{"feature_overlap":[{"feature":"<each proposal feature>","status":"yes|no|partial","note":"<=12 words"}],'
              '"same_problem":true,"same_approach":true,"summary":"2 plain-language sentences on why it is similar or different",'
              '"repo_extra_features":["max 4"]}\n'
              f"PROPOSAL: {json.dumps(ex)}\nREPO: {it['title']}. {it['text']}")
    w = words(it["text"])
    fb = {"feature_overlap": [{"feature": f, "status": "partial" if words(f) & w else "no", "note": "word match (offline)"} for f in ex["features"]],
          "same_problem": sim >= .7, "same_approach": sim >= .7,
          "summary": "AI comparison unavailable; this match is based on text-embedding similarity.", "repo_extra_features": []}
    return llm.gen_json(prompt, fb) or fb

def recommend(ex, comps):
    seen = [{"repo": c["name"], "covers": [r["feature"] for r in c["feature_overlap"] if r.get("status") != "no"], "extra": c["repo_extra_features"]} for c in comps]
    prompt = ("Given the proposal and its closest existing projects, find what NONE of them cover. JSON only:\n"
              '{"gaps":[{"gap":"specific","why_it_matters":"..."}],"suggestions":[{"type":"add|pivot","title":"...","detail":"1-2 sentences","effort":"low|med|high"}],'
              '"positioning_statement":"one sentence for the judges"}\n'
              "3-4 gaps (e.g. offline mode, regional languages, unusual user group, privacy angle) and exactly 3-5 suggestions. "
              "Never suggest a feature already covered. Keep it feasible for a 6-hour team.\n"
              f"PROPOSAL: {json.dumps(ex)}\nCLOSEST PROJECTS: {json.dumps(seen)}")
    fb = {"gaps": [{"gap": "Offline / low-connectivity mode", "why_it_matters": "Most student projects assume good internet."},
                   {"gap": "Regional-language support", "why_it_matters": "Widens the user base beyond English speakers."},
                   {"gap": "Accessibility for under-served users", "why_it_matters": "Few compared projects target them."}],
          "suggestions": [{"type": "add", "title": "Offline-first mode", "detail": "Cache data locally and sync when online.", "effort": "med"},
                          {"type": "add", "title": "Multilingual input", "detail": "Accept Hindi/Gujarati text or voice.", "effort": "low"},
                          {"type": "pivot", "title": "Target an under-served user group", "detail": "Narrow the idea to one group the compared set ignores.", "effort": "med"}],
          "positioning_statement": "(Generic fallback: AI recommendations were unavailable.)"}
    return llm.gen_json(prompt, fb) or fb

def run(p, job):
    stage = lambda s: job.update(stage=s)
    ck = cache.key("result", C.CACHE_VERSION, C.LLM_MODEL, C.EMBED_MODEL, p)
    llm.stats["fail"] = 0
    if (r := cache.get(ck)): return {**r, "mode": "cached"}
    warns = []
    if not llm.client(): warns.append("No Gemini key: running in offline mode with approximate text matching.")

    stage("Understanding your idea"); ex = extract(p)

    stage("Searching GitHub"); cands, seen = [], set()
    for q in ex["keywords"][:C.QUERIES]:
        res = github.search(q)
        if res is None: warns.append("GitHub unavailable: using the college project archive only."); break
        for it in res:
            if it["id"] not in seen: seen.add(it["id"]); cands.append(it)
    items = cands + [{**s, "source": "internal", "url": None} for s in SEED]
    for it in items: it["text"] = f"{it['description']} {' '.join(it.get('topics', []))}".strip()

    stage("Embedding and ranking")
    ptext = f"{p['title']}. {p['description']} Features: {', '.join(p['features'])}"
    X, mode = embed([ptext] + [f"{it['title']}. {it['text']}" for it in items])
    if mode == "local": warns.append("Gemini embeddings unavailable: similarity scores are approximate.")
    Xn = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)
    lo, hi = C.THRESH[mode]
    norm = np.clip((Xn[1:] @ Xn[0] - lo) / (hi - lo), 0, 1)
    order = np.argsort(-norm)

    stage("Comparing with the closest projects"); comps = []
    for i in order[:C.TOP_K]:
        it = items[i]
        if it["source"] == "github": it["text"] += " README: " + github.readme(it["title"])
        c = compare(ex, it, float(norm[i]))
        fo = [{"feature": str(r.get("feature", "")), "note": str(r.get("note", "")),
               "status": r.get("status", "no").lower() if r.get("status", "no").lower() in ("yes", "partial", "no") else "no"}
              for r in c.get("feature_overlap", []) if isinstance(r, dict) and isinstance(r.get("status", "no"), str)]
        cov = sum({"yes": 1, "partial": .5}.get(r.get("status"), 0) for r in fo) / max(1, len(fo))
        comps.append({"id": it["id"], "source": it["source"], "name": it["title"], "url": it.get("url"), "stars": it.get("stars"),
                      "description": it["description"], "similarity_pct": round(float(norm[i]) * 100),
                      "level": "high" if norm[i] >= .7 else "medium" if norm[i] >= .4 else "low",
                      "why_similar": {"same_problem": c.get("same_problem"), "same_approach": c.get("same_approach"), "summary": c.get("summary", "")},
                      "feature_overlap": fo, "coverage_pct": round(cov * 100), "repo_extra_features": c.get("repo_extra_features", [])})

    stage("Scoring and recommending")
    S, F = float(norm[order[0]]), max(c["coverage_pct"] for c in comps) / 100
    Cr = min(1, int((norm >= .7).sum()) / 5)
    rows = [("Idea similarity", C.W_SIM, S, f"closest match is {S*100:.0f}% similar"),
            ("Feature overlap", C.W_FEAT, F, f"best match already covers {F*100:.0f}% of your features"),
            ("Crowdedness", C.W_CROWD, Cr, f"{int((norm >= .7).sum())} highly similar projects found")]
    breakdown = [{"factor": f, "weight": w, "value": round(v, 2), "penalty": round(100 * w * v), "note": n} for f, w, v, n in rows]
    score = max(0, 100 - sum(b["penalty"] for b in breakdown))
    band = "distinctive" if score >= 70 else "crowded" if score >= 40 else "saturated"

    stage("Drawing the idea landscape")
    sims_all = np.concatenate([[1.0], norm])
    try: land = landscape.build([{"id": "proposal", "title": p["title"], "source": "proposal", "url": None}] + items, X, sims_all, ex)
    except Exception as e: print("Landscape error", repr(e)); land = None; warns.append("The idea landscape could not be drawn for this run.")
    rec = recommend(ex, comps)
    if llm.client() and llm.stats["fail"]:
        warns.append("Some AI steps failed (wrong model name or rate limit), so parts of this result use fallback text. Run scripts/test_keys.py.")

    res = {"mode": "degraded" if warns else "live", "warnings": warns, "proposal": ex,
           "originality": {"score": score, "band": band, "breakdown": breakdown},
           "similar_projects": comps, "recommendations": rec, "landscape": land}
    if not warns: cache.put(ck, res)
    return res

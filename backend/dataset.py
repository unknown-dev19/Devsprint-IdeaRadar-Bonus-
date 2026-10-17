"""Deterministic dataset profiling (csv module only: no pandas). Every finding is a MEASURED fact, so it is real evidence."""
import csv, io, re, statistics, datetime as dt
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.I); PHONE = re.compile(r"^\+?\d[\d\s\-]{8,13}$")
isphone = lambda v: bool(PHONE.match(v)) and not DATE.match(v) and sum(ch.isdigit() for ch in v) >= 10
DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})|^(\d{2})[/-](\d{2})[/-](\d{4})")
PII_NAME = re.compile(r"e-?mail|phone|mobile|aadhaar|aadhar|\bpan\b|passport|ssn|address|dob|birth|full_?name|^name$|student_?name", re.I)
SENSITIVE = re.compile(r"gender|sex|caste|religion|race|ethnic|disab|category|nationality", re.I)
TARGET = re.compile(r"^(label|target|class|outcome|y|status|result|placed|churn|fraud|default|no_?show|passed|risk)$", re.I)

def _num(v):
    try: return float(v.replace(",", ""))
    except Exception: return None

def _date(v):
    m = DATE.match(v)
    try:
        if m and m.group(1): return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if m: return dt.date(int(m.group(6)), int(m.group(5)), int(m.group(4)))
    except ValueError: pass
    return None

def parse(text):
    text = text.strip().lstrip("\ufeff")
    try: dialect = csv.Sniffer().sniff(text[:4000], delimiters=",;\t|")
    except Exception: dialect = csv.excel
    rows = list(csv.reader(io.StringIO(text), dialect))
    rows = [r for r in rows if any(c.strip() for c in r)]
    if len(rows) < 2: raise ValueError("The dataset needs a header row and at least one data row.")
    head = [h.strip() or f"col{i+1}" for i, h in enumerate(rows[0][:60])]
    body = [(r + [""] * len(head))[:len(head)] for r in rows[1:20001]]
    return head, body

def profile(text):
    """-> {rows, cols, columns:[...], duplicates, facts:[{id,fact,kind,impact,likelihood,category,title,recommendation,question,columns}]}"""
    head, body = parse(text); n = len(body); cols = []; facts = []
    def add(kind, title, fact, cat, imp, rec, q, cs=()):
        facts.append({"id": f"D{len(facts)+1}", "kind": kind, "title": title, "fact": fact, "category": cat, "impact": imp,
                      "likelihood": 4, "recommendation": rec, "question": q, "columns": list(cs)})
    for j, h in enumerate(head):
        vals = [r[j].strip() for r in body]; ne = [v for v in vals if v and v.lower() not in ("na", "n/a", "null", "none", "nan", "-")]
        miss = 1 - len(ne) / n; nums = [x for x in (_num(v) for v in ne) if x is not None]
        c = {"name": h, "missing_pct": round(miss * 100, 1), "unique": len(set(ne)), "type": "text"}
        if ne and len(nums) / len(ne) >= .9:
            c["type"] = "number"; srt = sorted(nums)
            if len(srt) >= 8:
                q1, q3 = srt[len(srt) // 4], srt[3 * len(srt) // 4]; iqr = q3 - q1
                out = sum(1 for x in nums if iqr > 0 and (x < q1 - 3 * iqr or x > q3 + 3 * iqr))
                c.update(min=srt[0], max=srt[-1], mean=round(statistics.mean(nums), 2), outliers=out)
                if out / len(nums) >= .01 and out >= 2:
                    add("outliers", f"Extreme values in '{h}'", f"'{h}' has {out} extreme values ({out/len(nums)*100:.1f}%), range {srt[0]:g} to {srt[-1]:g}, typical middle {q1:g}-{q3:g}.",
                        "data_quality", 3, "Check whether extremes are sensor/entry errors or real events before training or averaging.",
                        f"Are the extreme values in '{h}' errors or real cases we must handle?", [h])
        elif ne and .5 <= len(nums) / len(ne) < .9:
            c["type"] = "mixed"
            add("mixed", f"Mixed types in '{h}'", f"'{h}' mixes numbers and text ({len(nums)} numeric of {len(ne)} filled values).", "data_quality", 3,
                "Define one type per column and clean or reject the rest at entry.", f"What do the non-numeric entries in '{h}' mean?", [h])
        ds = [d for d in (_date(v) for v in ne[:500]) if d]
        if ne and len(ds) / min(len(ne), 500) >= .9:
            c["type"] = "date"; c["from"], c["to"] = str(min(ds)), str(max(ds)); span = (max(ds) - min(ds)).days
            if 2 <= len(set(ds)) and span < 120: add("short_span", f"Data covers only {span} days ('{h}')", f"'{h}' runs {min(ds)} to {max(ds)} ({span} days): seasonal or yearly patterns cannot be learned or tested.",
                               "scale", 4, "Collect at least one full cycle (term or year) or state clearly that results are short-term only.",
                               "Does the period in the data match the period the system must work in?", [h])
            if (dt.date.today() - max(ds)).days > 730: add("stale", f"Data may be out of date ('{h}')", f"Latest value in '{h}' is {max(ds)}, over 2 years ago.",
                               "data_quality", 3, "Refresh the data or show the system still holds on recent records.", "Is old data still representative today?", [h])
        if miss >= .05: add("missing", f"{miss*100:.0f}% of '{h}' is missing", f"'{h}' is empty in {miss*100:.1f}% of {n} rows.", "data_quality",
                            5 if miss >= .3 else 4 if miss >= .15 else 3, "Decide per column: fill with a documented rule, drop the rows, or collect the value. Do not ignore silently.",
                            f"Why is '{h}' missing, and is it missing at random or for a reason?", [h])
        if ne and len(set(ne)) == 1 and n > 5: add("constant", f"'{h}' never changes", f"'{h}' has a single value ({ne[0][:30]}) in every row.", "data_quality", 2,
                                                    "Drop it or find out why variation is absent.", f"Is '{h}' supposed to vary?", [h])
        pii = bool(PII_NAME.search(h)) or (ne and sum(bool(EMAIL.match(v) or isphone(v)) for v in ne[:200]) / min(len(ne), 200) >= .5)
        if pii: c["pii"] = True; add("pii", f"Personal data in '{h}'", f"Column '{h}' looks like personally identifying data.", "privacy", 5,
                                    "Remove or hash it before analysis or sharing; document consent and retention.", f"Do we have consent and a need to hold '{h}'?", [h])
        if SENSITIVE.search(h): c["sensitive"] = True
        cols.append(c)
    seen, dups = set(), 0
    for r in body:
        t = tuple(r)
        if t in seen: dups += 1
        seen.add(t)
    if dups: add("duplicates", f"{dups} duplicate rows", f"{dups} of {n} rows ({dups/n*100:.1f}%) are exact duplicates, which inflates counts and leaks between train/test splits.",
                 "data_quality", 4, "Deduplicate before any split or statistic.", "Are duplicates real repeated events or entry mistakes?")
    if n < 200 or n < 10 * len(head): add("small", "Small sample", f"Only {n} rows for {len(head)} columns; patterns found may not generalise.", "metrics", 4,
                                          "Report uncertainty, use simple models/rules, and collect more data before claiming accuracy.", "Is this sample large enough to trust any result?")
    tgt = next((c for c in cols if TARGET.search(c["name"])), None) or (cols[-1] if cols and cols[-1]["type"] == "text" and cols[-1]["unique"] <= 5 else None)
    if tgt:
        k = head.index(tgt["name"]); cnt = {}
        for r in body:
            if r[k].strip(): cnt[r[k].strip()] = cnt.get(r[k].strip(), 0) + 1
        if 1 < len(cnt) <= 10:
            top, tot = max(cnt.items(), key=lambda x: x[1]), sum(cnt.values())
            tgt["target"] = True; tgt["distribution"] = {a: round(b / tot * 100, 1) for a, b in sorted(cnt.items(), key=lambda x: -x[1])}
            if top[1] / tot >= .8: add("imbalance", f"Class imbalance in '{tgt['name']}'", f"{top[1]/tot*100:.0f}% of '{tgt['name']}' is '{top[0]}': a model that always says '{top[0]}' looks {top[1]/tot*100:.0f}% accurate while learning nothing.",
                                       "metrics", 5, "Judge with precision/recall per class, not accuracy; resample or reweight and compare to a 'always majority' baseline.",
                                       f"What is the cost of missing the rare '{tgt['name']}' cases?", [tgt["name"]])
    sens = [c["name"] for c in cols if c.get("sensitive")]
    if sens: add("sensitive", "Sensitive attributes present", f"Columns {', '.join(repr(s) for s in sens)} are sensitive; outcomes may differ across groups.", "bias", 4,
                 "Compare error rates and outcomes per group before deploying; decide whether the attribute should be used at all.", "Could the system treat these groups unfairly?", sens)
    return {"rows": n, "cols": len(head), "columns": cols, "duplicates": dups, "facts": facts}

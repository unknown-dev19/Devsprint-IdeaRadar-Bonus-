"""Rule-based blind-spot checklist. Works with NO Gemini key.
Each category: id, name, regex (is the topic mentioned at all?), and a ready finding used when it is NOT mentioned.
`needs` = only relevant if the text matches this regex (e.g. bias only matters for ML/data projects)."""
import re
ML = r"model|predict|classif|train|machine learning|\bai\b|\bml\b|recommend|score|dataset|analytics"
# (id, name, mentioned-regex, needs-regex|None, title, unstated assumption, question, recommendation, impact, likelihood)
CATS = [
 ("privacy", "Privacy & consent", r"privacy|consent|gdpr|dpdp|anonymi|pseudonym|pii|personal data|data protection", None,
  "Personal data handling is not addressed", "Assumes it is fine to collect and store users' personal data.",
  "What personal data do we hold, who consented, and for how long do we keep it?",
  "Write a one-page data inventory: what is collected, why, retention period, and a consent/opt-out path.", 5, 3),
 ("security", "Security & access", r"auth|encrypt|security|access control|permission|role-based|threat|password", None,
  "No access-control or security model", "Assumes every user and component can be trusted.",
  "Who is allowed to see or change what, and what happens if an account or key leaks?",
  "Define roles and least-privilege access, keep secrets out of code, and list the top 3 abuse cases.", 4, 3),
 ("scale", "Scale & load", r"scal|concurrent|load|throughput|peak|users per|capacity|traffic", None,
  "Expected load and growth are not stated", "Assumes demo-level traffic will stay the norm.",
  "How many users/records at launch and in 12 months, and what is the peak moment?",
  "State expected volumes and test once at 10x; pick the first bottleneck to design around.", 3, 3),
 ("performance", "Latency & performance", r"latency|response time|real-time|realtime|performance|\bsla\b|speed|seconds", None,
  "No performance target", "Assumes 'fast enough' needs no number.",
  "What response time makes the product usable for the people who depend on it?",
  "Set a measurable target (e.g. 95% of requests under 3 s) and measure it in the demo.", 3, 3),
 ("failure", "Failure & recovery", r"failure|error handling|fallback|retry|rollback|outage|downtime|recover|backup|degrad", None,
  "No plan for when things fail", "Assumes every step, API and device works every time.",
  "What happens to the user and the data when a step, API or network fails midway?",
  "List each external dependency with its failure mode, a fallback, and a user-visible message.", 5, 4),
 ("data_quality", "Data quality", r"missing|clean|validat|data quality|outlier|duplicate|noise|inconsisten|preprocess", None,
  "Data quality is assumed, not checked", "Assumes inputs are complete, correct and consistent.",
  "How will we detect and handle missing, duplicate or wrong data before it drives decisions?",
  "Add validation at the entry point and a data-quality report (missing %, duplicates, outliers) before use.", 4, 4),
 ("provenance", "Data source & labels", r"data source|provenance|collected|collection|labell?ed|ground truth|annotat|source of data", ML,
  "Where the data comes from is not documented", "Assumes the data is trustworthy, current and legally usable.",
  "Who collected the data, when, how were labels produced, and may we use it for this purpose?",
  "Document source, collection date, labelling method and licence for every dataset.", 4, 3),
 ("bias", "Bias & fairness", r"bias|fairness|fair |demograph|representative|discriminat|equity|skew", ML,
  "Bias and representativeness are not considered", "Assumes the data represents everyone the system will affect.",
  "Which groups are under-represented, and who is harmed if the system is wrong for them?",
  "Compare outcomes across groups (gender, branch, region) and publish the gaps you find.", 4, 3),
 ("metrics", "Success metrics", r"success metric|kpi|accuracy|precision|recall|f1|evaluat|baseline|benchmark|measure|target of|goal of", None,
  "Success is not defined in measurable terms", "Assumes everyone already agrees what 'working' means.",
  "Which single number tells us this worked, and what is the baseline we must beat?",
  "Pick 1-2 metrics with a baseline (today's manual process) and a target before building more.", 4, 4),
 ("stakeholders", "Stakeholders & user research", r"stakeholder|user research|interview|survey|feedback|persona|pilot|end user|requirements", None,
  "No evidence that real users want this", "Assumes the team already knows what users need.",
  "Which real users have we spoken to, and what did they say they would change?",
  "Interview 3-5 intended users this week and record what they do today instead.", 4, 4),
 ("cost", "Cost & budget", r"cost|budget|pricing|free tier|billing|quota|licen[cs]e fee|expens", None,
  "Running cost is not estimated", "Assumes free tiers and volunteer effort will last.",
  "What does it cost per user per month at real volume, and who pays?",
  "Estimate API/hosting cost at expected volume and name who funds it after the event.", 3, 3),
 ("legal", "Legal & compliance", r"licen[cs]e|compliance|regulat|legal|copyright|terms of service|policy|law\b|statutory", None,
  "Legal and licence constraints are not checked", "Assumes data, models and APIs may be used freely.",
  "Which licences, terms of service or regulations restrict what we collect, store or publish?",
  "Check licences of data/APIs/libraries and any sector rules (education, health, finance).", 4, 2),
 ("dependencies", "External dependencies", r"dependency|dependencies|third-party|third party|rate limit|vendor|api key|quota|external service", None,
  "Dependence on outside services is not examined", "Assumes third-party APIs stay free, available and unchanged.",
  "Which outside services do we rely on, and what breaks if one changes or throttles us?",
  "List dependencies with limits and alternatives; cache or mock the critical ones.", 3, 4),
 ("accessibility", "Accessibility & inclusion", r"accessib|language|offline|low bandwidth|hindi|gujarati|locali[sz]|screen reader|mobile|disab", None,
  "Accessibility and low-connectivity users are not considered", "Assumes all users have good internet, a modern device and English.",
  "Who cannot use this as designed (language, device, connectivity, disability)?",
  "Test on a slow connection and a small phone, and add one regional language or offline path.", 3, 4),
 ("monitoring", "Monitoring & drift", r"monitor|logging|alert|observab|drift|dashboard of health|audit trail|telemetry", None,
  "No way to notice when it stops working", "Assumes problems will be reported by users.",
  "How will we know within a day that results have become wrong or the system is down?",
  "Log inputs/outputs, track a health metric, and set one alert for the worst failure.", 3, 4),
 ("human", "Human oversight", r"human in the loop|manual review|override|approval|escalat|appeal|reviewer|human check", ML,
  "No human check on automated decisions", "Assumes automated output is right and needs no review.",
  "Who can override a wrong automated result, and how quickly?",
  "Add a review/override path for low-confidence and high-stakes cases.", 5, 3),
 ("environment", "Deployment & environment", r"deploy|hosting|infrastructure|environment|device|hardware|on-prem|cloud|server", None,
  "Where and how it runs is not specified", "Assumes the demo environment equals the real one.",
  "Where will this run for real users, on what hardware, and who keeps it running?",
  "Choose the target environment now and run the demo there, not only on a laptop.", 3, 3),
 ("ownership", "Ownership & maintenance", r"owner|responsib|maintain|maintenance|handover|support|on-call|sustain", None,
  "Nobody owns it after the event", "Assumes the project maintains itself.",
  "Who fixes it, updates data and answers users after the first month?",
  "Name an owner, document setup in a README, and decide what 'done' means.", 3, 4),
 ("testing", "Testing & validation", r"\btest|validat|pilot|\bqa\b|\buat\b|verification|user testing", None,
  "No plan to test with realistic cases", "Assumes it works on real data because it works on samples.",
  "What realistic and adversarial cases have we tried, and what broke?",
  "Build a 20-case test set (typical, edge, hostile) and report the pass rate.", 4, 3),
 ("timeline", "Timeline & scope", r"timeline|milestone|deadline|schedule|sprint|phase|roadmap|week", None,
  "Timeline and scope limits are not set", "Assumes everything fits in the available time.",
  "What is the smallest version that still delivers value, and what is explicitly out of scope?",
  "Split work into must / should / later and write the out-of-scope list.", 2, 4),
]
IDS = [c[0] for c in CATS]
NAMES = {c[0]: c[1] for c in CATS}

def coverage(text, has_data=False):
    """-> list of {id, name, mentioned, applies}. `mentioned` = the topic appears anywhere in the supplied text."""
    t = text.lower(); out = []
    for cid, name, rx, needs, *_ in CATS:
        applies = (not needs) or bool(re.search(needs, t)) or has_data
        out.append({"id": cid, "name": name, "mentioned": bool(re.search(rx, t)), "applies": applies})
    return out

def rule_findings(cov):
    by = {c[0]: c for c in CATS}; res = []
    for c in cov:
        if c["mentioned"] or not c["applies"]: continue
        _, name, _, _, title, assume, q, rec, imp, lik = by[c["id"]]
        res.append({"type": "assumption", "category": c["id"], "title": title, "description": assume,
                    "question": q, "recommendation": rec, "impact": imp, "likelihood": lik, "origin": "rule", "effort": "low"})
    return res

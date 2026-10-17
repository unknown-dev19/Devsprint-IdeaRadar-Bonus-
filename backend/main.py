import traceback, uuid
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import config as C, pipeline

app = FastAPI(title="IdeaRadar")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

DEMOS = {
 "attendance": {"title": "Smart Attendance System", "description": "A web app that marks classroom attendance automatically using face recognition from a webcam, with reports for teachers.",
                "features": ["Face recognition check-in", "Teacher dashboard", "Attendance reports", "Email alerts for absentees"], "tech_stack": ["Python", "OpenCV", "React"]},
 "expense": {"title": "Student Expense Tracker", "description": "Tracks daily student spending, categorises expenses automatically and shows monthly budget insights.",
             "features": ["Auto-categorisation", "Monthly budget alerts", "Charts and insights", "Receipt scanning"], "tech_stack": ["React", "Node.js"]},
 "resume": {"title": "AI Resume Analyzer", "description": "Upload a resume and a job description to get an ATS match score and suggestions to improve the resume.",
            "features": ["ATS score", "Keyword gap analysis", "Improvement suggestions", "Job description matching"], "tech_stack": ["Python", "NLP"]},
}
JOBS = {}

class Req(BaseModel):
    title: str = ""
    description: str = ""
    features: list[str] = []
    tech_stack: list[str] = []
    demo_id: str | None = None

def work(jid, p):
    try: JOBS[jid]["result"] = pipeline.run(p, JOBS[jid]); JOBS[jid]["status"] = "done"
    except Exception as e: traceback.print_exc(); JOBS[jid].update(status="error", error=str(e))

@app.get("/api/health")
def health(): return {"ok": True, "gemini": bool(C.GEMINI_KEY), "github": bool(C.GITHUB_TOKEN)}

@app.get("/api/demos")
def demos(): return [{"id": k, "title": v["title"]} for k, v in DEMOS.items()]

@app.post("/api/analyze")
def analyze(req: Req, bg: BackgroundTasks):
    if req.demo_id and req.demo_id not in DEMOS: raise HTTPException(404, "Unknown example project.")
    if not req.demo_id and not req.title.strip(): raise HTTPException(400, "Please enter a project title.")
    p = DEMOS.get(req.demo_id) or req.model_dump(exclude={"demo_id"})
    if len(JOBS) > 50: JOBS.pop(next(iter(JOBS)))           # keep memory bounded
    jid = uuid.uuid4().hex[:8]; JOBS[jid] = {"status": "running", "stage": "Starting"}
    bg.add_task(work, jid, p); return {"job_id": jid}

@app.get("/api/jobs/{jid}")
def job(jid: str): return JOBS.get(jid, {"status": "error", "error": "Job not found: the server may have restarted. Please run the analysis again."})

# ---- Blind-Spot Finder (PS-6 mode) ----
import blindspots, demos

MAX_DATA = 2_500_000
class BSReq(BaseModel):
    title: str = ""
    document: str = ""
    workflow: str = ""
    dataset: str = ""
    dataset_name: str = ""
    demo_id: str | None = None

def bs_work(jid, p):
    try: JOBS[jid]["result"] = blindspots.run(p, JOBS[jid]); JOBS[jid]["status"] = "done"
    except Exception as e: traceback.print_exc(); JOBS[jid].update(status="error", error=str(e))

@app.get("/api/bs-demos")
def bs_demos(): return [{"id": k, "title": v["title"]} for k, v in demos.BS_DEMOS.items()]

@app.post("/api/blindspots")
def blind(req: BSReq, bg: BackgroundTasks):
    if req.demo_id and req.demo_id not in demos.BS_DEMOS: raise HTTPException(404, "Unknown example project.")
    p = demos.load(req.demo_id) if req.demo_id else req.model_dump(exclude={"demo_id"})
    if not req.demo_id and not (p["title"].strip() or p["document"].strip() or p["dataset"].strip()): raise HTTPException(400, "Add a title and a document, workflow or dataset.")
    if len(p["dataset"]) > MAX_DATA: raise HTTPException(400, "Dataset is larger than about 2 MB. Upload a sample of it.")
    if not p["title"].strip(): p["title"] = "Untitled project"
    if len(JOBS) > 50: JOBS.pop(next(iter(JOBS)))
    jid = uuid.uuid4().hex[:8]; JOBS[jid] = {"status": "running", "stage": "Starting"}
    bg.add_task(bs_work, jid, p); return {"job_id": jid}

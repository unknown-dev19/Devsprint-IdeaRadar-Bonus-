"""Demo inputs for Blind-Spot mode: a plan, a workflow and a deliberately messy dataset each. Deterministic (seeded)."""
import random, datetime as dt

def _csv(head, rows): return "\n".join([",".join(head)] + [",".join(str(x) for x in r) for r in rows])

def _placement():
    r = random.Random(7); rows = []
    for i in range(240):
        g = r.choice(["M", "M", "M", "F"]); cg = round(r.uniform(5.2, 9.6), 2)
        rows.append([f"S{1000+i}", f"Student {i}", f"s{i}@campus.edu", g, "" if r.random() < .18 else cg, r.choice(["CE", "IT", "EC", "ME"]),
                     r.choice([0, 0, 1, 2]), r.choice([0, 0, 0, 1, 3]), "2021-06-30", "Yes" if r.random() < .88 else "No"])
    rows += [rows[3], rows[9], rows[40]]
    return _csv(["student_id", "name", "email", "gender", "cgpa", "branch", "internships", "backlogs", "batch_end", "placed"], rows)

def _clinic():
    r = random.Random(11); rows = []; d0 = dt.date(2025, 3, 1)
    for i in range(160):
        d = d0 + dt.timedelta(days=r.randint(0, 40))
        rows.append([f"A{i}", d.isoformat(), r.choice(["Child", "General", "Prenatal"]), r.randint(1, 70), "" if r.random() < .27 else f"9{r.randint(10**8, 10**9-1)}",
                     round(r.uniform(0.5, 18), 1) if r.random() > .03 else 480, "No" if r.random() < .84 else "Yes"])
    return _csv(["appt_id", "date", "visit_type", "age", "phone", "distance_km", "no_show"], rows)

def _energy():
    r = random.Random(3); rows = []; t = dt.datetime(2025, 8, 1)
    for i in range(300):
        t += dt.timedelta(hours=r.choice([1, 1, 1, 6]))
        kwh = round(r.uniform(12, 55), 1) if r.random() > .02 else r.choice([-1, 9999])
        rows.append([f"B{r.randint(1,6)}", t.date().isoformat(), kwh, "" if r.random() < .09 else round(r.uniform(22, 36), 1)])
    return _csv(["building", "date", "kwh", "outdoor_temp_c"], rows)

BS_DEMOS = {
 "placement": {"title": "Campus Placement Predictor",
  "document": "We will train a model on last year's placement records to predict which students will be placed, so the training cell can focus counselling on at-risk students. "
              "The model uses CGPA, branch, internships and backlogs. Students get a placement probability on a dashboard visible to faculty. "
              "Goal: reach 90% accuracy. The team will build the dashboard in React with a FastAPI backend and demo it live.",
  "workflow": "1. Export records from the college ERP as CSV\n2. Clean and train the model\n3. Publish predictions to the faculty dashboard\n4. Faculty contact students with low probability",
  "dataset_name": "placements_2021.csv", "dataset": _placement},
 "clinic": {"title": "Rural Clinic Appointment Scheduler",
  "document": "A mobile web app for a rural primary health centre. Patients book appointments by phone number and receive SMS reminders to reduce no-shows. "
              "A model predicts which patients will not show up so the clinic can overbook slots. The app will be deployed on a free cloud tier and use a paid SMS gateway API.",
  "workflow": "1. Patient enters phone number and visit type\n2. System books the next free slot\n3. SMS reminder is sent a day before\n4. Staff mark attendance\n5. Model retrains weekly",
  "dataset_name": "appointments.csv", "dataset": _clinic},
 "energy": {"title": "Smart Campus Energy Dashboard",
  "document": "We will analyse electricity meter readings from six campus buildings to find savings and forecast next month's consumption. "
              "Readings come from the maintenance office spreadsheet. The dashboard will recommend switching off equipment in the highest-use buildings and report the expected rupee savings to the registrar.",
  "workflow": "1. Collect meter readings from the office\n2. Upload to the dashboard\n3. Forecast consumption\n4. Show savings recommendations",
  "dataset_name": "meter_readings.csv", "dataset": _energy},
}
def load(demo_id):
    d = BS_DEMOS[demo_id]; return {"title": d["title"], "document": d["document"], "workflow": d["workflow"], "dataset_name": d["dataset_name"], "dataset": d["dataset"]()}

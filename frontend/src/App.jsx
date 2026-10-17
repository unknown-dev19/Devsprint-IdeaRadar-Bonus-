import { useCallback, useEffect, useRef, useState } from "react";
import TopoBackground from "@/components/effects/topo-background";
import Stepper, { BLIND_STEPS, OVERLAP_STEPS } from "@/components/Stepper";
import { AnimatedBadge, Button, Card, Chip, Icon, Input, Logo, PulsatingDots, Segmented, ShimmerButton, Textarea, ThemeToggle } from "@/components/ui";
import { cn } from "@/lib/utils";
import BlindSpots from "./BlindSpots";
import Results from "./Results";

const POLL_MS = 1000;
const GIVE_UP_MS = 180000; // stop polling after 3 minutes
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One place for all backend calls: real error text instead of "failed".
async function api(path, options) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new Error("Cannot reach the backend. Is `uvicorn main:app --reload` running on port 8000?");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      const d = body.detail ?? body.error;
      if (d) msg = typeof d === "string" ? d : JSON.stringify(d);
    } catch {
      /* keep the generic message */
    }
    throw new Error(msg);
  }
  return res.json();
}

const splitLines = (s) => s.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
const splitCommas = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

function Health({ health }) {
  if (!health) return null;
  if (health.offline) return <Chip tone="red">Backend offline</Chip>;
  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      <Chip tone="green">Backend online</Chip>
      <Chip tone={health.gemini ? "green" : "amber"}>{health.gemini ? "Gemini on" : "Gemini off (approximate mode)"}</Chip>
      <Chip tone={health.github ? "green" : "amber"}>{health.github ? "GitHub token" : "GitHub: no token"}</Chip>
    </div>
  );
}

const HOW_BLIND = [
  { icon: "alert", title: "Find what is missing", text: "Hidden assumptions, overlooked constraints and conflicts, found in your document, workflow and data." },
  { icon: "target", title: "Rank by impact", text: "Every finding gets impact, likelihood and an evidence confidence, so you fix the worst first." },
  { icon: "spark", title: "Show the evidence", text: "Word-for-word quotes, measured dataset facts and related real projects. Nothing is claimed without a source." },
];

function FileButton({ accept, label, onText, onTooBig }) {
  const ref = useRef(null);
  const change = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2400000) return onTooBig?.(f.name);
    try {
      onText(await f.text(), f.name);
    } catch {
      onTooBig?.(f.name);
    }
  };
  return (
    <>
      <input accept={accept} className="hidden" onChange={change} ref={ref} type="file" />
      <Button onClick={() => ref.current?.click()} size="xs" variant="outline">
        <Icon className="size-3.5" name="upload" /> {label}
      </Button>
    </>
  );
}

const HOW = [
  { icon: "target", title: "Find the overlap", text: "Real GitHub repos plus past college projects, ranked by meaning, not keywords." },
  { icon: "spark", title: "Explain it", text: "Feature-by-feature table and an originality score where every point is accounted for." },
  { icon: "map", title: "Show where to differ", text: "The idea landscape: a terrain of crowded and relatively unexplored ground." },
];

export default function App() {
  const [health, setHealth] = useState(null);
  const [demos, setDemos] = useState([]);
  const [bsDemos, setBsDemos] = useState([]);
  const [mode, setMode] = useState("blind"); // blind | overlap
  const [kind, setKind] = useState("blind"); // which result is on screen
  const [bs, setBs] = useState({ title: "", document: "", workflow: "", dataset: "", dataset_name: "" });
  const [form, setForm] = useState({ title: "", description: "", features: "", tech: "" });
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [stage, setStage] = useState("");
  const [label, setLabel] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const token = useRef(0);
  const resultsRef = useRef(null);

  useEffect(() => {
    api("/health").then(setHealth).catch(() => setHealth({ offline: true }));
    api("/demos").then((d) => setDemos(Array.isArray(d) ? d : [])).catch(() => setDemos([]));
    api("/bs-demos").then((d) => setBsDemos(Array.isArray(d) ? d : [])).catch(() => setBsDemos([]));
    return () => {
      token.current += 1; // stop any polling loop on unmount
    };
  }, []);

  const start = useCallback(async (payload, name, endpoint = "/analyze", resultKind = "overlap") => {
    const mine = ++token.current;
    setKind(resultKind);
    setStatus("running");
    setResult(null);
    setError("");
    setStage("Sending to the analyzer");
    setLabel(name);
    setStartedAt(Date.now());
    try {
      const { job_id } = await api(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const t0 = Date.now();
      while (token.current === mine) {
        await sleep(POLL_MS);
        if (token.current !== mine) return;
        if (Date.now() - t0 > GIVE_UP_MS) {
          throw new Error("This is taking over 3 minutes. Check the backend terminal for errors, then try again.");
        }
        const job = await api(`/jobs/${job_id}`);
        if (token.current !== mine) return;
        if (job.stage) setStage(job.stage);
        if (job.status === "done") {
          setResult(job.result);
          setStatus("done");
          return;
        }
        if (job.status === "error") throw new Error(job.error || "The analysis failed on the server.");
      }
    } catch (e) {
      if (token.current !== mine) return;
      setError(e.message || String(e));
      setStatus("error");
    }
  }, []);

  // After a result arrives, bring it into view.
  useEffect(() => {
    if (status === "done" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [status]);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Give your project a title first.");
      setStatus("error");
      return;
    }
    start(
      {
        title: form.title.trim(),
        description: form.description.trim(),
        features: splitLines(form.features),
        tech_stack: splitCommas(form.tech),
      },
      form.title.trim()
    );
  };

  const runDemo = (d) => start({ demo_id: d.id, title: d.title }, d.title);
  const runBsDemo = (d) => start({ demo_id: d.id, title: d.title }, d.title, "/blindspots", "blind");
  const submitBs = (e) => {
    e.preventDefault();
    if (!bs.title.trim() && !bs.document.trim() && !bs.dataset) {
      setError("Add a title and a document, workflow or dataset first.");
      setStatus("error");
      return;
    }
    start({ ...bs, title: bs.title.trim() || "Untitled project" }, bs.title.trim() || "your project", "/blindspots", "blind");
  };
  const tooBig = (name) => {
    setError(`${name} could not be read or is larger than about 2 MB. Try a smaller sample, or a plain text / CSV file.`);
    setStatus("error");
  };
  const setB = (k) => (e) => setBs((f) => ({ ...f, [k]: e.target.value }));
  const reset = () => {
    token.current += 1;
    setStatus("idle");
    setError("");
    setResult(null);
  };

  const running = status === "running";
  const showForm = status === "idle" || status === "error";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-900/10 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Logo className="text-red-500" />
            <span className="text-base font-medium text-gray-800 dark:text-white">
              Idea<span className="text-[11px] font-bold text-red-500">Radar</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Health health={health} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <TopoBackground
        className={cn(
          "text-red-500/70 dark:text-red-300 transition-[min-height] duration-500",
          showForm ? "min-h-[680px] py-10" : "min-h-[340px] py-8"
        )}
      >
        <div className="relative z-10 w-full max-w-3xl px-6 text-neutral-900 dark:text-white">
          {showForm ? (
            <div className="rise">
              <div className="mb-8 text-center">
                <AnimatedBadge className="mb-5">GDG DevSprint · Round 2</AnimatedBadge>
                <div className="mb-5 flex justify-center">
                  <Segmented
                    label="Mode"
                    onChange={(m) => { setMode(m); setStatus("idle"); setError(""); }}
                    options={[{ id: "blind", label: "Blind-spot finder", icon: "alert" }, { id: "overlap", label: "Idea overlap", icon: "map" }]}
                    value={mode}
                  />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                  {mode === "blind" ? "What haven't you thought of?" : "Is your idea already out there?"}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-balance text-base text-gray-600 dark:text-gray-300">
                  {mode === "blind"
                    ? "Give IdeaRadar your project document, workflow or dataset. It finds the missing assumptions, overlooked constraints and unasked questions, ranked by impact, with evidence."
                    : "Paste a project proposal. IdeaRadar finds similar repos and past projects, explains the overlap, and shows where you can be different."}
                </p>
              </div>

              {mode === "blind" ? (
              <form
                className="space-y-3 rounded-lg border border-neutral-200 bg-white/90 p-5 text-left shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85"
                onSubmit={submitBs}
              >
                <Input aria-label="Project title" onChange={setB("title")} placeholder="Project title, e.g. Campus placement predictor" value={bs.title} />
                <div className="relative">
                  <Textarea
                    aria-label="Project document"
                    className="min-h-32"
                    onChange={setB("document")}
                    placeholder="Paste your proposal, README, requirements or plan here..."
                    value={bs.document}
                  />
                  <div className="mt-2">
                    <FileButton accept=".txt,.md,.markdown,.json,.csv,.log" label="Load document file" onText={(t) => setBs((f) => ({ ...f, document: t.slice(0, 60000) }))} onTooBig={tooBig} />
                  </div>
                </div>
                <Textarea
                  aria-label="Workflow"
                  className="min-h-20"
                  onChange={setB("workflow")}
                  placeholder={"Workflow, one step per line (optional)\n1. Collect data\n2. Train model\n3. Show results"}
                  value={bs.workflow}
                />
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-neutral-300 px-3 py-2 dark:border-neutral-700">
                  <span className="text-xs text-zinc-500">Dataset (optional):</span>
                  {bs.dataset ? (
                    <>
                      <Chip tone="green">{bs.dataset_name} loaded</Chip>
                      <Button onClick={() => setBs((f) => ({ ...f, dataset: "", dataset_name: "" }))} size="xs" variant="link">Remove</Button>
                    </>
                  ) : (
                    <FileButton accept=".csv,.tsv,.txt" label="Upload CSV" onText={(t, n) => setBs((f) => ({ ...f, dataset: t, dataset_name: n }))} onTooBig={tooBig} />
                  )}
                </div>

                {status === "error" && error ? (
                  <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300" role="alert">
                    <Icon className="mt-0.5" name="alert" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {bsDemos.length ? <span className="text-xs text-zinc-500">Try a demo:</span> : null}
                    {bsDemos.map((d) => (
                      <Button key={d.id} onClick={() => runBsDemo(d)} size="xs" variant="outline">{d.title}</Button>
                    ))}
                  </div>
                  <ShimmerButton type="submit">
                    Find blind spots
                    <Icon className="transition-transform duration-200 group-hover:translate-x-0.5" name="arrow" />
                  </ShimmerButton>
                </div>
              </form>
              ) : (
              <form
                className="space-y-3 rounded-lg border border-neutral-200 bg-white/90 p-5 text-left shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85"
                onSubmit={submit}
              >
                <Input
                  aria-label="Project title"
                  onChange={set("title")}
                  placeholder="Project title, e.g. Face-recognition attendance app"
                  value={form.title}
                />
                <Textarea
                  aria-label="Description"
                  className="min-h-24"
                  onChange={set("description")}
                  placeholder="What problem does it solve, and for whom?"
                  value={form.description}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Textarea
                    aria-label="Features"
                    className="min-h-20"
                    onChange={set("features")}
                    placeholder={"Key features (one per line)\nQR check-in\nMonthly report"}
                    value={form.features}
                  />
                  <Textarea
                    aria-label="Tech stack"
                    className="min-h-20"
                    onChange={set("tech")}
                    placeholder="Tech stack, comma separated: React, FastAPI, SQLite"
                    value={form.tech}
                  />
                </div>

                {status === "error" && error ? (
                  <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300" role="alert">
                    <Icon className="mt-0.5" name="alert" />
                    <span>{error}</span>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {demos.length ? <span className="text-xs text-zinc-500">Try a demo:</span> : null}
                    {demos.map((d) => (
                      <Button key={d.id} onClick={() => runDemo(d)} size="xs" variant="outline">{d.title}</Button>
                    ))}
                  </div>
                  <ShimmerButton type="submit">
                    Analyze idea
                    <Icon className="transition-transform duration-200 group-hover:translate-x-0.5" name="arrow" />
                  </ShimmerButton>
                </div>
              </form>
              )}
            </div>
          ) : running ? (
            <div className="rise">
              <p className="mb-4 text-center text-2xl font-bold tracking-tight">
                {kind === "blind" ? "Reviewing" : "Scanning for"} <span className="text-red-500">{label}</span>
              </p>
              <Stepper key={startedAt} stage={stage} startedAt={startedAt} steps={kind === "blind" ? BLIND_STEPS : OVERLAP_STEPS} />
              <div className="mt-4 text-center">
                <Button onClick={reset} size="xs" variant="link">Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="rise flex flex-col items-center gap-4 text-center">
              <Chip tone="green">Analysis ready</Chip>
              <p className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{label}</p>
              <Button onClick={reset} variant="outline">
                New analysis
              </Button>
            </div>
          )}
        </div>
      </TopoBackground>

      {status === "idle" ? (
        <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-16 sm:grid-cols-3">
          {(mode === "blind" ? HOW_BLIND : HOW).map((h) => (
            <Card className="p-5" key={h.title}>
              <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-red-500/10 text-red-500">
                <Icon className="size-4.5" name={h.icon} />
              </span>
              <p className="font-medium">{h.title}</p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{h.text}</p>
            </Card>
          ))}
        </section>
      ) : null}

      {status === "done" && result ? (
        <main className="mx-auto max-w-6xl scroll-mt-16 px-6 pb-20 pt-4" ref={resultsRef}>
          {kind === "blind" ? <BlindSpots result={result} /> : <Results result={result} />}
        </main>
      ) : null}

      {running ? (
        <p className="flex items-center justify-center gap-2 pb-16 text-xs text-zinc-500">
          <PulsatingDots dot="size-1.5" /> Results appear here when the analysis finishes.
        </p>
      ) : null}
    </div>
  );
}

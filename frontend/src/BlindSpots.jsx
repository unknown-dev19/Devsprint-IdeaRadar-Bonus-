import { useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Icon, Meter, Segmented, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

const arr = (v) => (Array.isArray(v) ? v : []);
const TIERS = {
  critical: { tone: "red", text: "Critical", dot: "fill-rose-500", ring: "text-rose-600 dark:text-rose-300" },
  high: { tone: "amber", text: "High", dot: "fill-amber-500", ring: "text-amber-600 dark:text-amber-300" },
  medium: { tone: "sky", text: "Medium", dot: "fill-sky-500", ring: "text-sky-600 dark:text-sky-300" },
  low: { tone: "zinc", text: "Low", dot: "fill-zinc-400", ring: "text-zinc-500" },
};
const TYPES = {
  assumption: { tone: "brand", text: "Hidden assumption" },
  constraint: { tone: "sky", text: "Overlooked constraint" },
  question: { tone: "green", text: "Unasked question" },
  conflict: { tone: "red", text: "Conflict" },
};
const MODES = {
  live: { tone: "green", text: "Live analysis" },
  cached: { tone: "sky", text: "Replayed from cache" },
  degraded: { tone: "amber", text: "Partial: some services were unavailable" },
};
const tierOf = (p) => (p >= 60 ? "critical" : p >= 40 ? "high" : p >= 20 ? "medium" : "low");

function Evidence({ f }) {
  const quote = f.quote;
  const data = arr(f.data);
  const refs = arr(f.references);
  return (
    <div className="space-y-2">
      {quote ? (
        <div className="rounded-md bg-emerald-500/5 px-3 py-2 ring-1 ring-emerald-500/20">
          <p className="text-sm italic text-zinc-700 dark:text-zinc-300">&ldquo;{quote}&rdquo;</p>
          <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Found word-for-word in your text</p>
        </div>
      ) : null}
      {data.map((d) => (
        <div className="flex gap-2 rounded-md bg-sky-500/5 px-3 py-2 text-sm ring-1 ring-sky-500/20" key={d.id}>
          <Chip tone="sky">{d.id}</Chip>
          <span className="text-zinc-700 dark:text-zinc-300">{d.fact}</span>
        </div>
      ))}
      {!quote && !data.length ? (
        <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
          {f.origin === "rule"
            ? "Evidence is an absence: your text never mentions this topic. Lower confidence, because it may be covered elsewhere."
            : "AI inference from the overall text. No direct quote supports it, so it is weighted lower."}
        </p>
      ) : null}
      {refs.map((r) => (
        <div className="flex items-start gap-2 rounded-md px-3 py-2 text-sm ring-1 ring-zinc-200 dark:ring-zinc-800" key={r.name}>
          <Icon className="mt-0.5 text-zinc-400" name={r.source === "github" ? "branch" : "archive"} />
          <div className="min-w-0">
            <p className="font-medium">
              {r.url ? (
                <a className="underline-offset-4 hover:underline" href={r.url} rel="noreferrer" target="_blank">{r.name}</a>
              ) : (
                r.name
              )}{" "}
              <span className="text-xs font-normal text-zinc-500">· related project, {r.similarity_pct}% similar topic</span>
            </p>
            <p className="truncate text-xs text-zinc-500">{r.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FindingCard({ f, rank, open, onToggle, status, onStatus }) {
  const T = TIERS[f.tier] || TIERS.low;
  const Y = TYPES[f.type] || TYPES.assumption;
  const origin = f.origin === "data" ? ["green", "Measured in dataset"] : f.quote ? ["green", "Quoted from your text"] : f.origin === "ai" ? ["amber", "AI inference"] : ["brand", "Not mentioned in your text"];
  return (
    <Card className={cn("overflow-hidden", status && "opacity-55")} id={`finding-${f.id}`}>
      <button className="flex w-full items-start gap-3 p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-red-400/60" onClick={onToggle} type="button">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold tabular-nums dark:bg-white/10">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className={cn("block font-medium", status && "line-through")}>{f.title}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <Chip tone={Y.tone}>{Y.text}</Chip>
            <Chip tone={T.tone}>{T.text}</Chip>
            <Chip tone={origin[0]}>{origin[1]}</Chip>
            {status ? <Chip>{status === "done" ? "Addressed" : "Not relevant"}</Chip> : null}
          </span>
        </span>
        <span className="text-right">
          <span className={cn("block font-display text-2xl font-semibold tabular-nums leading-none", T.ring)}>{f.priority}</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">priority</span>
        </span>
        <Icon className={cn("mt-1 text-zinc-400 transition-transform", open && "rotate-180")} name="chevron" />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-zinc-100 p-4 pt-4 dark:border-zinc-800/80">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{f.description}</p>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Evidence</p>
            <Evidence f={f} />
          </div>
          <div className="rounded-lg bg-red-500/5 p-3 ring-1 ring-red-500/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-600 dark:text-red-300">Recommendation · effort {f.effort}</p>
            <p className="mt-1 text-sm">{f.recommendation}</p>
          </div>
          {f.question ? (
            <p className="flex gap-2 text-sm">
              <Icon className="mt-0.5 text-zinc-400" name="help" />
              <span><span className="font-medium">Ask:</span> {f.question}</span>
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            {[["Impact if real", f.impact / 5, `${f.impact}/5`], ["Likelihood it is real", f.likelihood / 5, `${f.likelihood}/5`], ["Evidence confidence", f.confidence, `${Math.round(f.confidence * 100)}%`]].map(([l, v, t]) => (
              <div key={l}>
                <p className="mb-1 flex justify-between text-xs text-zinc-500"><span>{l}</span><span className="tabular-nums">{t}</span></p>
                <Meter tone={tierOf(f.priority) === "critical" ? "red" : "brand"} value={v} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onStatus(status === "done" ? null : "done")} size="xs" variant="outline">
              {status === "done" ? "Mark open" : "Mark addressed"}
            </Button>
            <Button onClick={() => onStatus(status === "na" ? null : "na")} size="xs" variant="outline">
              {status === "na" ? "Mark open" : "Not relevant"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

const OFFSETS = [[0, 0], [-16, -12], [16, -12], [-16, 12], [16, 12], [0, -22], [0, 22]];
function Matrix({ findings, onPick }) {
  const W = 64, H = 50, X0 = 44, Y0 = 8;
  const seen = {};
  return (
    <svg className="w-full max-w-xl" viewBox="0 0 370 310">
      {[0, 1, 2, 3, 4].flatMap((r) =>
        [0, 1, 2, 3, 4].map((c) => {
          const risk = (5 - r) * (c + 1);
          return (
            <rect className={risk >= 16 ? "fill-rose-500/15" : risk >= 9 ? "fill-amber-500/10" : "fill-zinc-500/5"} height={H - 2} key={`${r}${c}`} rx="6" width={W - 2} x={X0 + c * W} y={Y0 + r * H} />
          );
        })
      )}
      {[1, 2, 3, 4, 5].map((n) => (
        <g key={n}>
          <text className="fill-zinc-500 text-[10px]" textAnchor="middle" x={X0 + (n - 1) * W + W / 2} y={Y0 + 5 * H + 14}>{n}</text>
          <text className="fill-zinc-500 text-[10px]" textAnchor="end" x={X0 - 8} y={Y0 + (5 - n) * H + H / 2 + 3}>{n}</text>
        </g>
      ))}
      <text className="fill-zinc-500 text-[10px]" textAnchor="middle" x={X0 + (5 * W) / 2} y={Y0 + 5 * H + 30}>Likelihood it is real →</text>
      <text className="fill-zinc-500 text-[10px]" textAnchor="middle" transform={`rotate(-90 12 ${Y0 + (5 * H) / 2})`} x="12" y={Y0 + (5 * H) / 2}>Impact if real →</text>
      {findings.map((f) => {
        const k = `${f.impact}-${f.likelihood}`;
        const i = (seen[k] = (seen[k] ?? -1) + 1);
        const [dx, dy] = OFFSETS[i % OFFSETS.length];
        const cx = X0 + (f.likelihood - 1) * W + W / 2 + dx, cy = Y0 + (5 - f.impact) * H + H / 2 - 1 + dy;
        return (
          <g className="cursor-pointer" key={f.id} onClick={() => onPick(f.id)}>
            <title>{f.title}</title>
            <circle className={(TIERS[f.tier] || TIERS.low).dot} cx={cx} cy={cy} r="10" />
            <text className="pointer-events-none fill-white text-[9px] font-semibold" textAnchor="middle" x={cx} y={cy + 3}>{f.rank}</text>
          </g>
        );
      })}
    </svg>
  );
}

function markdown(r, findings, status) {
  const L = [`# Blind-spot report: ${r.title}`, "", r.summary, "", `Exposure score: ${r.exposure.score}/100 (${r.exposure.tier})`, "", "## Findings, ranked by priority", ""];
  findings.forEach((f) => {
    L.push(`### ${f.rank}. ${f.title} [${f.tier}, priority ${f.priority}]${status[f.id] ? ` (${status[f.id] === "done" ? "addressed" : "not relevant"})` : ""}`, `*${(TYPES[f.type] || {}).text}* · impact ${f.impact}/5 · likelihood ${f.likelihood}/5 · confidence ${Math.round(f.confidence * 100)}%`, "", f.description, "");
    if (f.quote) L.push(`- Evidence (your text): "${f.quote}"`);
    arr(f.data).forEach((d) => L.push(`- Evidence (data ${d.id}): ${d.fact}`));
    arr(f.references).forEach((x) => L.push(`- Related project: ${x.name}${x.url ? ` (${x.url})` : ""}, ${x.similarity_pct}% similar topic`));
    L.push(`- **Recommendation:** ${f.recommendation}`, `- **Ask:** ${f.question}`, "");
  });
  L.push("---", `Scoring: ${r.formula}. Evidence confidence: measured data 100%, quoted text 95%, AI inference 70%, topic-absence rule 60%.`);
  return L.join("\n");
}

export default function BlindSpots({ result }) {
  const base = useMemo(() => arr(result.findings).map((f, i) => ({ ...f, rank: i + 1 })), [result]);
  const [tab, setTab] = useState("findings");
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState({});
  const [open, setOpen] = useState(() => new Set(base.slice(0, 2).map((f) => f.id)));
  const [copied, setCopied] = useState(false);
  const live = base.filter((f) => !status[f.id]);
  const top = live.slice(0, 5).map((f) => f.priority);
  const exposure = top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length) : 0;
  const T = TIERS[tierOf(exposure)];
  const M = MODES[result.mode] || MODES.live;
  const shown = base.filter((f) => filter === "all" || f.type === filter);
  const ds = result.dataset;

  useEffect(() => { setStatus({}); setTab("findings"); setFilter("all"); }, [result]);
  const pick = (id) => {
    setTab("findings"); setFilter("all"); setOpen((s) => new Set(s).add(id));
    setTimeout(() => document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown(result, base, status)], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "blind-spot-report.md" });
    a.click(); URL.revokeObjectURL(url);
  };
  const questions = base.filter((f) => f.question);
  const copy = async () => {
    try { await navigator.clipboard.writeText(questions.map((f, i) => `${i + 1}. ${f.question}`).join("\n")); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: ignore */ }
  };
  const mentioned = arr(result.coverage).filter((c) => c.applies);

  return (
    <div className="rise space-y-5">
      {arr(result.warnings).map((w) => (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" key={w} role="status">
          <Icon className="mt-0.5" name="alert" /><span>{w}</span>
        </div>
      ))}

      <Card className="grid gap-6 p-6 md:grid-cols-[200px_1fr]">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Blind-spot exposure</p>
          <p className={cn("font-display text-6xl font-semibold tabular-nums", T.ring)}>{exposure}</p>
          <Chip tone={T.tone}>{T.text}</Chip>
          {exposure !== result.exposure.score ? <p className="mt-2 text-xs text-zinc-500">was {result.exposure.score} before your changes</p> : null}
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone={M.tone}>{M.text}</Chip>
            {Object.entries(result.counts || {}).filter(([, n]) => n).map(([t, n]) => <Chip key={t} tone={TYPES[t]?.tone}>{n} {TYPES[t]?.text.toLowerCase()}{n > 1 ? "s" : ""}</Chip>)}
          </div>
          <p className="text-base text-zinc-800 dark:text-zinc-200">{result.summary}</p>
          <p className="mt-3 text-xs text-zinc-500">
            Priority = impact × likelihood × evidence confidence (measured data 100%, quoted text 95%, AI inference 70%, absence rule 60%). Exposure = average of your 5 highest open priorities.
          </p>
          <Button className="mt-3" onClick={download} size="sm" variant="outline">
            <Icon name="download" /> Export report (.md)
          </Button>
        </div>
      </Card>

      <div className="flex justify-center">
        <Segmented onChange={setTab} options={[{ id: "findings", label: `Findings (${base.length})` }, { id: "matrix", label: "Impact map", icon: "target" }, { id: "questions", label: "Questions", icon: "help" }, ...(ds ? [{ id: "data", label: "Dataset" }] : [])]} value={tab} />
      </div>

      {tab === "findings" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {["all", ...Object.keys(TYPES)].map((t) => (
              <Button className={filter === t ? "border-transparent" : ""} key={t} onClick={() => setFilter(t)} size="xs" variant={filter === t ? "brand" : "outline"}>
                {t === "all" ? "All" : TYPES[t].text}
              </Button>
            ))}
          </div>
          {shown.length ? shown.map((f) => <FindingCard f={f} key={f.id} onStatus={(s) => setStatus((m) => ({ ...m, [f.id]: s }))} onToggle={() => toggle(f.id)} open={open.has(f.id)} rank={f.rank} status={status[f.id]} />) : <p className="py-8 text-center text-sm text-zinc-500">Nothing of this type was found.</p>}
        </div>
      ) : null}

      {tab === "matrix" ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <Card className="p-5">
            <SectionTitle eyebrow="Prioritisation" aside={<span className="text-xs text-zinc-500">click a dot</span>}>Impact × likelihood</SectionTitle>
            <Matrix findings={live} onPick={pick} />
          </Card>
          <Card className="p-5">
            <SectionTitle eyebrow="Checklist" >What your text mentions</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {mentioned.map((c) => <Chip key={c.id} tone={c.mentioned ? "green" : "red"}>{c.mentioned ? "✓" : "✗"} {c.name}</Chip>)}
            </div>
            <p className="mt-3 text-xs text-zinc-500">A topic counts as mentioned if it appears anywhere. It does not prove the topic is handled well.</p>
          </Card>
        </div>
      ) : null}

      {tab === "questions" ? (
        <Card className="p-5">
          <SectionTitle aside={<Button onClick={copy} size="xs" variant="outline">{copied ? <Icon className="size-3.5" name="check" /> : null}{copied ? "Copied" : "Copy all"}</Button>} eyebrow="For your team, mentor or client">Questions you may not have asked</SectionTitle>
          <ol className="space-y-3">
            {questions.map((f, i) => (
              <li className="flex gap-3 text-sm" key={f.id}>
                <span className="w-5 shrink-0 text-right tabular-nums text-zinc-400">{i + 1}.</span>
                <span><span className={status[f.id] ? "line-through opacity-60" : ""}>{f.question}</span> <button className="ml-1 text-xs text-red-500 underline-offset-4 hover:underline" onClick={() => pick(f.id)} type="button">why?</button></span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {tab === "data" && ds ? (
        <Card className="overflow-x-auto p-5">
          <SectionTitle eyebrow={ds.name} aside={<span className="text-xs text-zinc-500">{ds.rows} rows · {ds.cols} columns · {ds.duplicates} duplicates</span>}>Dataset profile</SectionTitle>
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-zinc-500"><th className="py-1.5 pr-3 font-medium">Column</th><th className="pr-3 font-medium">Type</th><th className="w-40 pr-3 font-medium">Missing</th><th className="pr-3 font-medium">Distinct</th><th className="font-medium">Flags</th></tr></thead>
            <tbody>
              {arr(ds.columns).map((c) => (
                <tr className="border-t border-zinc-100 dark:border-zinc-800/80" key={c.name}>
                  <td className="py-1.5 pr-3 font-mono text-xs">{c.name}</td>
                  <td className="pr-3 text-zinc-500">{c.type}</td>
                  <td className="pr-3"><div className="flex items-center gap-2"><Meter className="w-24" tone={c.missing_pct >= 15 ? "red" : c.missing_pct >= 5 ? "amber" : "green"} value={c.missing_pct / 100} /><span className="text-xs tabular-nums text-zinc-500">{c.missing_pct}%</span></div></td>
                  <td className="pr-3 tabular-nums text-zinc-500">{c.unique}</td>
                  <td className="space-x-1">{c.pii ? <Chip tone="red">personal</Chip> : null}{c.sensitive ? <Chip tone="amber">sensitive</Chip> : null}{c.target ? <Chip tone="brand">target {Object.entries(c.distribution || {}).map(([k, v]) => `${k} ${v}%`).join(" / ")}</Chip> : null}{c.outliers ? <Chip tone="amber">{c.outliers} extreme</Chip> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}

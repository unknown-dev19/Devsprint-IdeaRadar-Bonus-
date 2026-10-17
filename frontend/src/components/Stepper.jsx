import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, Icon, PulsatingDots } from "@/components/ui";

// The backend only sends free-text stage names, so each step matches on keywords.
// If nothing matches, the rail advances with elapsed time so it never looks frozen.
export const OVERLAP_STEPS = [
  { label: "Understand the idea", match: /extract|understand|pars|read/ },
  { label: "Search GitHub + archive", match: /search|retriev|github|fetch|candidate/ },
  { label: "Map meaning", match: /embed|rank|similar/ },
  { label: "Compare features", match: /compar|overlap|feature/ },
  { label: "Score + advise", match: /scor|recommend|advice|originality|gap/ },
  { label: "Draw the landscape", match: /landscape|map|cluster|white|space/ },
];

export const BLIND_STEPS = [
  { label: "Read the documents", match: /read|document/ },
  { label: "Profile the dataset", match: /profil|dataset/ },
  { label: "Reason about what is missing", match: /reason|missing/ },
  { label: "Gather related-project evidence", match: /related|evidence|project/ },
  { label: "Rank by impact", match: /rank|impact/ },
];

export default function Stepper({ stage, startedAt, steps = OVERLAP_STEPS }) {
  const STEPS = steps;
  const [now, setNow] = useState(Date.now());
  const furthest = useRef(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, (now - startedAt) / 1000);
  const text = (stage || "").toLowerCase();
  let idx = -1;
  STEPS.forEach((s, i) => {
    if (s.match.test(text)) idx = i;
  });
  if (idx < 0) idx = Math.min(STEPS.length - 1, Math.floor(elapsed / 7));
  furthest.current = Math.max(furthest.current, idx);
  const active = furthest.current;

  return (
    <Card className="mx-auto w-full max-w-2xl bg-white/90 p-6 backdrop-blur dark:bg-neutral-950/80">
      <ol className="space-y-2.5">
        {STEPS.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li className="flex items-center gap-3 text-sm" key={s.label}>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full transition-colors duration-300",
                  done && "bg-emerald-500 text-white",
                  current && "text-red-500",
                  !done && !current && "bg-zinc-100 dark:bg-white/10"
                )}
              >
                {done ? <Icon className="size-3" name="check" /> : current ? <PulsatingDots dot="size-1.5" className="gap-0.5" /> : null}
              </span>
              <span
                className={cn(
                  "transition-colors duration-300",
                  done && "text-zinc-500 dark:text-zinc-400",
                  current && "font-medium text-zinc-900 dark:text-white",
                  !done && !current && "text-zinc-400 dark:text-zinc-600"
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs text-neutral-600 dark:bg-white/5 dark:text-neutral-300">
        <span className="min-w-0 truncate">
          <span className="text-red-500">&gt;</span> {stage || "Starting"}
          <span className="caret ml-0.5">_</span>
        </span>
        <span className="shrink-0 tabular-nums text-zinc-400">{elapsed.toFixed(0)}s</span>
      </div>
    </Card>
  );
}

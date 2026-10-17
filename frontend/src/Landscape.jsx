import { useMemo, useState } from "react";
import IdeaTerrain from "@/components/effects/idea-terrain";
import { Card, Chip, Icon, Meter, Segmented, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

const arr = (v) => (Array.isArray(v) ? v : []);
const CLUSTER_COLORS = ["#fb3a5d", "#38bdf8", "#fbbf24", "#34d399", "#a3a3a3", "#fb923c"];
const W = 680;
const H = 420;
const PAD = 34;
const sx = (x) => PAD + ((Math.max(-1, Math.min(1, x)) + 1) / 2) * (W - PAD * 2);
const sy = (y) => PAD + ((1 - Math.max(-1, Math.min(1, y))) / 2) * (H - PAD * 2);
const starPath = (cx, cy, R, r) => {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
};

function PointsMap({ landscape }) {
  const [hover, setHover] = useState(null);
  const points = arr(landscape.points);
  const clusters = arr(landscape.clusters);
  const regions = arr(landscape.unexplored_regions);
  const you = points.find((p) => p.source === "proposal");
  const color = (c) => CLUSTER_COLORS[Math.abs(Number(c) || 0) % CLUSTER_COLORS.length];
  const halfW = (W - PAD * 2) / 2;
  const halfH = (H - PAD * 2) / 2;

  return (
    <Card className="relative overflow-hidden p-3">
      <svg aria-label="Idea landscape map" className="block h-auto w-full" role="img" viewBox={`0 0 ${W} ${H}`}>
        {/* faint grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <g className="stroke-zinc-200 dark:stroke-zinc-800" key={t} strokeDasharray="2 6">
            <line x1={PAD + t * (W - PAD * 2)} x2={PAD + t * (W - PAD * 2)} y1={PAD} y2={H - PAD} />
            <line x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)} />
          </g>
        ))}
        <rect className="fill-none stroke-zinc-200 dark:stroke-zinc-800" height={H - PAD * 2} rx="14" width={W - PAD * 2} x={PAD} y={PAD} />

        {/* relatively unexplored regions (ellipses if the backend sends rx/ry, else circles) */}
        {regions.map((r, i) => {
          const rx = r.rx ?? r.radius_x ?? r.radius ?? 0.25;
          const ry = r.ry ?? r.radius_y ?? r.radius ?? 0.25;
          return (
            <g key={i}>
              <ellipse cx={sx(r.x)} cy={sy(r.y)} fill="#10b981" fillOpacity="0.1" rx={rx * halfW} ry={ry * halfH} stroke="#10b981" strokeDasharray="5 5" strokeOpacity="0.7" />
              <text className="fill-emerald-600 dark:fill-emerald-300" fontSize="10" fontWeight="600" textAnchor="middle" x={sx(r.x)} y={sy(r.y) + 3}>
                relatively unexplored
              </text>
            </g>
          );
        })}

        {/* cluster labels, nudged away from the star */}
        {clusters.map((c) => {
          const cx = sx(c.centroid?.x ?? 0);
          let cy = sy(c.centroid?.y ?? 0) - 18;
          if (you && Math.hypot(cx - sx(you.x), cy - sy(you.y)) < 34) cy += 46;
          return (
            <text className="fill-zinc-500 dark:fill-zinc-400" fontSize="11" fontWeight="600" key={c.id} textAnchor="middle" x={cx} y={cy}>
              {c.label}
            </text>
          );
        })}

        {/* points */}
        {points
          .filter((p) => p.source !== "proposal")
          .map((p) => {
            const x = sx(p.x);
            const y = sy(p.y);
            const active = hover && hover.id === p.id;
            const common = {
              fill: color(p.cluster),
              fillOpacity: active ? 1 : 0.8,
              onClick: () => p.url && window.open(p.url, "_blank", "noopener"),
              onMouseEnter: () => setHover(p),
              onMouseLeave: () => setHover(null),
              stroke: active ? "currentColor" : "none",
              strokeWidth: 2,
              style: { cursor: p.url ? "pointer" : "default" },
            };
            return p.source === "internal" ? (
              <rect height="11" key={p.id} rx="3" width="11" x={x - 5.5} y={y - 5.5} {...common} />
            ) : (
              <circle cx={x} cy={y} key={p.id} r={active ? 7 : 5.5} {...common} />
            );
          })}

        {/* you */}
        {you ? (
          <g>
            <circle cx={sx(you.x)} cy={sy(you.y)} fill="#f59e0b" fillOpacity="0.18" r="20" />
            <path d={starPath(sx(you.x), sy(you.y), 11, 4.6)} fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            <text className="fill-amber-600 dark:fill-amber-300" fontSize="11" fontWeight="700" textAnchor="middle" x={sx(you.x)} y={sy(you.y) - 17}>
              You
            </text>
          </g>
        ) : null}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute z-10 max-w-60 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            left: `${(sx(hover.x) / W) * 100}%`,
            top: `${(sy(hover.y) / H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <p className="font-semibold">{hover.title}</p>
          <p className="mt-0.5 text-zinc-500">
            {hover.source === "internal" ? "College archive" : "GitHub"} · {Math.round((Number(hover.similarity) || 0) * 100)}% as close as the closest match
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 pt-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-red-500" /> GitHub repo</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-[3px] bg-red-500" /> College archive</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full border border-dashed border-emerald-500 bg-emerald-500/20" /> Relatively unexplored</span>
        <span>Colour = topic cluster. Click a repo to open it.</span>
      </div>
    </Card>
  );
}

function Side({ landscape }) {
  const clusters = arr(landscape.clusters);
  const ws = landscape.white_space || {};
  const opps = arr(ws.opportunities);
  const clusterLabel = (id) => (clusters.find((c) => c.id === id) || {}).label;
  const fidelity = Number(landscape.map_fidelity);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle eyebrow="White space">Where you could be different</SectionTitle>
        {ws.summary ? <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{ws.summary}</p> : null}
        <div className="mt-3 space-y-2.5">
          {opps.length ? (
            opps.map((o, i) => (
              <div className="rounded-lg bg-emerald-500/[0.07] p-3.5" key={`${o.title}-${i}`}>
                <p className="flex items-start gap-2 text-sm font-medium">
                  <Icon className="mt-0.5 size-3.5 text-emerald-600 dark:text-emerald-300" name="spark" />
                  {o.title}
                </p>
                {o.reasoning ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{o.reasoning}</p> : null}
                {clusterLabel(o.nearest_cluster) ? (
                  <Chip className="mt-2" tone="zinc">Near: {clusterLabel(o.nearest_cluster)}</Chip>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">No white-space suggestions were generated for this run.</p>
          )}
        </div>
        <p className="mt-4 text-xs italic text-zinc-500">
          {ws.caveat || "Relatively unexplored means not covered in the compared set, not that nobody has built it."}
        </p>
      </Card>

      <Card className="p-5">
        <SectionTitle eyebrow="Neighbourhoods">Topic clusters</SectionTitle>
        <ul className="space-y-3">
          {clusters.map((c) => (
            <li className="flex gap-3" key={c.id}>
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: CLUSTER_COLORS[Math.abs(Number(c.id) || 0) % CLUSTER_COLORS.length] }} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {c.label}
                  <span className="text-xs font-normal text-zinc-400">{c.size} projects</span>
                  {c.contains_proposal ? <Chip tone="amber">you are here</Chip> : null}
                </p>
                {c.description ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.description}</p> : null}
              </div>
            </li>
          ))}
        </ul>
        {Number.isFinite(fidelity) ? (
          <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-white/10">
            <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
              <span>Map fidelity</span>
              <span className="tabular-nums">{Math.round(fidelity * 100)}%</span>
            </div>
            <Meter tone={fidelity > 0.6 ? "green" : "amber"} value={fidelity} />
            <p className="mt-1.5 text-xs text-zinc-400">A 2D map squeezes a lot of meaning flat. Lower fidelity means distances are rougher.</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default function Landscape({ landscape }) {
  const [view, setView] = useState("terrain");
  const ok = useMemo(() => landscape && arr(landscape.points).length >= 3, [landscape]);

  if (!ok) {
    return (
      <Card className="p-10 text-center">
        <p className="font-display text-xl font-semibold">Not enough neighbours to draw a landscape</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          The map needs at least three compared projects. Try again with GitHub available, or add more description to your proposal.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Every project is a point placed by meaning. Close together = similar idea. The terrain shows how crowded each patch of the map is.
        </p>
        <Segmented
          label="Landscape view"
          onChange={setView}
          options={[
            { id: "terrain", label: "Terrain", icon: "map" },
            { id: "points", label: "Points", icon: "target" },
          ]}
          value={view}
        />
      </div>
      <div className={cn("grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]")}>
        {view === "terrain" ? <IdeaTerrain landscape={landscape} title="Idea terrain" /> : <PointsMap landscape={landscape} />}
        <Side landscape={landscape} />
      </div>
    </div>
  );
}

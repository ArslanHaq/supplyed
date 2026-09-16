"use client";

import { useState } from "react";

import type { MatchResult } from "@/features/matching/types";

import { Btn, MatchScore, Tag } from "../atoms";

type MatchScorePanelProps = { match: MatchResult; initiallyExpanded?: boolean };

export function MatchScorePanel({ match, initiallyExpanded = false }: MatchScorePanelProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const hasWarning = match.flags.scheduleConflict || match.flags.outsideTravelRadius;

  return (
    <div className="rounded-xl border border-border bg-chalk/50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <MatchScore score={match.score} />
        <div className="min-w-[150px] flex-1">
          <div className="font-semibold">Match score</div>
          <div className="text-xs text-muted">
            {match.flags.distanceKnown && match.distanceMiles !== null ? `${match.distanceMiles.toFixed(1)} miles away` : "Distance unavailable"}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {match.flags.scheduleConflict ? <Tag tone="red">Schedule conflict</Tag> : null}
          {match.flags.outsideTravelRadius ? <Tag tone="amber">Outside travel radius</Tag> : null}
          {!hasWarning && match.flags.distanceKnown ? <Tag tone="green">Available match</Tag> : null}
        </div>
        <Btn size="sm" variant="ghost" onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide details" : "Score details"}</Btn>
      </div>
      {expanded ? (
        <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {match.factors.map((factor) => (
            <div key={factor.key} className={factor.applicable ? "" : "opacity-60"}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{factor.label}</span>
                <span className="text-muted">{factor.applicable ? `${Math.round(factor.value * 100)}% · weight ${factor.weight}` : "Not applicable"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-brand" style={{ width: `${factor.applicable ? factor.value * 100 : 0}%` }} /></div>
              <div className="mt-1 text-xs leading-5 text-muted">{factor.detail}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

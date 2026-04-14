const LANE_LIMIT = 3;
const STAGE_PRIORITY = {
  ship: 6,
  build: 5,
  mvp: 4,
  spec: 3,
  ready: 2,
  planning: 1,
  operate: 0
};

function compareDescending(left, right) {
  return right - left;
}

function sumBreakdown(entries) {
  return entries.reduce((total, entry) => total + entry.value, 0);
}

function createEmptyFreezeReasonCounts() {
  return {
    manualFreeze: 0,
    noLiveProject: 0,
    staleEvidence: 0,
    missingRepo: 0,
    missingDeploy: 0,
    thinNextStep: 0
  };
}

function classifyFreezeReasons(card) {
  const reasons = [];

  if (card.projectMuted) {
    reasons.push({
      key: "manualFreeze",
      label: "manual freeze",
      detail: "project is explicitly muted"
    });
  }

  if (card.stage === "ready" && !card.projectActive) {
    reasons.push({
      key: "noLiveProject",
      label: "no live project",
      detail: "still ready-only without an active project lane"
    });
  }

  if (card.ageDays >= 1) {
    reasons.push({
      key: "staleEvidence",
      label: "stale evidence",
      detail: `${card.ageDays.toFixed(1)}d since the last saved update`
    });
  }

  if (!card.hasRepo) {
    reasons.push({
      key: "missingRepo",
      label: "missing repo receipt",
      detail: "no saved repo URL"
    });
  }

  if (!card.hasDeploy) {
    reasons.push({
      key: "missingDeploy",
      label: "missing deploy receipt",
      detail: "no saved deploy URL"
    });
  }

  if (card.nextActionCount <= 1) {
    reasons.push({
      key: "thinNextStep",
      label: "thin next step",
      detail: `${card.nextActionCount} saved next action${card.nextActionCount === 1 ? "" : "s"}`
    });
  }

  return reasons;
}

function countFreezeReasons(cards) {
  const counts = createEmptyFreezeReasonCounts();

  for (const card of cards) {
    for (const reason of classifyFreezeReasons(card)) {
      counts[reason.key] += 1;
    }
  }

  return counts;
}

function createPolicyRows() {
  return [
    {
      lane: "build now",
      signal: "project stage",
      effect: "push harder",
      rule: "ship +600, build +500, mvp +400, spec +300, ready +200, planning +100, operate +0"
    },
    {
      lane: "build now",
      signal: "shipping receipts",
      effect: "push harder",
      rule: "deploy receipt +35, repo receipt +20"
    },
    {
      lane: "build now",
      signal: "freshness and next step",
      effect: "push harder",
      rule: "up to +40 for recent updates, +5 per saved next action, maturity score added directly"
    },
    {
      lane: "build now",
      signal: "mute state",
      effect: "block push",
      rule: "muted project -120 and excluded from build-now lane"
    },
    {
      lane: "park",
      signal: "middle state",
      effect: "hold",
      rule: "anything not strong enough for build now and not weak enough for kill review stays parked"
    },
    {
      lane: "park",
      signal: "saved next action",
      effect: "hold",
      rule: "park keeps cards with a credible next step instead of fabricating urgency"
    },
    {
      lane: "kill review",
      signal: "explicit freeze",
      effect: "stop review",
      rule: "muted project +130 because it already lacks permission to advance"
    },
    {
      lane: "kill review",
      signal: "idle ready bet",
      effect: "stop review",
      rule: "ready-without-project +80 so unstarted cards must defend a restart"
    },
    {
      lane: "kill review",
      signal: "operate drift and age",
      effect: "stop review",
      rule: "operate +25 plus age pressure at 18 points per day"
    },
    {
      lane: "kill review",
      signal: "missing receipts and next step",
      effect: "stop review",
      rule: "missing repo +18, missing deploy +12, weak next-step signal up to +20"
    }
  ];
}

function buildNowBreakdown(card) {
  return [
    { label: "stage-priority", value: (STAGE_PRIORITY[card.stage] || 0) * 100 },
    { label: "deploy-receipt", value: card.hasDeploy ? 35 : 0 },
    { label: "repo-receipt", value: card.hasRepo ? 20 : 0 },
    { label: "muted-penalty", value: card.projectMuted ? -120 : 0 },
    { label: "freshness", value: Math.max(0, 40 - card.ageDays * 10) },
    { label: "next-actions", value: card.nextActionCount * 5 },
    { label: "maturity", value: card.maturityScore }
  ];
}

function killReviewBreakdown(card) {
  return [
    { label: "muted-bonus", value: card.projectMuted ? 130 : 0 },
    { label: "idle-ready-bonus", value: card.stage === "ready" && !card.projectActive ? 80 : 0 },
    { label: "operate-drift", value: card.stage === "operate" ? 25 : 0 },
    { label: "age-pressure", value: Math.round(card.ageDays * 18 * 10) / 10 },
    { label: "missing-repo", value: !card.hasRepo ? 18 : 0 },
    { label: "missing-deploy", value: !card.hasDeploy ? 12 : 0 },
    { label: "missing-next-step", value: Math.max(0, 20 - card.nextActionCount * 4) }
  ];
}

function renderReason(card, lane) {
  if (lane === "buildNow") {
    if (card.stage === "ship") {
      return "Ship-stage lane with a live next step; this is the cleanest weekly push candidate.";
    }
    if (card.stage === "build") {
      return "Already in build with a saved next action; better to finish proof than start another lane.";
    }
    if (card.hasDeploy) {
      return "Already has deploy evidence and recent activity, so one more push can compound instead of reset.";
    }
    return "Recent non-muted lane with enough execution evidence to justify another week of capital.";
  }

  if (lane === "killReview") {
    if (card.projectMuted) {
      return "Muted lane with no active restart; keep it in stop-review until a human explicitly reopens it.";
    }
    if (card.stage === "ready" && !card.projectActive) {
      return "Still only ready without a live project thread, so it should defend a restart before taking more space.";
    }
    return "Older lane with weak shipping receipts; review whether this is still worth active attention.";
  }

  if (card.stage === "operate") {
    return "Recent operate lane; maintain it quietly unless a concrete drift or bug reopens the build.";
  }
  if (card.projectMuted) {
    return "Explicitly frozen for now; park it instead of pretending it is still advancing.";
  }
  return "Not the sharpest build bet and not dead enough to kill; keep it parked with its saved next step.";
}

function attachVerdict(card, lane) {
  const buildNow = buildNowBreakdown(card);
  const killReview = killReviewBreakdown(card);
  const freezeReasons = classifyFreezeReasons(card);

  return {
    ...card,
    lane,
    reason: renderReason(card, lane),
    freezeReasons,
    scores: {
      buildNow: {
        total: sumBreakdown(buildNow),
        breakdown: buildNow
      },
      killReview: {
        total: sumBreakdown(killReview),
        breakdown: killReview
      }
    }
  };
}

export function resolveAllocatorVerdicts(candidates, generatedAt) {
  const sortedForBuild = [...candidates]
    .filter((card) => !card.projectMuted)
    .sort((left, right) => compareDescending(sumBreakdown(buildNowBreakdown(left)), sumBreakdown(buildNowBreakdown(right))));

  const buildNowIds = new Set(sortedForBuild.slice(0, LANE_LIMIT).map((card) => card.id));

  const sortedForKill = [...candidates]
    .filter((card) => !buildNowIds.has(card.id))
    .sort((left, right) => compareDescending(sumBreakdown(killReviewBreakdown(left)), sumBreakdown(killReviewBreakdown(right))));

  const killReviewIds = new Set(sortedForKill.slice(0, LANE_LIMIT).map((card) => card.id));

  const park = candidates
    .filter((card) => !buildNowIds.has(card.id) && !killReviewIds.has(card.id))
    .sort((left, right) => compareDescending(sumBreakdown(buildNowBreakdown(left)), sumBreakdown(buildNowBreakdown(right))))
    .slice(0, LANE_LIMIT)
    .map((card) => attachVerdict(card, "park"));

  const buildNow = sortedForBuild.slice(0, LANE_LIMIT).map((card) => attachVerdict(card, "buildNow"));

  const killReview = sortedForKill.slice(0, LANE_LIMIT).map((card) => attachVerdict(card, "killReview"));
  const frozenReadyPool = candidates.filter((card) => card.projectMuted && !card.projectActive && card.stage === "ready");

  return {
    generatedAt,
    policy: [
      "build now favors non-muted build-or-ship lanes, recent updates, repo or deploy receipts, and explicit next steps.",
      "park holds active work that still has a credible next action but is not the strongest weekly push.",
      "kill review highlights muted, stale, or still-unstarted bets that should re-justify their slot before more effort."
    ],
    policyRows: createPolicyRows(),
    receipt: {
      laneLimit: LANE_LIMIT,
      candidateCount: candidates.length,
      frozenReadyPool: {
        count: frozenReadyPool.length,
        reasonCounts: countFreezeReasons(frozenReadyPool)
      },
      killReviewLane: {
        reasonCounts: countFreezeReasons(killReview)
      },
      laneCounts: {
        buildNow: buildNow.length,
        park: park.length,
        killReview: killReview.length
      }
    },
    lanes: {
      buildNow,
      park,
      killReview
    }
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatAge(ageDays) {
  if (!Number.isFinite(ageDays)) {
    return "age unknown";
  }

  if (ageDays < 1) {
    return `${(ageDays * 24).toFixed(1)}h old`;
  }

  return `${ageDays.toFixed(1)}d old`;
}

function renderCounts(totals) {
  return Object.entries(totals)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([stage, count]) => `<span class="count-pill">${escapeHtml(stage)} ${escapeHtml(String(count))}</span>`)
    .join("");
}

function renderMetric(label, value, tone = "") {
  const toneClass = tone ? ` metric-${escapeHtml(tone)}` : "";
  return `<article class="metric${toneClass}">
    <p class="metric-label">${escapeHtml(label)}</p>
    <p class="metric-value">${escapeHtml(String(value))}</p>
  </article>`;
}

function renderDetailPills(card) {
  const details = [
    card.stageLabel,
    formatAge(card.ageDays),
    `maturity ${card.maturityScore}`,
    `${card.nextActionCount} next actions`,
    card.hasRepo ? "repo linked" : "repo missing",
    card.hasDeploy ? "deploy linked" : "deploy missing"
  ];

  return details.map((item) => `<span class="detail-pill">${escapeHtml(item)}</span>`).join("");
}

function renderEvidenceList(card) {
  return card.evidence.map((item) => `<li class="tag neutral">${escapeHtml(item)}</li>`).join("");
}

function renderFreezeTags(card) {
  if (!card.freezeReasons?.length) {
    return "";
  }

  return `<ul class="tag-list freeze-list">
    ${card.freezeReasons.map((item) => `<li class="tag freeze">${escapeHtml(item.label)}</li>`).join("")}
  </ul>`;
}

function renderCard(card) {
  return `<article class="card ${escapeHtml(card.lane)}">
    <header class="card-head">
      <div>
        <p class="eyebrow">${escapeHtml(card.stageLabel)}</p>
        <h3>${escapeHtml(card.title)}</h3>
      </div>
      <span class="lane-pill lane-pill-${escapeHtml(card.lane)}">${escapeHtml(card.lane)}</span>
    </header>
    <div class="detail-row">
      ${renderDetailPills(card)}
    </div>
    <div class="score-grid">
      ${renderMetric("Push score", card.scores.buildNow.total.toFixed(1), "push")}
      ${renderMetric("Stop score", card.scores.killReview.total.toFixed(1), "kill")}
    </div>
    <p class="reason">${escapeHtml(card.reason)}</p>
    <ul class="tag-list evidence-list">
      ${renderEvidenceList(card)}
    </ul>
    ${renderFreezeTags(card)}
    <section class="next-block">
      <p class="next-label">Next action</p>
      <p class="next">${escapeHtml(card.nextActionPreview)}</p>
    </section>
  </article>`;
}

function renderFreezeAuditSection(receipt) {
  const frozenPool = receipt.frozenReadyPool;
  const laneCounts = receipt.killReviewLane?.reasonCounts || {};

  if (!frozenPool || !frozenPool.count) {
    return "";
  }

  const labels = {
    manualFreeze: "manual freeze",
    noLiveProject: "no live project",
    staleEvidence: "stale evidence",
    missingRepo: "missing repo receipt",
    missingDeploy: "missing deploy receipt",
    thinNextStep: "thin next step"
  };

  const reasonList = Object.entries(frozenPool.reasonCounts || {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `<li>${escapeHtml(labels[key] || key)} <strong>${escapeHtml(String(count))}</strong></li>`)
    .join("");

  const laneList = Object.entries(laneCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `<li>${escapeHtml(labels[key] || key)} <strong>${escapeHtml(String(count))}</strong></li>`)
    .join("");

  return `<section class="panel audit-panel">
    <div class="panel-head">
      <div>
        <p class="kicker">Frozen Ready Audit</p>
        <h2>Frozen bets are visible, not buried.</h2>
      </div>
      <span class="summary-chip">${escapeHtml(String(frozenPool.count))} frozen ready bets</span>
    </div>
    <p class="panel-copy">The replay keeps a frozen pool on purpose. Surface the recurring freeze reasons so the kill-review lane reads like a decision queue, not a surprise bucket.</p>
    <div class="audit-grid">
      <article class="audit-card">
        <h3>All frozen ready bets</h3>
        <ul>${reasonList}</ul>
      </article>
      <article class="audit-card">
        <h3>Visible kill-review lane</h3>
        <ul>${laneList || "<li>No freeze reasons were attached to the visible lane.</li>"}</ul>
      </article>
    </div>
  </section>`;
}

function formatReasonLabel(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .join(" ");
}

function renderReopenAuditSection(receipt) {
  const audit = receipt.reopenAudit;
  if (!audit) {
    return "";
  }

  const reasonList = Object.entries(audit.missingReasonCounts || {})
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `<li>${escapeHtml(formatReasonLabel(key))} <strong>${escapeHtml(String(count))}</strong></li>`)
    .join("");

  const queueItems = (audit.actionQueue || [])
    .map(
      (entry) => `<li><strong>${escapeHtml(String(entry.rank))}. ${escapeHtml(entry.title)}</strong><span>${escapeHtml(
        `${entry.staleHours}h stale, ${formatReasonLabel(entry.missingReason)}, ${entry.suggestedAction}`
      )}</span></li>`
    )
    .join("");

  const nextCandidate = audit.nextCandidate
    ? `<p class="audit-note">Next missing-trigger lane: <strong>${escapeHtml(audit.nextCandidate.title)}</strong> (${escapeHtml(
        `${audit.nextCandidate.staleHours}h stale`
      )})</p>`
    : "";

  return `<section class="panel audit-panel">
    <div class="panel-head">
      <div>
        <p class="kicker">Reopen Trigger Audit</p>
        <h2>Operate lanes still need wake-up rules.</h2>
      </div>
      <span class="summary-chip">${escapeHtml(String(audit.withoutTriggerCount))} missing triggers</span>
    </div>
    <p class="panel-copy">Quiet projects should say what wakes them. Until then, maintenance remains hard to trust.</p>
    ${nextCandidate}
    <div class="audit-grid">
      <article class="audit-card">
        <h3>Missing-trigger reasons</h3>
        <ul>${reasonList || "<li>No missing-trigger reasons were reported.</li>"}</ul>
      </article>
      <article class="audit-card">
        <h3>Top cleanup queue</h3>
        <ul class="stack-list">${queueItems || "<li>No cleanup queue was saved.</li>"}</ul>
      </article>
    </div>
  </section>`;
}

function renderLane(title, kicker, cards, laneClass) {
  const body = cards.length
    ? cards.map(renderCard).join("\n")
    : `<article class="card empty"><p>No cards landed in this lane on this replay.</p></article>`;

  return `<section class="lane lane-${escapeHtml(laneClass)}">
    <div class="lane-head">
      <div>
        <p class="kicker">${escapeHtml(kicker)}</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <span class="summary-chip">${escapeHtml(String(cards.length))} cards</span>
    </div>
    <div class="card-list">${body}</div>
  </section>`;
}

function renderPolicyRows(rows) {
  if (!rows.length) {
    return "";
  }

  return `<div class="policy-table" aria-label="Allocator policy table">
    ${rows
      .map(
        (row) => `<article class="policy-row">
      <p class="policy-lane">${escapeHtml(row.lane)}</p>
      <p class="policy-signal">${escapeHtml(row.signal)}</p>
      <p class="policy-effect">${escapeHtml(row.effect)}</p>
      <p class="policy-rule">${escapeHtml(row.rule)}</p>
    </article>`
      )
      .join("\n")}
  </div>`;
}

export function renderBoardHtml({ generatedAt, totals, board, styles }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Burger Allocator Board</title>
    <style>${styles}</style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="hero-copy-wrap">
          <p class="kicker">Burger Allocator</p>
          <h1>Forced choice, but rendered like an actual dashboard.</h1>
          <p class="hero-copy">This replay reads only <code>state/ideas.json</code>, scores each active card, and caps the visible board to three opinionated lanes: <strong>build now</strong>, <strong>park</strong>, and <strong>kill review</strong>.</p>
          <div class="count-row">
            ${renderCounts(totals)}
          </div>
        </div>
        <div class="hero-side">
          <div class="hero-side-grid">
            ${renderMetric("Generated", formatTime(generatedAt))}
            ${renderMetric("Candidates", board.receipt.candidateCount)}
            ${renderMetric("Lane cap", board.receipt.laneLimit)}
            ${renderMetric("Build now", board.lanes.buildNow.length, "push")}
            ${renderMetric("Park", board.lanes.park.length, "park")}
            ${renderMetric("Kill review", board.lanes.killReview.length, "kill")}
          </div>
        </div>
      </section>

      <section class="panel policy-panel">
        <div class="panel-head">
          <div>
            <p class="kicker">Scoring Contract v0</p>
            <h2>Readable rules first, polished cards second.</h2>
          </div>
          <span class="summary-chip">${escapeHtml(String(board.policyRows?.length || 0))} policy rows</span>
        </div>
        <div class="policy-copy-grid">
          <p class="panel-copy">The board is only useful if the scoring logic is inspectable. Keep the contract explicit: maturity, freshness, live project stage, and next-action clarity should explain every lane choice without opening source code.</p>
          <ul class="policy-list">
            ${board.policy.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        </div>
        ${renderPolicyRows(board.policyRows || [])}
      </section>

      <div class="audit-stack">
        ${renderFreezeAuditSection(board.receipt)}
        ${renderReopenAuditSection(board.receipt)}
      </div>

      <div class="lane-grid">
        ${renderLane("Build Now", "Push", board.lanes.buildNow, "buildNow")}
        ${renderLane("Park", "Hold", board.lanes.park, "park")}
        ${renderLane("Kill Review", "Stop Review", board.lanes.killReview, "killReview")}
      </div>
    </main>
  </body>
</html>`;
}

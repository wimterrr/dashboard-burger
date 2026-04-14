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

function renderCounts(totals) {
  return Object.entries(totals)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([stage, count]) => `<span>${escapeHtml(stage)} ${count}</span>`)
    .join("");
}

function renderCard(card) {
  const scoreSummary = `push ${card.scores.buildNow.total.toFixed(1)} / stop ${card.scores.killReview.total.toFixed(1)}`;
  const freezeSummary = card.freezeReasons?.length
    ? `<p class="freeze">${escapeHtml(card.freezeReasons.map((item) => item.label).join(" / "))}</p>`
    : "";
  return `<article class="card ${escapeHtml(card.lane)}">
    <header>
      <p class="eyebrow">${escapeHtml(card.stageLabel)}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p class="meta">${escapeHtml(formatTime(card.updatedAt))}</p>
    </header>
    <p class="scoreline">${escapeHtml(scoreSummary)}</p>
    <p class="reason">${escapeHtml(card.reason)}</p>
    ${freezeSummary}
    <ul class="evidence">
      ${card.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
    <p class="next">${escapeHtml(card.nextActionPreview)}</p>
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
    .map(([key, count]) => `<li>${escapeHtml(labels[key] || key)}: ${escapeHtml(String(count))}</li>`)
    .join("");

  const laneList = Object.entries(laneCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `<li>${escapeHtml(labels[key] || key)}: ${escapeHtml(String(count))}</li>`)
    .join("");

  return `<section class="policy freeze-audit">
    <p class="kicker">Frozen Ready Audit</p>
    <p class="hero-copy">The replay currently keeps <strong>${escapeHtml(String(frozenPool.count))}</strong> ready bets frozen. These are the saved reasons showing up across that pool and inside the visible kill-review lane.</p>
    <div class="audit-grid">
      <article>
        <h2>All frozen ready bets</h2>
        <ul>${reasonList}</ul>
      </article>
      <article>
        <h2>Visible kill-review lane</h2>
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
    .map(([key, count]) => `<li>${escapeHtml(formatReasonLabel(key))}: ${escapeHtml(String(count))}</li>`)
    .join("");

  const queueItems = (audit.actionQueue || [])
    .map(
      (entry) => `<li><strong>${escapeHtml(String(entry.rank))}. ${escapeHtml(entry.title)}</strong> - ${escapeHtml(
        `${entry.staleHours}h stale, ${formatReasonLabel(entry.missingReason)}, ${entry.suggestedAction}`
      )}</li>`
    )
    .join("");

  const nextCandidate = audit.nextCandidate
    ? `<p class="audit-note">Next missing-trigger lane: <strong>${escapeHtml(audit.nextCandidate.title)}</strong> (${escapeHtml(
        `${audit.nextCandidate.staleHours}h stale`
      )})</p>`
    : "";

  return `<section class="policy reopen-audit">
    <p class="kicker">Reopen Trigger Audit</p>
    <p class="hero-copy">The latest operate audit says <strong>${escapeHtml(
      String(audit.withoutTriggerCount)
    )}</strong> of <strong>${escapeHtml(String(audit.operateCount))}</strong> live operate lanes still lack an explicit reopen trigger. Keep maintenance quiet until those lanes say exactly what should wake them.</p>
    ${nextCandidate}
    <div class="audit-grid">
      <article>
        <h2>Missing-trigger reasons</h2>
        <ul>${reasonList || "<li>No missing-trigger reasons were reported.</li>"}</ul>
      </article>
      <article>
        <h2>Top cleanup queue</h2>
        <ul>${queueItems || "<li>No cleanup queue was saved.</li>"}</ul>
      </article>
    </div>
  </section>`;
}

function renderLane(title, kicker, cards) {
  const body = cards.length
    ? cards.map(renderCard).join("\n")
    : `<article class="card empty"><p>No cards landed in this lane on this replay.</p></article>`;

  return `<section class="lane">
    <div class="lane-head">
      <p class="kicker">${escapeHtml(kicker)}</p>
      <h2>${escapeHtml(title)}</h2>
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
        <p class="kicker">Burger Allocator</p>
        <h1>One replay, one weekly push, one stop-review candidate.</h1>
        <p class="hero-copy">This board reads only <code>state/ideas.json</code> and forces three capped verdict lanes: <strong>build now</strong>, <strong>park</strong>, and <strong>kill review</strong>.</p>
        <div class="meta-row">
          <span>Generated: ${escapeHtml(formatTime(generatedAt))}</span>
          <span>Active counts: ${renderCounts(totals)}</span>
          <span>Lane cap: ${escapeHtml(String(board.receipt.laneLimit))} each</span>
          <span>Replay candidates: ${escapeHtml(String(board.receipt.candidateCount))}</span>
        </div>
      </section>
      <section class="policy">
        <p class="kicker">Policy</p>
        <ul>
          ${board.policy.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
        ${renderPolicyRows(board.policyRows || [])}
      </section>
      ${renderFreezeAuditSection(board.receipt)}
      ${renderReopenAuditSection(board.receipt)}
      <div class="lane-grid">
        ${renderLane("Build Now", "Push", board.lanes.buildNow)}
        ${renderLane("Park", "Hold", board.lanes.park)}
        ${renderLane("Kill Review", "Stop Review", board.lanes.killReview)}
      </div>
    </main>
  </body>
</html>`;
}

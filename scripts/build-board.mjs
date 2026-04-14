#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadIdeasState } from "../src/loadIdeasState.mjs";
import { selectAllocatorCandidates } from "../src/selectAllocatorCandidates.mjs";
import { resolveAllocatorVerdicts } from "../src/resolveAllocatorVerdicts.mjs";
import { renderBoardHtml } from "../src/renderBoardHtml.mjs";

const workspaceDir = path.resolve(import.meta.dirname, "..");
const statePath = path.join(workspaceDir, "..", "state", "ideas.json");
const projectAuditPath = path.join(
  workspaceDir,
  "..",
  "projects",
  "ai-idea-maturity-pipeline",
  "outputs",
  "latest-project-audit.json"
);
const cssPath = path.join(workspaceDir, "src", "styles.css");
const distDir = path.join(workspaceDir, "dist");
const outputPath = path.join(distDir, "index.html");
const receiptPath = path.join(distDir, "verdict-receipt.json");

const loaded = loadIdeasState(statePath);
const candidates = selectAllocatorCandidates(loaded);
const board = resolveAllocatorVerdicts(candidates, loaded.generatedAt);
if (fs.existsSync(projectAuditPath)) {
  const audit = JSON.parse(fs.readFileSync(projectAuditPath, "utf8"));
  board.receipt.reopenAudit = {
    generatedAt: audit.generated_at || null,
    activeUnmutedCount: audit.active_unmuted_count || 0,
    operateCount: audit.active_unmuted_operate_count || 0,
    withTriggerCount: audit.operate_with_reopen_trigger_count || 0,
    withoutTriggerCount: audit.operate_without_reopen_trigger_count || 0,
    missingReasonCounts: audit.operate_missing_trigger_reason_counts || {},
    nextCandidate: audit.next_missing_reopen_trigger_candidate
      ? {
          ideaId: audit.next_missing_reopen_trigger_candidate.idea_id,
          title: audit.next_missing_reopen_trigger_candidate.title,
          staleHours: audit.next_missing_reopen_trigger_candidate.stale_hours,
          missingReason: audit.next_missing_reopen_trigger_candidate.missing_reopen_trigger_reason
        }
      : null,
    actionQueue: Array.isArray(audit.missing_reopen_trigger_action_queue)
      ? audit.missing_reopen_trigger_action_queue.slice(0, 3).map((entry) => ({
          rank: entry.rank,
          ideaId: entry.idea_id,
          title: entry.title,
          staleHours: entry.stale_hours,
          missingReason: entry.missing_reopen_trigger_reason,
          suggestedAction: entry.suggested_action
        }))
      : []
  };
}
const styles = fs.readFileSync(cssPath, "utf8");
const html = renderBoardHtml({
  generatedAt: loaded.generatedAt,
  totals: loaded.totals,
  board,
  styles
});

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
fs.writeFileSync(receiptPath, JSON.stringify(board, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      output_path: outputPath,
      receipt_path: receiptPath,
      candidate_count: candidates.length,
      build_now_count: board.lanes.buildNow.length,
      park_count: board.lanes.park.length,
      kill_review_count: board.lanes.killReview.length
    },
    null,
    2
  )
);

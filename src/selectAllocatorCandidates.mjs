const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function deriveStage(idea) {
  if (idea.project?.active && idea.project?.status) {
    return idea.project.status;
  }
  return idea.status || "ready";
}

function buildEvidence(idea, stage, ageDays) {
  const evidence = [];

  if (idea.project?.muted) {
    evidence.push("project manually muted");
  }
  if (idea.project?.repo_url) {
    evidence.push("repo receipt exists");
  }
  if (idea.project?.deploy_url) {
    evidence.push("deploy receipt exists");
  }
  if ((idea.next_actions || []).length) {
    evidence.push(`${idea.next_actions.length} next actions saved`);
  }
  if (idea.maturity_score) {
    evidence.push(`maturity ${idea.maturity_score}`);
  }
  evidence.push(ageDays >= 1 ? `${ageDays.toFixed(1)}d since last update` : "updated in the last 24h");
  evidence.push(`stage ${stage}`);

  return evidence;
}

export function selectAllocatorCandidates({ ideas, generatedAt }) {
  const now = Date.parse(generatedAt);

  return ideas.map((idea) => {
    const stage = deriveStage(idea);
    const updatedAt = toIsoDate(idea.project?.last_post_at || idea.updated_at || idea.created_at || generatedAt) || generatedAt;
    const ageDays = Math.max(0, (now - Date.parse(updatedAt)) / MS_PER_DAY);
    const nextActions = Array.isArray(idea.next_actions) ? idea.next_actions : [];

    return {
      id: idea.id,
      title: idea.title,
      stage,
      stageLabel: idea.project?.muted ? `${stage} (muted)` : stage,
      updatedAt,
      ageDays,
      maturityScore: Number(idea.maturity_score || 0),
      nextActionCount: nextActions.length,
      nextActionPreview: nextActions[0] || "No next action saved.",
      hasRepo: Boolean(idea.project?.repo_url),
      hasDeploy: Boolean(idea.project?.deploy_url),
      projectActive: Boolean(idea.project?.active),
      projectMuted: idea.project?.muted === true,
      summary: idea.summary || "",
      evidence: buildEvidence(idea, stage, ageDays)
    };
  });
}

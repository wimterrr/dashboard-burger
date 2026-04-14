import fs from "node:fs";

function deriveStage(idea) {
  if (idea.project?.active && idea.project?.status) {
    return idea.project.status;
  }
  return idea.status || "ready";
}

export function loadIdeasState(statePath) {
  const raw = fs.readFileSync(statePath, "utf8");
  const state = JSON.parse(raw);
  const activeIdeas = state.ideas.filter((idea) => idea.active);
  const generatedAt = new Date().toISOString();
  const totals = activeIdeas.reduce((acc, idea) => {
    const stage = deriveStage(idea);
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt,
    ideas: activeIdeas,
    totals
  };
}

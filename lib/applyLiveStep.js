/**
 * Apply a live soft() event onto occurrence.steps (catalog parents + nested children).
 */

const TERMINAL = new Set(["passed", "failed", "skipped", "blocked"]);

function mergeStepStatus(current, incoming) {
  if (incoming === "failed" || incoming === "blocked") return incoming;
  if (current === "failed" || current === "blocked") return current;
  return incoming;
}

function isCatalogDriven(steps) {
  return (steps || []).some((s) => s.useCase || s.module);
}

function findByPrefix(list, stepId) {
  const exact = (list || []).find((s) => s.stepId === stepId);
  if (exact) return exact;
  const matches = (list || []).filter(
    (s) =>
      String(stepId).startsWith(`${s.stepId}-`) ||
      String(stepId).startsWith(`${s.stepId}:`),
  );
  if (!matches.length) return null;
  return matches.sort((a, b) => b.stepId.length - a.stepId.length)[0];
}

function findCatalogParent(steps, stepId) {
  return findByPrefix(steps, stepId);
}

function rollupStatus(children) {
  const statuses = (children || []).map((c) => c.status || "pending");
  if (!statuses.length) return "pending";
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "blocked")) return "blocked";
  if (statuses.some((s) => s === "running")) return "running";
  if (statuses.every((s) => s === "pending")) return "pending";
  if (statuses.every((s) => TERMINAL.has(s))) {
    return statuses.some((s) => s === "passed") ? "passed" : "skipped";
  }
  if (statuses.some((s) => s === "passed" || s === "skipped")) return "running";
  return "pending";
}

function applyStatusFields(step, payload, now) {
  if (payload.title && !step.useCase) step.title = payload.title;
  step.status = mergeStepStatus(step.status, payload.status);
  if (payload.status === "running") {
    if (!step.startedAt) step.startedAt = now;
    step.finishedAt = null;
    step.durationMs = null;
  } else if (TERMINAL.has(payload.status)) {
    if (!step.startedAt) step.startedAt = now;
    step.finishedAt = now;
    const startedMs = new Date(step.startedAt).getTime();
    step.durationMs = Number.isFinite(startedMs)
      ? Math.max(0, now.getTime() - startedMs)
      : 0;
    if (payload.error) {
      const prev = step.error ? `${step.error}\n` : "";
      step.error = `${prev}${payload.error}`.slice(0, 2000);
    }
    if (payload.marker) step.marker = payload.marker;
    if (payload.severity) step.severity = payload.severity;
  }
}

function isSingleUseCaseRun(steps) {
  return (
    Array.isArray(steps) &&
    steps.length === 1 &&
    Array.isArray(steps[0].children) &&
    steps[0].children.length > 0
  );
}

function countCompleted(steps) {
  if (isSingleUseCaseRun(steps)) {
    return steps[0].children.filter((c) => TERMINAL.has(c.status)).length;
  }
  return (steps || []).filter((s) => TERMINAL.has(s.status)).length;
}

function countTotal(steps) {
  if (isSingleUseCaseRun(steps)) return steps[0].children.length;
  return (steps || []).length;
}

/**
 * Mutates `steps` in place.
 * @returns {{ ok: true; skipped?: boolean; currentStepId: string|null; step?: object }}
 */
function applyLiveStep(steps, payload, opts = {}) {
  const now = opts.now || new Date();
  const catalogFlow = isCatalogDriven(steps);
  let parent = findCatalogParent(steps, payload.stepId);

  if (parent && Array.isArray(parent.children) && parent.children.length) {
    const child = findByPrefix(parent.children, payload.stepId);
    if (child) {
      applyStatusFields(child, payload, now);
      parent.status = rollupStatus(parent.children);
      if (payload.status === "running" && !parent.startedAt) parent.startedAt = now;
      if (TERMINAL.has(parent.status)) parent.finishedAt = now;
      return {
        ok: true,
        currentStepId: payload.status === "running" ? parent.stepId : null,
        step: parent,
      };
    }
    applyStatusFields(parent, payload, now);
    return {
      ok: true,
      currentStepId: payload.status === "running" ? parent.stepId : null,
      step: parent,
    };
  }

  if (parent) {
    applyStatusFields(parent, payload, now);
    return {
      ok: true,
      currentStepId: payload.status === "running" ? parent.stepId : null,
      step: parent,
    };
  }

  if (catalogFlow) {
    return { ok: true, skipped: true, currentStepId: null };
  }

  const step = {
    stepId: payload.stepId,
    title: payload.title || payload.stepId,
    status: "pending",
    order: steps.length + 1,
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    error: "",
    marker: "",
    severity: "",
    children: [],
  };
  steps.push(step);
  applyStatusFields(step, payload, now);
  return {
    ok: true,
    currentStepId: payload.status === "running" ? step.stepId : null,
    step,
  };
}

function skipIncomplete(steps, now = new Date(), opts = {}) {
  const asFailed = Boolean(opts.markFailed);
  const nextStatus = asFailed ? "failed" : "skipped";
  const error = String(opts.error || "").slice(0, 2000);
  for (const step of steps || []) {
    if (Array.isArray(step.children) && step.children.length) {
      for (const child of step.children) {
        if (child.status === "pending" || child.status === "running") {
          child.status = nextStatus;
          child.finishedAt = now;
          if (asFailed && error && !child.error) child.error = error;
        }
      }
      step.status = rollupStatus(step.children);
      if (asFailed && error && !step.error && step.status === "failed") {
        step.error = error;
      }
      if (!step.finishedAt) step.finishedAt = now;
      continue;
    }
    if (step.status === "pending" || step.status === "running") {
      step.status = nextStatus;
      step.finishedAt = now;
      if (asFailed && error && !step.error) step.error = error;
    }
  }
}

module.exports = {
  TERMINAL,
  mergeStepStatus,
  isCatalogDriven,
  findCatalogParent,
  rollupStatus,
  applyLiveStep,
  countCompleted,
  countTotal,
  skipIncomplete,
};

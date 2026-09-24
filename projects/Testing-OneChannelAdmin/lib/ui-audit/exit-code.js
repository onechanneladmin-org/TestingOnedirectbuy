function defaultPolicy() {
  return {
    failOnKinds: ["deterministic", "visual"],
    failOnSeverities: ["critical", "major"],
  };
}

/**
 * CI gate. Heuristic and REVIEW_REQUIRED findings do not fail unless the
 * caller adds those kinds to failOnKinds.
 * @returns {0 | 1}
 */
function exitCodeFor(findings, policy = defaultPolicy()) {
  const kinds = new Set(policy.failOnKinds || []);
  const severities = new Set(policy.failOnSeverities || []);
  const failed = findings.some(
    (finding) => kinds.has(finding.kind) && severities.has(finding.severity),
  );
  return failed ? 1 : 0;
}

module.exports = { defaultPolicy, exitCodeFor };

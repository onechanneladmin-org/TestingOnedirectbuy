/**
 * Posts each Playwright test result to the flow control plane so the UI
 * shows passed or failed instead of leaving the step pending.
 */
const http = require("http");
const https = require("https");

function postStep(test, result) {
  const base = process.env.STATUS_API_URL;
  const occurrenceId = process.env.RUNNING_OCCURRENCE_ID;
  if (!base || !occurrenceId) return;
  const status =
    result.status === "passed"
      ? "passed"
      : result.status === "skipped"
        ? "skipped"
        : "failed";
  const body = JSON.stringify({
    stepId: test.title,
    title: test.title,
    status,
    error: result.error ? String(result.error.message || result.error).slice(0, 2000) : "",
  });
  const url = new URL(
    `/api/occurrences/${encodeURIComponent(occurrenceId)}/steps`,
    base.endsWith("/") ? base : `${base}/`,
  );
  const lib = url.protocol === "https:" ? https : http;
  const req = lib.request(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    },
    (res) => {
      res.resume();
    },
  );
  req.on("error", () => {});
  req.write(body);
  req.end();
}

class FlowStepReporter {
  onTestEnd(test, result) {
    postStep(test, result);
  }
}

module.exports = FlowStepReporter;

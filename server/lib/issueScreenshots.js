const fs = require("fs");
const path = require("path");
const { ROOT } = require("../config");

function shotsDir(occurrenceId) {
  return path.join(ROOT, "reports", "issue-shots", String(occurrenceId || ""));
}

function resolveScreenshotFile(occurrenceId, fileOrStep) {
  const id = String(occurrenceId || "").trim();
  const key = String(fileOrStep || "").trim();
  if (!id || !key) return null;
  const dir = shotsDir(id);
  if (!fs.existsSync(dir)) return null;

  const direct = path.join(dir, path.basename(key));
  if (fs.existsSync(direct) && direct.endsWith(".png")) return direct;

  const withPng = path.join(dir, `${path.basename(key)}.png`);
  if (fs.existsSync(withPng)) return withPng;

  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".png"));
  const match = files.find(
    (name) => name.startsWith(key) || name.includes(key.replace(/[^a-zA-Z0-9._-]+/g, "-")),
  );
  return match ? path.join(dir, match) : null;
}

module.exports = { shotsDir, resolveScreenshotFile };

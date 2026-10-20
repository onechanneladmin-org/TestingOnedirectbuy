const fs = require("fs");
const path = require("path");
const { ROOT } = require("../config");
const { shotsDir } = require("./issueScreenshots");

const ARCHIVE_DIR = path.join(__dirname, "..", "data", "occurrence-archive");
const KEEP_RECENT_RUNS = Math.max(
  1,
  Number(process.env.OCCURRENCE_KEEP || 2) || 2,
);

function ensureDir() {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

function archivePath(occurrenceId) {
  const safe = String(occurrenceId || "").replace(/[^a-zA-Z0-9._-]+/g, "_");
  return path.join(ARCHIVE_DIR, `${safe}.json`);
}

function serializeOccurrence(doc) {
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete obj._id;
  delete obj.__v;
  return obj;
}

function writeOccurrenceArchive(doc) {
  try {
    if (!doc?.occurrenceId) return;
    ensureDir();
    const payload = serializeOccurrence(doc);
    fs.writeFileSync(
      archivePath(payload.occurrenceId),
      `${JSON.stringify(payload, null, 2)}\n`,
    );
  } catch (err) {
    console.warn(
      "[occurrence-archive] write failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

function deleteOccurrenceArchive(occurrenceId) {
  try {
    const file = archivePath(occurrenceId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    console.warn(
      "[occurrence-archive] delete archive failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

function deleteOccurrenceLocalFiles(occurrenceId) {
  const id = String(occurrenceId || "").trim();
  if (!id) return;

  deleteOccurrenceArchive(id);

  try {
    const dir = shotsDir(id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.warn(
      "[occurrence-archive] delete shots failed:",
      err instanceof Error ? err.message : String(err),
    );
  }

  for (const rel of [
    path.join("reports", "live-steps", `${id}.ndjson`),
    path.join("reports", `flow-run-${id}.cmd`),
    path.join("reports", `.run-${id}.cmd`),
  ]) {
    try {
      const full = path.join(ROOT, rel);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {
      // ignore
    }
  }
}

function listArchivedOccurrences() {
  ensureDir();
  const files = fs.readdirSync(ARCHIVE_DIR).filter((name) => name.endsWith(".json"));
  const out = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, file), "utf8"));
      if (raw?.occurrenceId) out.push(raw);
    } catch {
      // skip bad files
    }
  }
  return out;
}

/**
 * Rehydrate archived runs into Mongo after an ephemeral/memory DB restart.
 */
async function restoreOccurrenceArchives(RunningOccurrence) {
  const archived = listArchivedOccurrences();
  if (!archived.length) return { restored: 0, skipped: 0 };

  let restored = 0;
  let skipped = 0;
  for (const item of archived) {
    try {
      const existing = await RunningOccurrence.findOne({
        occurrenceId: item.occurrenceId,
      }).lean();
      if (existing) {
        skipped += 1;
        continue;
      }
      await RunningOccurrence.create(item);
      restored += 1;
    } catch (err) {
      console.warn(
        `[occurrence-archive] restore ${item.occurrenceId} failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { restored, skipped };
}

function pruneOrphanLocalArtifacts(keepIds) {
  const keep = new Set([...keepIds].map(String));

  try {
    ensureDir();
    for (const file of fs.readdirSync(ARCHIVE_DIR)) {
      if (!file.endsWith(".json")) continue;
      const id = file.replace(/\.json$/i, "");
      if (!keep.has(id)) {
        try {
          fs.unlinkSync(path.join(ARCHIVE_DIR, file));
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  const shotsRoot = path.join(ROOT, "reports", "issue-shots");
  try {
    if (!fs.existsSync(shotsRoot)) return;
    for (const name of fs.readdirSync(shotsRoot)) {
      if (keep.has(name)) continue;
      const full = path.join(shotsRoot, name);
      try {
        if (fs.statSync(full).isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Keep only the newest N finished runs per project (plus any still running).
 * Deletes Mongo rows, Report docs, archive JSON, and local issue screenshots.
 */
async function pruneOccurrenceRetention(RunningOccurrence, Report, opts = {}) {
  const keep = Math.max(1, Number(opts.keep ?? KEEP_RECENT_RUNS) || 2);
  const projectIds = await RunningOccurrence.distinct("projectId");
  let deleted = 0;
  const keepIds = new Set();

  for (const projectId of projectIds) {
    const rows = await RunningOccurrence.find({ projectId })
      .sort({ createdAt: -1 })
      .select("occurrenceId status createdAt")
      .lean();

    let keptTerminal = 0;
    const drop = [];
    for (const row of rows) {
      const id = String(row.occurrenceId);
      if (row.status === "running") {
        keepIds.add(id);
        continue;
      }
      if (keptTerminal < keep) {
        keepIds.add(id);
        keptTerminal += 1;
        continue;
      }
      drop.push(id);
    }

    for (const occurrenceId of drop) {
      try {
        await RunningOccurrence.deleteOne({ occurrenceId });
        if (Report) await Report.deleteOne({ occurrenceId });
        deleteOccurrenceLocalFiles(occurrenceId);
        deleted += 1;
      } catch (err) {
        console.warn(
          `[occurrence-archive] prune ${occurrenceId} failed:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  // Also keep ids still present after prune (safety if distinct was empty)
  const remaining = await RunningOccurrence.find({})
    .select("occurrenceId")
    .lean();
  for (const row of remaining) keepIds.add(String(row.occurrenceId));

  pruneOrphanLocalArtifacts(keepIds);

  return { deleted, keep };
}

module.exports = {
  ARCHIVE_DIR,
  KEEP_RECENT_RUNS,
  writeOccurrenceArchive,
  deleteOccurrenceArchive,
  deleteOccurrenceLocalFiles,
  listArchivedOccurrences,
  restoreOccurrenceArchives,
  pruneOccurrenceRetention,
};

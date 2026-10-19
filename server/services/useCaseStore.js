/**
 * Use-case store: sync definitions from the Google Sheet, record run results, read for the dashboard.
 */
const UseCase = require("../models/UseCase");
const { fetchSheetRows, parseTabs } = require("../lib/sheetSync");
const { resultsByUseCase } = require("../lib/useCaseResults");
const { USECASE_SHEET_ID, USECASE_SHEET_TABS } = require("../config");

const HISTORY_MAX = 20;
const DEFINITION_FIELDS = [
  "tab", "module", "actor", "title", "description", "preconditions", "expectedResult", "priority",
  "automation", "currentStatus", "layer", "flow", "screenshot", "automationStatus", "assignedTo", "screen", "route",
];

function sheetConfigured() {
  return Boolean(USECASE_SHEET_ID && parseTabs(USECASE_SHEET_TABS).length);
}

/**
 * Pull every configured tab and upsert definitions. Results are kept. IDs no longer in the sheet
 * are marked inSheet=false (not deleted), so their run history stays visible.
 */
async function syncFromSheet({ fetchImpl } = {}) {
  if (!sheetConfigured()) {
    const err = new Error("Set USECASE_SHEET_ID and USECASE_SHEET_TABS (name:gid,...) in .env to sync the use-case sheet.");
    err.status = 400;
    throw err;
  }
  const { rows, tabs } = await fetchSheetRows({ sheetId: USECASE_SHEET_ID, tabs: parseTabs(USECASE_SHEET_TABS) }, fetchImpl);
  const okTabs = tabs.filter((t) => !t.error).map((t) => t.name);
  const now = new Date();
  if (rows.length) {
    await UseCase.bulkWrite(
      rows.map((r) => ({
        updateOne: {
          filter: { useCaseId: r.useCaseId },
          update: { $set: { ...Object.fromEntries(DEFINITION_FIELDS.map((f) => [f, r[f] || ""])), inSheet: true, syncedAt: now } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  // Only tabs that loaded can retire rows (a failed fetch must not mark a whole tab as gone).
  const ids = rows.map((r) => r.useCaseId);
  const retired = okTabs.length
    ? await UseCase.updateMany({ tab: { $in: okTabs }, useCaseId: { $nin: ids }, inSheet: true }, { $set: { inSheet: false } })
    : { modifiedCount: 0 };
  return { synced: rows.length, retired: retired.modifiedCount || 0, tabs, at: now.toISOString() };
}

/** Record the outcome of a finished occurrence on every use case its steps map to. */
async function recordOccurrenceResults(occurrence) {
  const by = resultsByUseCase(occurrence && occurrence.steps);
  if (!by.size) return { recorded: 0 };
  const at = occurrence.finishedAt || new Date();
  await UseCase.bulkWrite(
    [...by.entries()].map(([useCaseId, r]) => {
      const result = { status: r.status, occurrenceId: occurrence.occurrenceId, flowId: occurrence.flowId, at, error: String(r.error || "").slice(0, 2000), stepIds: r.stepIds };
      return {
        updateOne: {
          filter: { useCaseId },
          update: {
            $set: { lastResult: result },
            $push: { history: { $each: [result], $position: 0, $slice: HISTORY_MAX } },
            $setOnInsert: { inSheet: false, tab: "" },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
  return { recorded: by.size };
}

module.exports = { syncFromSheet, recordOccurrenceResults, sheetConfigured, DEFINITION_FIELDS };

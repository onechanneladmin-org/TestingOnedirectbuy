const mongoose = require("mongoose");

/** Latest result of one use case, written when a flow run finishes (services/useCaseStore.js). */
const ResultSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["passed", "failed", "skipped", "blocked"], required: true },
    occurrenceId: { type: String, default: "" },
    flowId: { type: String, default: "" },
    /** who reported it: flow-control | playwright-reporter | 1ca-e2e | manual … */
    source: { type: String, default: "" },
    at: { type: Date, default: null },
    error: { type: String, default: "" },
    stepIds: [{ type: String }],
  },
  { _id: false },
);

/**
 * One use case. Definition fields come from the Google Sheet (lib/sheetSync.js) and are
 * overwritten on every sync; lastResult/history come from runs and are never touched by a sync.
 */
const UseCaseSchema = new mongoose.Schema(
  {
    useCaseId: { type: String, required: true, unique: true, index: true },
    tab: { type: String, default: "", index: true },
    module: { type: String, default: "" },
    actor: { type: String, default: "" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    preconditions: { type: String, default: "" },
    expectedResult: { type: String, default: "" },
    priority: { type: String, default: "", index: true },
    automation: { type: String, default: "" },
    currentStatus: { type: String, default: "" },
    layer: { type: String, default: "" },
    flow: { type: String, default: "" },
    screenshot: { type: String, default: "" },
    automationStatus: { type: String, default: "" },
    assignedTo: { type: String, default: "" },
    screen: { type: String, default: "" },
    route: { type: String, default: "" },
    /** false when the ID was seen in a run but is not (or no longer) in the sheet. */
    inSheet: { type: Boolean, default: true },
    syncedAt: { type: Date, default: null },
    lastResult: { type: ResultSchema, default: null },
    history: { type: [ResultSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.models.UseCase || mongoose.model("UseCase", UseCaseSchema);

const mongoose = require("mongoose");

const ChildStepSchema = new mongoose.Schema(
  {
    stepId: { type: String, required: true },
    title: { type: String, default: "" },
    specFile: { type: String, default: "" },
    order: { type: Number, default: 0 },
    dependsOn: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const FlowStepSchema = new mongoose.Schema(
  {
    stepId: { type: String, required: true },
    title: { type: String, required: true },
    specFile: { type: String, default: "" },
    order: { type: Number, required: true },
    dependsOn: { type: String, default: null },
    module: { type: String, default: "" },
    actor: { type: String, default: "" },
    useCase: { type: String, default: "" },
    description: { type: String, default: "" },
    priority: { type: String, default: "" },
    automation: { type: String, default: "" },
    currentStatus: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    children: { type: [ChildStepSchema], default: [] },
  },
  { _id: false },
);

const FlowSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      default: "onedirectbuy",
      index: true,
    },
    flowId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    tests: [{ type: String }],
    catalog: { type: String, default: "" },
    steps: [FlowStepSchema],
  },
  { timestamps: true },
);

FlowSchema.index({ projectId: 1, flowId: 1 }, { unique: true });

module.exports = mongoose.models.Flow || mongoose.model("Flow", FlowSchema);

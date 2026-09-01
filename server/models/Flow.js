const mongoose = require("mongoose");

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
  },
  { _id: false },
);

const FlowSchema = new mongoose.Schema(
  {
    flowId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    tests: [{ type: String }],
    catalog: { type: String, default: "" },
    steps: [FlowStepSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.models.Flow || mongoose.model("Flow", FlowSchema);

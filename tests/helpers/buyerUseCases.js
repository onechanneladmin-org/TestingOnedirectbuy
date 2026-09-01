import fs from "fs";
import path from "path";

const DEFAULT_PATH = path.join(
  process.cwd(),
  "tests/OneDirectBuy/buyer-account.tsv",
);

/**
 * @param {string} [tsvPath]
 * @returns {{
 *   id: string;
 *   module: string;
 *   actor: string;
 *   useCase: string;
 *   description: string;
 *   priority: string;
 *   automation: string;
 *   currentStatus: string;
 * }[]}
 */
export function loadBuyerUseCases(tsvPath) {
  const filePath = tsvPath || process.env.ONEDIRECTBUY_BUYER_TSV || DEFAULT_PATH;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Buyer use-case catalog not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const [header, ...rows] = lines;
  const cols = header.split("\t");
  const idx = {
    id: cols.indexOf("Use Case ID"),
    module: cols.indexOf("Module"),
    actor: cols.indexOf("Actor"),
    useCase: cols.indexOf("Use Case"),
    description: cols.indexOf("Description"),
    priority: cols.indexOf("Priority"),
    automation: cols.indexOf("Automation"),
    currentStatus: cols.indexOf("Current Onedirectbuy Status"),
  };

  return rows.map((line) => {
    const parts = line.split("\t");
    return {
      id: parts[idx.id] || parts[0] || "",
      module: idx.module >= 0 ? parts[idx.module] || "" : "",
      actor: idx.actor >= 0 ? parts[idx.actor] || "" : "",
      useCase: idx.useCase >= 0 ? parts[idx.useCase] || "" : "",
      description: idx.description >= 0 ? parts[idx.description] || "" : "",
      priority: idx.priority >= 0 ? parts[idx.priority] || "" : "",
      automation: idx.automation >= 0 ? parts[idx.automation] || "" : "",
      currentStatus: idx.currentStatus >= 0 ? parts[idx.currentStatus] || "" : "",
    };
  });
}

export function buyerUseCaseIds(tsvPath) {
  return loadBuyerUseCases(tsvPath).map((row) => row.id);
}

export function resolvedBuyerTsvPath() {
  return process.env.ONEDIRECTBUY_BUYER_TSV || DEFAULT_PATH;
}

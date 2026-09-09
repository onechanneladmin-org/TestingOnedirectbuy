/**
 * Live-discovered three-dot filter operators from /v2/demo/datatable.
 * Overlay always has Match + operator select + Clear/Apply.
 */

export const TEXT_OPERATORS = [
  "Equals",
  "Not Equals",
  "Starts With",
  "Contains",
  "Does Not Contain",
  "Is Empty",
  "Is Not Empty",
];

export const RANGE_OPERATORS = ["From", "To", "Is Empty", "Is Not Empty"];

export const ENUM_OPERATORS = [
  "Equals",
  "Not Equals",
  "Is Empty",
  "Is Not Empty",
];

/** @typedef {'text' | 'range' | 'enum' | 'boolean'} FilterKind */

/**
 * Column → filter kind and representative values discovered on the live page.
 * @type {Record<string, { kind: FilterKind, operators: string[], sampleOption?: string }>}
 */
export const COLUMN_FILTERS = {
  SKU: { kind: "text", operators: TEXT_OPERATORS },
  Title: { kind: "text", operators: TEXT_OPERATORS },
  Brand: { kind: "text", operators: TEXT_OPERATORS },
  MPN: { kind: "text", operators: TEXT_OPERATORS },
  UPC: { kind: "text", operators: TEXT_OPERATORS },
  Warehouse: { kind: "text", operators: TEXT_OPERATORS },
  Description: { kind: "text", operators: TEXT_OPERATORS },
  Channels: { kind: "enum", operators: ENUM_OPERATORS },
  Cost: { kind: "range", operators: RANGE_OPERATORS },
  "Retail Price": { kind: "range", operators: RANGE_OPERATORS },
  "Available QTY": { kind: "range", operators: RANGE_OPERATORS },
  Images: { kind: "range", operators: RANGE_OPERATORS },
  "Serialized QTY": { kind: "range", operators: RANGE_OPERATORS },
  "Map Price": { kind: "range", operators: RANGE_OPERATORS },
  "Warranty (in years)": { kind: "range", operators: RANGE_OPERATORS },
  "AddOns Count": { kind: "range", operators: RANGE_OPERATORS },
  "Fitment Count": { kind: "range", operators: RANGE_OPERATORS },
  Status: {
    kind: "enum",
    operators: ENUM_OPERATORS,
    sampleOption: "Published",
  },
  Category: {
    kind: "enum",
    operators: ENUM_OPERATORS,
    sampleOption: "1CA",
  },
  Tags: {
    kind: "enum",
    operators: ENUM_OPERATORS,
    sampleOption: "Feature",
  },
  Flags: {
    kind: "enum",
    operators: ENUM_OPERATORS,
    sampleOption: "NoFlag",
  },
  "Shopify collections": {
    kind: "enum",
    operators: ENUM_OPERATORS,
    sampleOption: "Interior",
  },
  "Website Intake query only": {
    kind: "boolean",
    operators: ENUM_OPERATORS,
    sampleOption: "True",
  },
};

export const TEXT_COLUMNS = Object.entries(COLUMN_FILTERS)
  .filter(([, meta]) => meta.kind === "text")
  .map(([name]) => name);

export const RANGE_COLUMNS = Object.entries(COLUMN_FILTERS)
  .filter(([, meta]) => meta.kind === "range")
  .map(([name]) => name);

export const ENUM_COLUMNS = Object.entries(COLUMN_FILTERS)
  .filter(([, meta]) => meta.kind === "enum" || meta.kind === "boolean")
  .map(([name]) => name);

/**
 * Seed a Contains / Equals value from a live SKU.
 * @param {string} sku
 * @param {string} operator
 */
export function textSeedForOperator(sku, operator) {
  const value = String(sku || "").trim();
  if (!value) return "AIR";
  switch (operator) {
    case "Contains":
      return value.slice(0, Math.min(4, value.length));
    case "Starts With":
      return value.slice(0, Math.min(3, value.length));
    case "Equals":
      return value;
    case "Not Equals":
    case "Does Not Contain":
      return "ZZZZ_NO_MATCH";
    default:
      return value;
  }
}

/**
 * Loose row assertion after a text filter is applied.
 * @param {string} operator
 * @param {string} seed
 * @param {string[]} rowValues
 */
export function textFilterMatches(operator, seed, rowValues) {
  const needle = seed.toLowerCase();
  const values = rowValues.map((v) => v.toLowerCase());
  if (!values.length) {
    return operator === "Is Empty" || operator === "Does Not Contain" || operator === "Not Equals";
  }
  switch (operator) {
    case "Contains":
      return values.some((v) => v.includes(needle));
    case "Starts With":
      return values.some((v) => v.startsWith(needle));
    case "Equals":
      return values.some((v) => v === needle);
    case "Not Equals":
      return values.every((v) => v !== needle);
    case "Does Not Contain":
      return values.every((v) => !v.includes(needle));
    case "Is Empty":
      return true;
    case "Is Not Empty":
      return values.some((v) => v.length > 0);
    default:
      return true;
  }
}

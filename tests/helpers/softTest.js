/**
 * Soft-aware Playwright test fixture.
 * Use `soft(id, title, async () => { ... })` instead of hard expects for UI checks.
 * Each failed check is recorded with a marker and the remaining checks still run;
 * the test then fails, listing every failed check.
 */
import { test as base, expect } from "@playwright/test";
import { createSoftChecker, MARKERS } from "./softCheck.js";

export const test = base.extend({
  soft: async ({ page }, use, testInfo) => {
    const checker = createSoftChecker(page, testInfo);
    await use(checker.soft);
    checker.flush();
    if (checker.issues.length) {
      const lines = checker.issues.map((i) => `- ${i.marker} ${i.id} — ${i.title}: ${i.evidence.split("\n")[0]}`);
      throw new Error(`${checker.issues.length} check(s) failed:\n${lines.join("\n")}`);
    }
  },
});

export { expect, MARKERS };

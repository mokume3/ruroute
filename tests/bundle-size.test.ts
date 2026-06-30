import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MAX_BUNDLE_BYTES = 1500;
const DIST_BUNDLE_PATH = new URL("../dist/index.mjs", import.meta.url);

describe("bundle size", () => {
  it("minified bundle is 1.5KB or less", () => {
    const bundleContent = readFileSync(DIST_BUNDLE_PATH, "utf8");
    const bundleSizeInBytes = Buffer.byteLength(bundleContent, "utf8");
    expect(bundleSizeInBytes).toBeLessThanOrEqual(MAX_BUNDLE_BYTES);
  });
});

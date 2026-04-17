import { describe, it, expect } from "vitest";
import { smoothingPreset, smoothByKernel, dbPathFromBands } from "./spectrumMath";

describe("smoothingPreset", () => {
  it("fast mode has shorter attack and release than slow", () => {
    const fast = smoothingPreset("fast");
    const slow = smoothingPreset("slow");
    expect(fast.attackMs).toBeLessThan(slow.attackMs);
    expect(fast.releaseMs).toBeLessThan(slow.releaseMs);
  });
  it("returns normal preset for unknown mode", () => {
    expect(smoothingPreset("xyz")).toEqual(smoothingPreset("normal"));
  });
  it("each preset returns positive attack and release times", () => {
    for (const mode of ["fast", "normal", "slow"]) {
      const { attackMs, releaseMs } = smoothingPreset(mode);
      expect(attackMs).toBeGreaterThan(0);
      expect(releaseMs).toBeGreaterThan(0);
    }
  });
});

describe("smoothByKernel", () => {
  it("returns input unchanged when array is too short", () => {
    const arr = [1, 2];
    expect(smoothByKernel(arr, [0.25, 0.5, 0.25])).toEqual(arr);
  });
  it("returns input unchanged when kernel is too short", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(smoothByKernel(arr, [1, 0])).toEqual(arr);
  });
  it("preserves array length", () => {
    const arr = [1, 2, 3, 4, 5];
    expect(smoothByKernel(arr, [0.25, 0.5, 0.25])).toHaveLength(arr.length);
  });
  it("identity kernel [0, 1, 0] returns the same values", () => {
    const arr = [10, 20, 30, 40, 50];
    const result = smoothByKernel(arr, [0, 1, 0]);
    arr.forEach((v, i) => expect(result[i]).toBeCloseTo(v));
  });
  it("averaging kernel reduces a spike", () => {
    const arr = [0, 0, 100, 0, 0];
    const result = smoothByKernel(arr, [0.25, 0.5, 0.25]);
    expect(result[2]).toBeLessThan(100);
    expect(result[1]).toBeGreaterThan(0);
    expect(result[3]).toBeGreaterThan(0);
  });
});

describe("dbPathFromBands", () => {
  it("returns empty string for empty arrays", () => {
    expect(dbPathFromBands([], [])).toBe("");
  });
  it("returns empty string when arrays have different lengths", () => {
    expect(dbPathFromBands([{ fCenter: 1000 }], [-10, -20])).toBe("");
  });
  it("starts with 'M' for valid input", () => {
    const bands = [{ fCenter: 100 }, { fCenter: 1000 }, { fCenter: 10000 }];
    const path = dbPathFromBands(bands, [-20, -10, -30]);
    expect(path).toMatch(/^M /);
  });
  it("contains 'L' segments connecting points", () => {
    const bands = [{ fCenter: 100 }, { fCenter: 1000 }, { fCenter: 10000 }];
    const path = dbPathFromBands(bands, [-20, -10, -30]);
    expect(path).toContain(" L ");
  });
});

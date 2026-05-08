import { describe, it, expect } from "vitest";
import { getPeakChannels } from "./peakChannelMath";

describe("getPeakChannels", () => {
  it("uses peakDb when present (multichannel)", () => {
    const ch = getPeakChannels({ peakDb: [-1, -2, -3], peakHoldDb: [-10, -20, -30] });
    expect(ch).toEqual([
      { label: "Ch 1", valueDb: -1, holdDb: -10 },
      { label: "Ch 2", valueDb: -2, holdDb: -20 },
      { label: "Ch 3", valueDb: -3, holdDb: -30 },
    ]);
  });

  it("falls back to L/R when peakDb missing", () => {
    const ch = getPeakChannels({ sampleL: -6, sampleR: -7, samplePeakMaxL: -1, samplePeakMaxR: -2 });
    expect(ch).toEqual([
      { label: "L", valueDb: -6, holdDb: -1 },
      { label: "R", valueDb: -7, holdDb: -2 },
    ]);
  });
});


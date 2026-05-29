import { describe, expect, it } from "vitest";
import { formatAudioDeviceLabel } from "./audioDeviceLabels.js";

describe("formatAudioDeviceLabel", () => {
  it("collapses duplicated routed labels into a concise primary and secondary", () => {
    expect(
      formatAudioDeviceLabel(
        "CABLE Input 16ch (VB-Audio Virtual Cable) — CABLE Input 16ch (VB-Audio Virtual Cable)"
      )
    ).toEqual({
      primary: "CABLE Input 16ch",
      secondary: "VB-Audio Virtual Cable",
      full: "CABLE Input 16ch (VB-Audio Virtual Cable) — CABLE Input 16ch (VB-Audio Virtual Cable)",
    });
  });

  it("handles nested parentheses in the secondary detail", () => {
    expect(formatAudioDeviceLabel("Realtek Digital Output (Realtek(R) Audio)")).toEqual({
      primary: "Realtek Digital Output",
      secondary: "Realtek(R) Audio",
      full: "Realtek Digital Output (Realtek(R) Audio)",
    });
  });

  it("formats localized device names the same way", () => {
    expect(formatAudioDeviceLabel("麦克风 (UGREEN USB MIC-CM727) — 麦克风")).toEqual({
      primary: "麦克风",
      secondary: "UGREEN USB MIC-CM727",
      full: "麦克风 (UGREEN USB MIC-CM727) — 麦克风",
    });
  });
});

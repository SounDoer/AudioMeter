import { describe, it, expect } from "vitest";
import { WORKSPACE_STORAGE_KEY } from "./constants.js";

describe("workspace localStorage keys", () => {
  it("uses plvs:workspace:v2 as WORKSPACE_STORAGE_KEY", () => {
    expect(WORKSPACE_STORAGE_KEY).toBe("plvs:workspace:v2");
  });
});

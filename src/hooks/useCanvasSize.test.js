import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCanvasSize } from "./useCanvasSize";

let triggerResize;
let mockDisconnect;

function makeRefs(clientWidth = 400, clientHeight = 300) {
  const canvas = document.createElement("canvas");
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: clientWidth, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: clientHeight, configurable: true });
  return { canvasRef: { current: canvas }, containerRef: { current: container }, canvas };
}

describe("useCanvasSize", () => {
  beforeEach(() => {
    mockDisconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function (cb) {
        triggerResize = cb;
        return { observe: vi.fn(), disconnect: mockDisconnect };
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sets canvas dimensions when ResizeObserver fires", () => {
    const { canvasRef, containerRef } = makeRefs(400, 300);
    renderHook(() => useCanvasSize(canvasRef, containerRef));
    triggerResize();
    expect(canvasRef.current.width).toBeGreaterThan(0);
    expect(canvasRef.current.height).toBeGreaterThan(0);
  });

  it("sets canvas.width to clientWidth × devicePixelRatio", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const { canvasRef, containerRef } = makeRefs(400, 300);
    renderHook(() => useCanvasSize(canvasRef, containerRef));
    triggerResize();
    expect(canvasRef.current.width).toBe(800);
  });

  it("sets canvas.height to clientHeight × devicePixelRatio", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const { canvasRef, containerRef } = makeRefs(400, 300);
    renderHook(() => useCanvasSize(canvasRef, containerRef));
    triggerResize();
    expect(canvasRef.current.height).toBe(600);
  });

  it("falls back to DPR 1 when devicePixelRatio is falsy", () => {
    vi.stubGlobal("devicePixelRatio", 0);
    const { canvasRef, containerRef } = makeRefs(400, 300);
    renderHook(() => useCanvasSize(canvasRef, containerRef));
    triggerResize();
    expect(canvasRef.current.width).toBe(400);
    expect(canvasRef.current.height).toBe(300);
  });

  it("calls disconnect on unmount", () => {
    const { canvasRef, containerRef } = makeRefs();
    const { unmount } = renderHook(() => useCanvasSize(canvasRef, containerRef));
    unmount();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });
});

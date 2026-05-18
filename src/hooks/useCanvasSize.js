import { useEffect } from "react";

export function useCanvasSize(canvasRef, containerRef) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [canvasRef, containerRef]);
}

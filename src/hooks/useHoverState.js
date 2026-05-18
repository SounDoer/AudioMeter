import { useState } from "react";
import { freqToXFrac, spectrumDbToTopFrac } from "../config/scales";
import {
  formatSpectrumFreq,
  computeHistoryHoverPoint,
  computeSpectrumHoverIndex,
} from "../math/hoverMath";

export function useHoverState({
  historyChartInteractive,
  histSourceList,
  effectiveOffsetSamples,
  visibleSamples,
  sampleSec,
  displaySpectrumData,
}) {
  const [historyHover, setHistoryHover] = useState(null);
  const [spectrumHover, setSpectrumHover] = useState(null);

  const onHistoryHoverMove = (clientX, rect) => {
    if (!historyChartInteractive) {
      setHistoryHover(null);
      return;
    }
    setHistoryHover(
      computeHistoryHoverPoint(
        clientX,
        rect,
        histSourceList,
        effectiveOffsetSamples,
        visibleSamples,
        sampleSec
      )
    );
  };

  const onHistoryHoverLeave = () => setHistoryHover(null);

  const onSpectrumHoverMove = (clientX, rect) => {
    const data = displaySpectrumData;
    if (!data?.bands?.length || !data?.dbList?.length) {
      setSpectrumHover(null);
      return;
    }
    const nearestIdx = computeSpectrumHoverIndex(clientX, rect, data.bands);
    const band = data.bands[nearestIdx];
    const db = data.dbList[nearestIdx];
    if (!band || !Number.isFinite(db)) {
      setSpectrumHover(null);
      return;
    }
    setSpectrumHover({
      leftPct: freqToXFrac(band.fCenter) * 100,
      topPct: spectrumDbToTopFrac(db) * 100,
      freqLabel: formatSpectrumFreq(band.fCenter),
      dbLabel: `${db.toFixed(1)} dB`,
    });
  };

  const onSpectrumHoverLeave = () => setSpectrumHover(null);

  const clearHoverState = () => {
    setHistoryHover(null);
    setSpectrumHover(null);
  };

  return {
    historyHover,
    spectrumHover,
    onHistoryHoverMove,
    onHistoryHoverLeave,
    onSpectrumHoverMove,
    onSpectrumHoverLeave,
    clearHoverState,
  };
}

import { useEffect, useState } from "react";
import { getEngineState } from "../ipc/commands.js";
import { isTauri } from "../ipc/env.js";
import { onEngineStateChanged } from "../ipc/events.js";

/**
 * @returns {boolean}
 */
export function useFloatEngineState() {
  const [engineRunning, setEngineRunning] = useState(false);

  useEffect(() => {
    if (!isTauri()) return undefined;
    let u = () => {};
    let off = false;
    void (async () => {
      try {
        const s = await getEngineState();
        if (!off) setEngineRunning(s === "running");
        const un = await onEngineStateChanged((p) => {
          setEngineRunning(p.state === "running");
        });
        u = un;
      } catch {
        if (!off) setEngineRunning(false);
      }
    })();
    return () => {
      off = true;
      u();
    };
  }, []);

  return engineRunning;
}

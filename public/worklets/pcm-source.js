'use strict';

/**
 * Pulls interleaved stereo (or multi-channel) PCM fed from the main thread via `port.postMessage`.
 * Outputs audio so downstream nodes (Analyser, loudness worklet) behave like a live capture graph.
 */
class PcmSourceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.cap = 48000 * 8;
    this.ring = new Float32Array(this.cap);
    this.write = 0;
    /** Number of unread float samples in ring (interleaved). */
    this.avail = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m?.type === 'pcm' && m.buffer instanceof ArrayBuffer) {
        const f = new Float32Array(m.buffer);
        for (let i = 0; i < f.length; i++) {
          this.ring[this.write] = f[i];
          this.write = (this.write + 1) % this.cap;
          this.avail = Math.min(this.avail + 1, this.cap);
        }
      } else if (m === 'reset' || m?.type === 'reset') {
        this.write = 0;
        this.avail = 0;
      }
    };
  }

  readSample() {
    if (this.avail <= 0) return 0;
    const cap = this.cap;
    const readIdx = (this.write - this.avail + cap) % cap;
    const v = this.ring[readIdx];
    this.avail -= 1;
    return v;
  }

  process(_inputs, outputs) {
    const out0 = outputs[0];
    const L = out0[0];
    const R = out0[1];
    for (let i = 0; i < L.length; i++) {
      if (this.avail >= 2) {
        L[i] = this.readSample();
        R[i] = this.readSample();
      } else {
        L[i] = 0;
        R[i] = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-source', PcmSourceProcessor);

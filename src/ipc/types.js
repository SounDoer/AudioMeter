/**
 * @typedef {object} AudioFramePayload
 * @property {number[]} peakDb
 * @property {number[]} peakHoldDb
 * @property {number} truePeakMaxDbtp
 * @property {number} lufsMomentary
 * @property {number} lufsShortTerm
 * @property {number} integrated
 * @property {number} lra
 * @property {number} truePeakL
 * @property {number} truePeakR
 * @property {number} sampleLDb
 * @property {number} sampleRDb
 * @property {number} correlation
 * @property {string} vectorscopePath
 * @property {string} spectrumPath
 * @property {string} spectrumPeakPath
 * @property {number[]} spectrumBandCentersHz
 * @property {number[]} spectrumSmoothDb
 * @property {number} timestampMs
 */

/**
 * @typedef {object} LoudnessSlowPayload
 * @property {number|null|undefined} lufsIntegrated
 * @property {number} lufsMMax
 * @property {number} lufsStMax
 * @property {number} lra
 * @property {number|undefined} psr
 * @property {number|undefined} plr
 */

export {};

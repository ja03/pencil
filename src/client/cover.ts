// Generated covers for posts without a cover image, from the UI Design. Each
// post keeps the same one everywhere it appears, picked from its id.

export const COVER_GRADIENTS = [
  "repeating-linear-gradient(118deg, rgba(255,244,228,0.07) 0 1px, transparent 1px 6px), radial-gradient(circle at 28% 30%, #E5A273, transparent 58%), linear-gradient(145deg, #93391C, #C8683A)",
  "repeating-linear-gradient(62deg, rgba(255,244,228,0.06) 0 1px, transparent 1px 7px), radial-gradient(circle at 70% 25%, #D8B98A, transparent 55%), linear-gradient(160deg, #4A3526, #8A6A48)",
  "repeating-linear-gradient(135deg, rgba(255,244,228,0.07) 0 1px, transparent 1px 5px), radial-gradient(circle at 40% 70%, #C9A06A, transparent 60%), linear-gradient(120deg, #2E2219, #6E4A2E)",
  "repeating-linear-gradient(90deg, rgba(255,244,228,0.06) 0 1px, transparent 1px 8px), radial-gradient(circle at 75% 70%, #F0C291, transparent 55%), linear-gradient(150deg, #B4532A, #E3935F)",
  "repeating-linear-gradient(28deg, rgba(255,244,228,0.06) 0 1px, transparent 1px 6px), radial-gradient(circle at 25% 75%, #A8B29A, transparent 55%), linear-gradient(140deg, #3D4234, #7C7A5C)",
  "repeating-linear-gradient(150deg, rgba(255,244,228,0.07) 0 1px, transparent 1px 6px), radial-gradient(circle at 60% 35%, #E7C9A1, transparent 60%), linear-gradient(130deg, #6B2F1E, #A0573A)",
] as const;

/** The generated cover for a post, stable for its id. */
export function coverGradientFor(id: string): string {
  // FNV-1a: cheap, and spreads similar ids (uuid v7 share a prefix) well.
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return COVER_GRADIENTS[(hash >>> 0) % COVER_GRADIENTS.length];
}

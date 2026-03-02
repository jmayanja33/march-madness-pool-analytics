// Shared color-interpolation utility for probability/similarity values.
// Used across CreateTeam and TeamCard to keep coloring consistent.

/**
 * Returns a smoothly interpolated HSL color string for a 0–1 probability value.
 *
 * Colors blend continuously across four HSL anchor points so that values
 * near boundaries appear transitional rather than jumping abruptly.
 *
 * Anchor colors (HSL):
 *   ≤ 40 %  → red          hsl(  0, 72 %, 60 %)  ≈ #e05252   (clamped)
 *    60 %   → yellow        hsl( 43, 80 %, 46 %)  ≈ #d4a017
 *    75 %   → yellow-green  hsl( 81, 67 %, 44 %)
 *   100 %   → green         hsl(145, 46 %, 42 %)  ≈ #3a9e5f
 *
 * Segments:
 *   0–40 %   clamp to red
 *   40–60 %  red → yellow
 *   60–75 %  yellow → yellow-green
 *   75–100 % yellow-green → green
 *
 * @param {number} prob - Probability as a decimal (0–1).
 * @returns {string} HSL color string, e.g. "hsl(81.0, 67.0%, 44.0%)".
 */
export function probColor(prob) {
  // Clamp to [0, 100] to handle any floating-point edge cases.
  const pct = Math.min(100, Math.max(0, prob * 100));

  let h, s, l;

  if (pct <= 40) {
    // Clamp: pure red for anything at or below 40 %.
    h = 0; s = 72; l = 60;
  } else if (pct <= 60) {
    // Interpolate red → yellow as pct goes from 40 to 60.
    const t = (pct - 40) / 20;
    h = t * 43;
    s = 72 + t * (80 - 72);
    l = 60 + t * (46 - 60);
  } else if (pct <= 75) {
    // Interpolate yellow → yellow-green as pct goes from 60 to 75.
    const t = (pct - 60) / 15;
    h = 43 + t * (81 - 43);
    s = 80 + t * (67 - 80);
    l = 46 + t * (44 - 46);
  } else {
    // Interpolate yellow-green → green as pct goes from 75 to 100.
    const t = (pct - 75) / 25;
    h = 81 + t * (145 - 81);
    s = 67 + t * (46 - 67);
    l = 44 + t * (42 - 44);
  }

  return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
}

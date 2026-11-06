/* Shared stage palette for every spot model.
   Spec: docs/景点建模规范.md §10 — 4–6 colours shared project-wide,
   per-spot variation only in building materials, not in the ground ring. */
(function (root) {
  'use strict';
  var colors = {
    paper: 0xf4eee1,
    stone: 0xd7cec0,
    stoneLight: 0xe2d9c9,
    earth: 0x7d7263,
    paving: 0xc3b9a7,
    foliage: 0x5c7245,
    ink: 0x26221c
  };
  function shift(hex, pct) {
    var f = 1 + (pct || 0);
    function channel(v) {
      return Math.max(0, Math.min(255, Math.round(v * f)));
    }
    return (channel((hex >> 16) & 255) << 16) | (channel((hex >> 8) & 255) << 8) | channel(hex & 255);
  }
  var api = { colors: colors, shift: shift };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CantonPalette = api;
})(typeof window !== 'undefined' ? window : this);

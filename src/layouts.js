import { randomLcg, randomNormal, range } from "d3";

// Point cloud layouts, one per background stage

export const POINT_COUNT = 240;
const GROUP_COUNT = 4;

// Seeded so the cloud looks the same on every load
const source = randomLcg(0x5eed);
const gaussian = randomNormal.source(source)(0, 1);

/** Create the points once, with stable per-point randomness. */
export function createPoints() {
  return range(POINT_COUNT).map((i) => ({
    i,
    group: i % GROUP_COUNT,
    u: source(),
    v: source(),
    jx: gaussian(),
    jy: gaussian(),
  }));
}

/** Center of a curated group, laid out on a 2x2 arrangement. */
function groupCenter(group) {
  const col = group % 2;
  const row = Math.floor(group / 2);
  return { x: 0.28 + col * 0.44, y: 0.3 + row * 0.4 };
}

/** Keyed by `data-step`; returns [0, 1] coordinates and a group (-1 is uncolored). */
export const LAYOUTS = {
  // Raw, unstructured measurements
  0: (p) => ({ x: p.u, y: p.v, group: -1 }),

  // Coral: distinct subsets
  1: (p) => {
    const c = groupCenter(p.group);
    return { x: c.x + p.jx * 0.055, y: c.y + p.jy * 0.055, group: p.group };
  },

  // TourDino: two subsets side by side
  2: (p) => {
    const side = p.group % 2;
    const spread = 0.055 + side * 0.02; // Slightly different variance per side
    return {
      x: 0.34 + side * 0.32 + p.jx * spread,
      y: 0.5 + p.jy * 0.18,
      group: side,
    };
  },

  // Embeddings: two interleaved crescents, radii adjusted for the wide canvas
  3: (p) => {
    const side = p.group % 2;
    const t = p.u * Math.PI;
    const rx = 0.19 + p.jx * 0.012;
    const ry = 0.3 + p.jx * 0.018;
    return side === 0
      ? { x: 0.38 + rx * Math.cos(t), y: 0.66 - ry * Math.sin(t) + p.jy * 0.012, group: 0 }
      : { x: 0.62 - rx * Math.cos(t), y: 0.34 + ry * Math.sin(t) + p.jy * 0.012, group: 1 };
  },

  // Kokiri: attributes ranked by how well they separate the groups
  4: (p) => {
    const bars = 8;
    const bar = p.i % bars;
    const slot = Math.floor(p.i / bars);
    const perBar = Math.ceil(POINT_COUNT / bars);
    // Importance falls off, so higher-ranked bars reach further right
    const importance = 0.9 ** bar;
    const filled = slot / perBar;
    return {
      x: 0.2 + filled * 0.6 * importance,
      y: 0.22 + (bar / (bars - 1)) * 0.56,
      group: bar % GROUP_COUNT,
    };
  },

  // Loops: notebook cells stacked into columns
  5: (p) => {
    const columns = 6;
    const col = p.i % columns;
    const row = Math.floor(p.i / columns);
    const rows = Math.ceil(POINT_COUNT / columns);
    return {
      x: 0.16 + (col / (columns - 1)) * 0.68 + p.jx * 0.008,
      y: 0.16 + (row / (rows - 1)) * 0.68,
      group: col % GROUP_COUNT,
    };
  },
};

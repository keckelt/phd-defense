// Coral charts: the cohort gap, evolution graph, workflow, small multiples and densities
import { bin, extent, max, mean, select } from "d3";

import { cohortRows } from "./data.js";
import { register } from "./registry.js";

// Shared helpers, also used by tourdino.js

/** Ten equal-range bins over the whole cohort's age range, as Coral bins. */
export function ageBins(rows) {
  const [lo, hi] = extent(cohortRows(), (d) => d.age);
  const step = (hi - lo) / 10;
  const thresholds = Array.from({ length: 9 }, (_, i) => lo + step * (i + 1));
  const binner = bin()
    .domain([lo, hi])
    .thresholds(thresholds)
    .value((d) => d.age);
  return binner(rows).map((b) => b.length / rows.length);
}

/** Share of each category in a cohort, in a fixed category order. */
export function shares(rows, key, categories) {
  return categories.map((c) => rows.filter((r) => r[key] === c).length / rows.length);
}

/** Chi-squared statistic of a 2x2 table [[a, b], [c, d]]. */
export function chiSquared([[a, b], [c, d]]) {
  const n = a + b + c + d;
  const rows = [a + b, c + d];
  const cols = [a + c, b + d];
  const cells = [
    [a, 0, 0],
    [b, 0, 1],
    [c, 1, 0],
    [d, 1, 1],
  ];
  let x = 0;
  for (const [o, i, j] of cells) {
    const e = (rows[i] * cols[j]) / n;
    x += (o - e) ** 2 / e;
  }
  return x;
}

/** Complementary error function, error below 1.2e-7. */
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** P-value of a chi-squared statistic with one degree of freedom. */
export function pValue(chi2) {
  return erfc(Math.sqrt(chi2 / 2));
}

/** Format p, showing only the bound below 0.001. */
export function formatP(p) {
  if (p < 0.001) return "p < 0.001";
  if (p < 0.01) return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(2)}`;
}

export const percent = (v) => `${(v * 100).toFixed(1)}%`;

/** A cohort block as Coral draws it: name, a bar for the relative size, the count. */
export function cohortBlock(g, { x, y, w = 190, h = 64, name, n, total, color, faint, reference }) {
  const block = g
    .append("g")
    .attr("class", "coral-block")
    .attr("transform", `translate(${x} ${y})`);
  // A reference cohort (all patients) is neutral gray
  block
    .append("rect")
    .attr("class", `coral-block-box ${reference ? "is-reference" : ""}`)
    .attr("width", w)
    .attr("height", h)
    .attr("rx", 8)
    .style("fill", color ?? null);
  block
    .append("text")
    .attr("class", `coral-block-name ${color ? "on-color" : ""}`)
    .attr("x", 14)
    .attr("y", 27)
    .text(name);
  // The dual encoding of size: a bar relative to the base cohort and the number
  block
    .append("rect")
    .attr("class", "coral-block-track")
    .attr("x", 14)
    .attr("y", 42)
    .attr("width", w - 90)
    .attr("height", 10)
    .attr("rx", 3);
  block
    .append("rect")
    .attr("class", "coral-block-size")
    .attr("x", 14)
    .attr("y", 42)
    .attr("width", Math.max(4, ((w - 90) * n) / total))
    .attr("height", 10)
    .attr("rx", 3)
    .style("fill", faint ?? null);
  block
    .append("text")
    .attr("class", `coral-block-count ${color ? "on-color" : ""}`)
    .attr("x", w - 14)
    .attr("y", 53)
    .attr("text-anchor", "end")
    .text(n.toLocaleString("en-US"));
  return block;
}

/** The funnel or split glyph in an operation square. */
export function operationSquare(g, { x, y, kind, label, size = 60 }) {
  const op = g.append("g").attr("class", "coral-op").attr("transform", `translate(${x} ${y})`);
  op.append("rect")
    .attr("class", "coral-op-box")
    .attr("width", size)
    .attr("height", size)
    .attr("rx", 8);
  const icon = op.append("g").attr("transform", `translate(${size / 2} ${size / 2 - 4})`);
  if (kind === "filter") {
    icon
      .append("path")
      .attr("class", "coral-op-icon")
      .attr("d", "M -14 -12 H 14 L 4 2 V 12 L -4 14 V 2 Z");
  } else {
    icon.append("circle").attr("class", "coral-op-icon").attr("cx", -10).attr("cy", 0).attr("r", 4);
    icon
      .append("circle")
      .attr("class", "coral-op-icon")
      .attr("cx", 10)
      .attr("cy", -10)
      .attr("r", 4);
    icon.append("circle").attr("class", "coral-op-icon").attr("cx", 10).attr("cy", 10).attr("r", 4);
    icon
      .append("path")
      .attr("class", "coral-op-line")
      .attr("d", "M -10 0 L 10 -10 M -10 0 L 10 10");
  }
  op.append("text")
    .attr("class", "coral-op-label")
    .attr("x", size / 2)
    .attr("y", size + 24)
    .attr("text-anchor", "middle")
    .text(label);
  return op;
}

/** One small chart: bars on a shared domain, plus a missing-values bin. */
export function miniBars(g, { x, y, w, h, values, labels, yMax, color, highlight }) {
  const cell = g.append("g").attr("class", "coral-cell").attr("transform", `translate(${x} ${y})`);
  const slots = values.length;
  const slotW = w / slots;
  const barW = Math.min(24, slotW - 2);
  cell
    .append("line")
    .attr("class", "coral-baseline")
    .attr("x1", 0)
    .attr("x2", w)
    .attr("y1", h)
    .attr("y2", h);
  cell
    .selectAll("rect")
    .data(values)
    .join("rect")
    .attr("class", (d, i) => `coral-bar ${highlight?.includes(i) ? "is-highlight" : ""}`)
    .attr("x", (d, i) => i * slotW + (slotW - barW) / 2)
    .attr("y", (d) => h - (h * d) / yMax)
    .attr("width", barW)
    .attr("height", (d) => (h * d) / yMax)
    .attr("rx", 3)
    .style("fill", color ?? null);
  if (labels) {
    const tick = (d) => (typeof d === "string" ? { text: d, anchor: "middle" } : d);
    const anchorX = (a, i) =>
      a === "start" ? i * slotW : a === "end" ? (i + 1) * slotW : i * slotW + slotW / 2;
    cell
      .selectAll("text")
      .data(labels.map(tick))
      .join("text")
      .attr("class", "coral-tick")
      .attr("x", (d, i) => anchorX(d.anchor, i))
      .attr("y", h + 18)
      .attr("text-anchor", (d) => d.anchor)
      .text((d) => d.text);
  }
  return cell;
}

function svgFor(el, w, h, cls, label) {
  return select(el)
    .append("svg")
    .attr("class", `coral-chart ${cls}`)
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("role", "img")
    .attr("aria-label", label);
}

// The example cohorts, derived from the data

const STAGES = ["I", "II", "III", "IV"];
const MARKER_STATES = ["mutated", "wild type", "unknown"];
const SEXES = ["F", "M"];

function cohorts() {
  const all = cohortRows();
  const typeA = all.filter((r) => r.tumor_type === "Type A");
  const typeB = all.filter((r) => r.tumor_type === "Type B");
  return {
    all,
    typeA,
    typeB,
    m03: all.filter((r) => r.KRAS === "mutated"),
    typeAKras: typeA.filter((r) => r.KRAS === "mutated"),
    typeBKras: typeB.filter((r) => r.KRAS === "mutated"),
  };
}

// The gap as a constraint

function renderGap(el, { palette }) {
  const W = 1500;
  const H = 560;
  const svg = svgFor(
    el,
    W,
    H,
    "coral-gap",
    "The scale of the data against the three limits of existing tools",
  );

  // Left: the scale, as two figures
  const scale = svg.append("g").attr("transform", "translate(0 40)");
  const tile = (y, value, label) => {
    const t = scale.append("g").attr("transform", `translate(0 ${y})`);
    t.append("text").attr("class", "coral-hero").attr("y", 0).text(value);
    t.append("text").attr("class", "coral-hero-label").attr("y", 44).text(label);
    return t;
  };
  tile(70, "128,000+", "samples, from three public sources");
  tile(230, "56,000+", "genes on the panel");

  // Right: three constraints, one panel each, revealed in turn
  const panels = svg.append("g").attr("transform", "translate(560 30)");
  const panelW = 290;
  const gap = 35;
  const panel = (i, title) => {
    const p = panels
      .append("g")
      .attr("class", "fragment")
      .attr("data-fragment-index", i)
      .attr("transform", `translate(${i * (panelW + gap)} 0)`);
    p.append("rect")
      .attr("class", "coral-panel")
      .attr("width", panelW)
      .attr("height", 400)
      .attr("rx", 14);
    p.append("text")
      .attr("class", "coral-panel-title")
      .attr("x", panelW / 2)
      .attr("y", 360)
      .attr("text-anchor", "middle")
      .selectAll("tspan")
      .data(title)
      .join("tspan")
      .attr("x", panelW / 2)
      .attr("dy", (d, j) => (j ? 30 : 0))
      .text((d) => d);
    return p;
  };

  // Two cohorts at a time: two cards, and a third that does not fit
  const two = panel(0, ["Two cohorts", "at a time"]);
  const card = (g, x, y, color, dashed) => {
    g.append("rect")
      .attr("class", `coral-card ${dashed ? "is-dashed" : ""}`)
      .attr("x", x)
      .attr("y", y)
      .attr("width", 78)
      .attr("height", 110)
      .attr("rx", 10)
      .style("stroke", dashed ? null : color);
    if (!dashed) {
      g.append("rect")
        .attr("x", x + 11)
        .attr("y", y + 14)
        .attr("width", 56)
        .attr("height", 12)
        .attr("rx", 4)
        .style("fill", color);
      for (let r = 0; r < 4; r++) {
        g.append("rect")
          .attr("class", "coral-card-line")
          .attr("x", x + 11)
          .attr("y", y + 40 + r * 17)
          .attr("width", 30 + ((r * 37) % 25))
          .attr("height", 7)
          .attr("rx", 3);
      }
    }
  };
  card(two, 18, 110, palette.cohorts[0]);
  card(two, 106, 110, palette.cohorts[1]);
  card(two, 194, 110, null, true);
  two
    .append("text")
    .attr("class", "coral-cross")
    .attr("x", 233)
    .attr("y", 178)
    .attr("text-anchor", "middle")
    .text("+");

  // One attribute at a time: one chart lit, the rest dimmed
  const one = panel(1, ["One attribute", "at a time"]);
  const bars = [
    [0.2, 0.5, 0.9, 0.6, 0.3],
    [0.6, 0.3, 0.5, 0.8, 0.4],
    [0.3, 0.7, 0.4, 0.2, 0.6],
    [0.8, 0.4, 0.3, 0.5, 0.7],
    [0.5, 0.2, 0.7, 0.4, 0.3],
    [0.4, 0.6, 0.2, 0.8, 0.5],
  ];
  bars.forEach((values, i) => {
    const cx = 30 + (i % 3) * 85;
    const cy = 90 + Math.floor(i / 3) * 120;
    miniBars(one, {
      x: cx,
      y: cy,
      w: 70,
      h: 70,
      values,
      yMax: 1,
      color: i === 0 ? palette.cohorts[0] : null,
    }).classed("is-dim", i !== 0);
  });

  // No record of how you got there: a chain with the middle missing
  const trace = panel(2, ["No record of", "how you got there"]);
  const chain = trace.append("g").attr("transform", "translate(30 130)");
  chain
    .append("rect")
    .attr("class", "coral-chain-node")
    .attr("width", 60)
    .attr("height", 44)
    .attr("rx", 8)
    .style("fill", palette.faint);
  chain
    .append("rect")
    .attr("class", "coral-chain-node")
    .attr("x", 170)
    .attr("width", 60)
    .attr("height", 44)
    .attr("rx", 8)
    .style("fill", palette.cohorts[0]);
  chain
    .append("path")
    .attr("class", "coral-chain-link")
    .attr("d", "M 60 22 C 100 22 130 22 170 22");
  chain
    .append("text")
    .attr("class", "coral-chain-question")
    .attr("x", 115)
    .attr("y", 12)
    .attr("text-anchor", "middle")
    .text("?");
  chain
    .append("text")
    .attr("class", "coral-tick")
    .attr("x", 30)
    .attr("y", 70)
    .attr("text-anchor", "middle")
    .text("all data");
  chain
    .append("text")
    .attr("class", "coral-tick")
    .attr("x", 200)
    .attr("y", 70)
    .attr("text-anchor", "middle")
    .text("cohort");
}

register("coral-gap", renderGap);

// The cohort evolution graph, built in three clicks

function renderEvolution(el, { palette }) {
  const W = 1400;
  const H = 520;
  const c = cohorts();
  const total = c.all.length;
  const svg = svgFor(
    el,
    W,
    H,
    "coral-evolution",
    "The cohort evolution graph: all patients, split by tumor type, both types filtered on KRAS",
  );

  const COL = [40, 470, 880, 1170];
  const OP = [290, 740];
  const blockW = 190;
  const curve = (x1, y1, x2, y2) =>
    `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
  const link = (g, x1, y1, x2, y2) =>
    g
      .append("path")
      .attr("class", "coral-link")
      .attr("d", curve(x1, y1, x2, y2));

  cohortBlock(svg, {
    x: COL[0],
    y: 228,
    name: "All patients",
    n: total,
    total,
    reference: true,
  });

  // Click one: split by tumor type, which makes the complement too
  const step1 = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  link(step1, COL[0] + blockW, 260, OP[0], 260);
  operationSquare(step1, { x: OP[0], y: 230, kind: "split", label: "Split: tumor type" });
  link(step1, OP[0] + 60, 260, COL[1], 150);
  link(step1, OP[0] + 60, 260, COL[1], 370);
  cohortBlock(step1, {
    x: COL[1],
    y: 118,
    name: "Type A",
    n: c.typeA.length,
    total,
    color: palette.cohorts[0],
  });
  cohortBlock(step1, {
    x: COL[1],
    y: 338,
    name: "Type B",
    n: c.typeB.length,
    total,
    color: palette.cohorts[1],
  });

  // Click two: filter both tumor types on KRAS
  const step2 = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 1);
  const outW = 250;
  for (const [y, name, rows] of [
    [150, "Type A, KRAS mutated", c.typeAKras],
    [370, "Type B, KRAS mutated", c.typeBKras],
  ]) {
    link(step2, COL[1] + blockW, y, OP[1], y);
    operationSquare(step2, { x: OP[1], y: y - 30, kind: "filter", label: "Filter: KRAS" });
    link(step2, OP[1] + 60, y, COL[2], y);
    cohortBlock(step2, { x: COL[2], y: y - 32, w: outW, name, n: rows.length, total });
  }

  // Click three: the path back, as hovering a cohort shows it
  const step3 = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 2);
  step3
    .append("path")
    .attr("class", "coral-trace")
    .attr(
      "d",
      [
        curve(COL[0] + blockW, 260, OP[0], 260),
        curve(OP[0] + 60, 260, COL[1], 370),
        curve(COL[1] + blockW, 370, OP[1], 370),
        curve(OP[1] + 60, 370, COL[2], 370),
      ].join(" "),
    );
  step3
    .append("text")
    .attr("class", "coral-caption")
    .attr("x", COL[3] - 40)
    .attr("y", 470)
    .attr("text-anchor", "end")
    .text("The path back to the start, as Coral lights it on hover.");
}

register("coral-evolution", renderEvolution);

// How the evolution view and the action view work together

function renderWorkflow(el, { palette }) {
  const W = 1500;
  const H = 720;
  const c = cohorts();
  const total = c.all.length;
  const svg = svgFor(
    el,
    W,
    H,
    "coral-workflow",
    "Cohorts picked in the evolution view become the input; a create operation makes output cohorts that return to the graph, a characterize operation creates nothing",
  );
  svg
    .append("defs")
    .append("marker")
    .attr("id", "coral-flow-head")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8)
    .attr("refY", 5)
    .attr("markerWidth", 5)
    .attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path")
    .attr("class", "coral-flow-head")
    .attr("d", "M 0 0 L 10 5 L 0 10 Z");

  const curve = (x1, y1, x2, y2) =>
    `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
  const link = (g, x1, y1, x2, y2) =>
    g
      .append("path")
      .attr("class", "coral-link")
      .attr("d", curve(x1, y1, x2, y2));
  const flow = (g, d) =>
    g
      .append("path")
      .attr("class", "coral-flow")
      .attr("d", d)
      .attr("marker-end", "url(#coral-flow-head)");
  const step = (g, n, x, y) => {
    const badge = g.append("g").attr("transform", `translate(${x} ${y})`);
    badge.append("circle").attr("class", "coral-step").attr("r", 20);
    badge
      .append("text")
      .attr("class", "coral-step-text")
      .attr("y", 8)
      .attr("text-anchor", "middle")
      .text(n);
  };
  const panel = (x, y, w, h, title) => {
    svg
      .append("rect")
      .attr("class", "coral-panel")
      .attr("x", x)
      .attr("y", y)
      .attr("width", w)
      .attr("height", h)
      .attr("rx", 14);
    svg
      .append("text")
      .attr("class", "coral-area-title")
      .attr("x", x + 24)
      .attr("y", y + 38)
      .text(title);
  };

  // The two views: the evolution graph on top, the action view below
  panel(0, 0, W, 300, "Cohort evolution view");
  panel(0, 370, 420, 350, "Input");
  panel(470, 370, 560, 350, "Operation");
  panel(1080, 370, 420, 350, "Output");

  // The graph so far: all patients, split by tumor type
  const blockW = 190;
  cohortBlock(svg, {
    x: 40,
    y: 118,
    name: "All patients",
    n: total,
    total,
    reference: true,
  });
  link(svg, 230, 150, 280, 150);
  operationSquare(svg, { x: 280, y: 120, kind: "split", label: "Split: tumor type" });
  link(svg, 340, 150, 470, 102);
  link(svg, 340, 150, 470, 212);
  cohortBlock(svg, {
    x: 470,
    y: 70,
    name: "Type A",
    n: c.typeA.length,
    total,
    color: palette.cohorts[0],
  });
  cohortBlock(svg, {
    x: 470,
    y: 180,
    name: "Type B",
    n: c.typeB.length,
    total,
    color: palette.cohorts[1],
  });

  const card = (y, head, detail, note) => {
    const g = svg.append("g").attr("transform", `translate(500 ${y})`);
    g.append("rect")
      .attr("class", "coral-card coral-workflow-card")
      .attr("width", 500)
      .attr("height", 124)
      .attr("rx", 12);
    g.append("text").attr("class", "coral-panel-title").attr("x", 24).attr("y", 40).text(head);
    g.append("text").attr("class", "coral-legend").attr("x", 24).attr("y", 76).text(detail);
    g.append("text").attr("class", "coral-workflow-note").attr("x", 24).attr("y", 108).text(note);
  };
  card(424, "Create cohorts", "Filter · Split", "new cohorts go to the output");
  card(
    568,
    "Characterize cohorts",
    "Prevalence · Inspect items · Compare",
    "describes the input, creates nothing",
  );

  // Click one: pick cohorts in the graph, they become the input
  const pick = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  pick
    .append("rect")
    .attr("class", "coral-selection")
    .attr("x", 458)
    .attr("y", 58)
    .attr("width", 214)
    .attr("height", 198)
    .attr("rx", 14);
  flow(pick, "M 565 256 V 334 H 145 V 438");
  step(pick, 1, 355, 334);
  cohortBlock(pick, {
    x: 40,
    y: 450,
    name: "Type A",
    n: c.typeA.length,
    total,
    color: palette.cohorts[0],
  });
  cohortBlock(pick, {
    x: 40,
    y: 560,
    name: "Type B",
    n: c.typeB.length,
    total,
    color: palette.cohorts[1],
  });

  // Click two: apply an operation, either kind
  const apply = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 1);
  flow(apply, curve(250, 537, 488, 486));
  flow(apply, curve(250, 537, 488, 630));
  step(apply, 2, 330, 537);

  // Click three: only create operations fill the output
  const out = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 2);
  flow(out, curve(1000, 486, 1100, 482));
  flow(out, curve(1000, 486, 1100, 592));
  step(out, 3, 1055, 440);
  const outW = 270;
  cohortBlock(out, {
    x: 1110,
    y: 450,
    w: outW,
    name: "Type A, KRAS mutated",
    n: c.typeAKras.length,
    total,
  });
  cohortBlock(out, {
    x: 1110,
    y: 560,
    w: outW,
    name: "Type B, KRAS mutated",
    n: c.typeBKras.length,
    total,
  });

  // Click four: the new cohorts return to the graph, ready for the next step
  const back = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 3);
  for (const [i, y] of [102, 212].entries()) {
    link(back, 470 + blockW, y, 760, y);
    operationSquare(back, { x: 760, y: y - 30, kind: "filter", label: "Filter: KRAS" });
    link(back, 820, y, 900, y);
    cohortBlock(back, {
      x: 900,
      y: y - 32,
      w: outW,
      name: i ? "Type B, KRAS mutated" : "Type A, KRAS mutated",
      n: i ? c.typeBKras.length : c.typeAKras.length,
      total,
    });
  }
  flow(back, "M 1380 482 H 1440 V 102 H 1182");
  flow(back, "M 1380 592 H 1470 V 212 H 1182");
  step(back, 4, 1455, 334);
}

register("coral-workflow", renderWorkflow);

// Input, operation, output, and what the filter did to age

const ATTRIBUTES = {
  age: {
    title: "Age",
    values: (rows) => [...ageBins(rows), 0],
    labels: [
      { text: "34", anchor: "start" },
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      { text: "89", anchor: "end" },
      "?",
    ],
  },
  stage: { title: "Stage", values: (rows) => shares(rows, "stage", STAGES), labels: STAGES },
  sex: { title: "Sex", values: (rows) => shares(rows, "sex", SEXES), labels: SEXES },
  KRAS: {
    title: "KRAS",
    values: (rows) => shares(rows, "KRAS", MARKER_STATES),
    labels: ["mut", "wt", "?"],
  },
};

const VARIANTS = {
  multiples: {
    inputs: (c) => [
      { name: "Type A", rows: c.typeA, color: 0 },
      { name: "Type B", rows: c.typeB, color: 1 },
    ],
    attributes: ["age", "stage", "KRAS"],
    operation: {
      kind: "filter",
      label: "Filter",
      attribute: "KRAS",
      keep: 0,
      keepLabel: "mutated",
    },
    outputs: (c) => [
      { name: "Type A, KRAS mut.", rows: c.typeAKras, color: null },
      { name: "Type B, KRAS mut.", rows: c.typeBKras, color: null },
    ],
    cellW: 180,
    cellH: 220,
    blockW: 225,
    // Show age means within each tumor type
    means: true,
  },
};

function renderMultiples(el, { palette }) {
  const variant = VARIANTS[el.dataset.variant ?? "multiples"];
  const c = cohorts();
  const total = c.all.length;
  const inputs = variant.inputs(c);
  const outputs = variant.outputs(c);
  const attrs = variant.attributes.map((k) => ATTRIBUTES[k]);
  const { cellW, cellH } = variant;

  const blockW = variant.blockW ?? 190;
  const top = variant.means ? 120 : 60;
  const rowH = cellH + 70;
  const colGap = 24;
  const sideW = blockW + colGap + attrs.length * (cellW + colGap);
  // With an attribute to show, the operation gets its own area
  const opAttr = variant.operation.attribute ? ATTRIBUTES[variant.operation.attribute] : null;
  // Wide enough that the column headers do not overlap
  const opW = opAttr ? 230 : 240;
  const W = sideW * 2 + opW + 40;
  const H = top + 10 + Math.max(inputs.length, outputs.length) * rowH;
  const svg = svgFor(
    el,
    W,
    H,
    `coral-multiples coral-${el.dataset.variant ?? "multiples"}`,
    "Input cohorts on the left, the operation in the middle, output cohorts on the right, one small chart per cohort and attribute on a shared domain",
  );

  // The domain each attribute shares across every row shown
  const allRows = [...inputs, ...outputs];
  const yMax = attrs.map((a) => max(allRows, (r) => max(a.values(r.rows))));

  const header = (g, x, title) =>
    g.append("text").attr("class", "coral-area-title").attr("x", x).attr("y", 26).text(title);

  const area = (g, x0, list, title, tag) => {
    header(g, x0, title);
    attrs.forEach((a, j) => {
      g.append("text")
        .attr("class", "coral-col-title")
        .attr("x", x0 + blockW + colGap + j * (cellW + colGap) + cellW / 2)
        .attr("y", 26)
        .attr("text-anchor", "middle")
        .text(a.title);
    });
    list.forEach((cohort, i) => {
      const y = top + i * rowH;
      const color = cohort.color === null ? null : palette.cohorts[cohort.color];
      cohortBlock(g, {
        x: x0,
        w: blockW,
        y: y + (cellH - 64) / 2,
        name: cohort.name,
        n: cohort.rows.length,
        total,
        color,
      });
      attrs.forEach((a, j) => {
        const values = a.values(cohort.rows);
        miniBars(g, {
          x: x0 + blockW + colGap + j * (cellW + colGap),
          y,
          w: cellW,
          h: cellH,
          values,
          labels: a.labels,
          yMax: yMax[j],
          color: color ?? palette.muted,
        });
      });
      if (variant.means) {
        const m = mean(cohort.rows, (d) => d.age);
        const [lo, hi] = extent(c.all, (d) => d.age);
        const x = x0 + blockW + colGap + ((m - lo) / (hi - lo)) * cellW * (10 / 11);
        const mark = g
          .append("g")
          .attr("class", `coral-mean fragment ${tag}`)
          .attr("data-fragment-index", 2);
        mark
          .append("line")
          .attr("x1", x)
          .attr("x2", x)
          .attr("y1", y - 10)
          .attr("y2", y + cellH);
        mark
          .append("text")
          .attr("x", x)
          .attr("y", y - 20)
          .attr("text-anchor", "middle")
          .text(`mean age ${m.toFixed(1)}`);
      }
    });
  };

  area(svg, 20, inputs, "Input", "is-input");

  const opG = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  const opX0 = 20 + sideW;
  header(opG, opX0 + 10, "Operation");
  if (opAttr) {
    // Funnel on top, the kept bar lit below
    const areaH = inputs.length * rowH - 20;
    opG
      .append("rect")
      .attr("class", "coral-op-area")
      .attr("x", opX0 + 10)
      .attr("y", top - 16)
      .attr("width", opW - 20)
      .attr("height", areaH)
      .attr("rx", 12);
    operationSquare(opG, {
      x: opX0 + opW / 2 - 24,
      y: top,
      kind: variant.operation.kind,
      label: variant.operation.label,
      size: 48,
    });
    const chartW = opW - 70;
    const values = opAttr.values(inputs.flatMap((c) => c.rows));
    opG
      .append("text")
      .attr("class", "coral-col-title")
      .attr("x", opX0 + opW / 2)
      .attr("y", top + 118)
      .attr("text-anchor", "middle")
      .text(`Keep ${opAttr.title} ${variant.operation.keepLabel}`);
    miniBars(opG, {
      x: opX0 + (opW - chartW) / 2,
      y: top + 132,
      w: chartW,
      h: cellH - 20,
      values,
      labels: opAttr.labels,
      yMax: max(values),
      color: null,
      highlight: [variant.operation.keep],
    }).classed("is-selector", true);
  } else {
    operationSquare(opG, {
      x: opX0 + (opW - 60) / 2,
      y: top + cellH / 2 - 30,
      kind: variant.operation.kind,
      label: variant.operation.label,
    });
  }

  const outG = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 1);
  area(outG, 20 + sideW + opW + 20, outputs, "Output", "is-output");
}

register("coral-multiples", renderMultiples);

// The View operation, filled versus unfilled

/** Gaussian kernel density with Silverman's bandwidth. */
function density(values, xs) {
  const n = values.length;
  const m = mean(values);
  const sd = Math.sqrt(mean(values, (v) => (v - m) ** 2));
  const h = 1.06 * sd * n ** -0.2;
  return xs.map((x) => {
    let s = 0;
    for (const v of values) {
      const u = (x - v) / h;
      s += Math.exp(-0.5 * u * u);
    }
    return s / (n * h * Math.sqrt(2 * Math.PI));
  });
}

function renderDensity(el, { palette }) {
  const W = 1500;
  const H = 520;
  const c = cohorts();
  const svg = svgFor(
    el,
    W,
    H,
    "coral-density",
    "Four cohorts' age distributions superimposed, filled on the left and unfilled on the right",
  );

  // Both tumor types, each split by KRAS, so two age modes and four curves
  const groups = [
    { name: "Type A, KRAS mutated", rows: c.typeA.filter((r) => r.KRAS === "mutated"), color: 0 },
    {
      name: "Type A, KRAS wild type",
      rows: c.typeA.filter((r) => r.KRAS === "wild type"),
      color: 1,
    },
    { name: "Type B, KRAS mutated", rows: c.typeB.filter((r) => r.KRAS === "mutated"), color: 2 },
    {
      name: "Type B, KRAS wild type",
      rows: c.typeB.filter((r) => r.KRAS === "wild type"),
      color: 3,
    },
  ];
  const [lo, hi] = extent(c.all, (d) => d.age);
  const xs = Array.from({ length: 80 }, (_, i) => lo + ((hi - lo) * i) / 79);
  const curves = groups.map((g) => ({
    ...g,
    ys: density(
      g.rows.map((r) => r.age),
      xs,
    ),
  }));
  const yMax = max(curves, (g) => max(g.ys));

  const panelW = 620;
  const panelH = 330;
  const top = 70;
  const panel = (x0, title, filled) => {
    const g = svg.append("g").attr("transform", `translate(${x0} ${top})`);
    g.append("text").attr("class", "coral-area-title").attr("y", -24).text(title);
    g.append("line")
      .attr("class", "coral-baseline")
      .attr("x1", 0)
      .attr("x2", panelW)
      .attr("y1", panelH)
      .attr("y2", panelH);
    [lo, hi].forEach((v, i) => {
      g.append("text")
        .attr("class", "coral-tick")
        .attr("x", i ? panelW : 0)
        .attr("y", panelH + 24)
        .attr("text-anchor", i ? "end" : "start")
        .text(`${v}`);
    });
    g.append("text")
      .attr("class", "coral-tick")
      .attr("x", panelW / 2)
      .attr("y", panelH + 24)
      .attr("text-anchor", "middle")
      .text("age");
    const x = (v) => ((v - lo) / (hi - lo)) * panelW;
    const y = (v) => panelH - (v / yMax) * (panelH - 20);
    for (const curve of curves) {
      const line = curve.ys.map((v, i) => `${i ? "L" : "M"} ${x(xs[i])} ${y(v)}`).join(" ");
      if (filled) {
        g.append("path")
          .attr("class", "coral-density-fill")
          .attr("d", `${line} L ${panelW} ${panelH} L 0 ${panelH} Z`)
          .style("fill", palette.cohorts[curve.color]);
      }
      g.append("path")
        .attr("class", "coral-density-line")
        .attr("d", line)
        .style("stroke", palette.cohorts[curve.color]);
    }
    return g;
  };

  panel(30, "Filled", true);
  panel(30 + panelW + 200, "Unfilled", false)
    .classed("fragment", true)
    .attr("data-fragment-index", 0);

  const legend = svg.append("g").attr("transform", `translate(30 ${top + panelH + 60})`);
  curves.forEach((curve, i) => {
    const item = legend
      .append("g")
      .attr("transform", `translate(${(i % 2) * 700} ${Math.floor(i / 2) * 40})`);
    item
      .append("line")
      .attr("class", "coral-density-line")
      .attr("x1", 0)
      .attr("x2", 36)
      .attr("y1", 0)
      .attr("y2", 0)
      .style("stroke", palette.cohorts[curve.color]);
    item
      .append("text")
      .attr("class", "coral-legend")
      .attr("x", 48)
      .attr("y", 7)
      .text(`${curve.name} (${curve.rows.length})`);
  });
}

register("coral-density", renderDensity);

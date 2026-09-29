import { select } from "d3";

import { register } from "./registry.js";
import { rule } from "./tokens.js";

// Sensemaking loop diagram; data-stage picks pirolli, iterations, empty, progress or full

const W = 1400;
const H = 660;
const MID = W / 2;

// The inner loop and the ring around it
const INNER = { x: 120, y: 120, w: 1160, h: 400, r: 56 };
const OUTER = { x: 30, y: 30, w: 1340, h: 600, r: 80 };

// Slot rows, one per iteration, and the two columns, each centered in its half
const ROWS = [
  { y: 220, label: "First iteration", space: "the attribute space" },
  { y: 350, label: "Second iteration", space: "the expression space" },
];
const SLOT = { w: 300, h: 84, r: 14 };
const CENTERS = [(INNER.x + MID) / 2, (MID + INNER.x + INNER.w) / 2];
const COLS = { left: CENTERS[0] - SLOT.w / 2, right: CENTERS[1] - SLOT.w / 2 };
const LOOPS_SLOT = { x: MID - 290, y: 548, w: 580, h: 62, r: 14 };

const SYSTEMS = {
  coral: { name: "Coral", role: "Form groups by attribute" },
  tourdino: { name: "TourDino", role: "Compare, statistically" },
  embeddings: { name: "Embeddings", role: "Form groups by structure" },
  kokiri: { name: "Kokiri", role: "Compare, in combination" },
  loops: { name: "Loops", role: "Track and compare the analysis itself" },
};

function roundedRect(g, { x, y, w, h, r }, cls) {
  return g
    .append("rect")
    .attr("class", cls)
    .attr("x", x)
    .attr("y", y)
    .attr("width", w)
    .attr("height", h)
    .attr("rx", r);
}

/** Four arrowheads on the inner loop, clockwise. */
function loopArrows(g) {
  const { x, y, w, h } = INNER;
  const heads = [
    { x: x + w * 0.5, y, angle: 0 },
    { x: x + w, y: y + h * 0.5, angle: 90 },
    { x: x + w * 0.5, y: y + h, angle: 180 },
    { x, y: y + h * 0.5, angle: 270 },
  ];
  g.selectAll("path.loop-arrow")
    .data(heads)
    .join("path")
    .attr("class", "loop-arrow")
    .attr("d", "M -16 -11 L 8 0 L -16 11 Z")
    .attr("transform", (d) => `translate(${d.x} ${d.y}) rotate(${d.angle})`);
}

// Each half's heading and activity sit centered over its slot column
function halves(g, { activities = [[], []] } = {}) {
  const foraging = g.append("g").attr("class", "loop-half loop-half-foraging");
  const sensemaking = g.append("g").attr("class", "loop-half loop-half-sensemaking");
  [foraging, sensemaking].forEach((half, i) => {
    half
      .append("text")
      .attr("class", "loop-head")
      .attr("x", CENTERS[i])
      .attr("y", 96)
      .attr("text-anchor", "middle")
      .text(i ? "Sensemaking" : "Foraging");
  });

  g.append("line")
    .attr("class", "loop-divider")
    .attr("x1", MID)
    .attr("x2", MID)
    .attr("y1", INNER.y + 16)
    .attr("y2", INNER.y + INNER.h - 16);

  // One or two lines per side, both blocks centered on the same height
  const LINE = 34;
  [foraging, sensemaking].forEach((half, i) => {
    const lines = activities[i];
    half
      .append("text")
      .attr("class", "loop-activity")
      .attr("text-anchor", "middle")
      .selectAll("tspan")
      .data(lines)
      .join("tspan")
      .attr("x", CENTERS[i])
      .attr("y", (d, j) => 172 + (j - (lines.length - 1) / 2) * LINE)
      .text((d) => d);
  });
  return { foraging, sensemaking };
}

// Slot state is "filled", "next" or "empty"
function slot(g, x, y, system, state) {
  const s = g
    .append("g")
    .attr("class", `loop-slot is-${state}`)
    .attr("transform", `translate(${x} ${y})`);
  roundedRect(s, { x: 0, y: 0, w: SLOT.w, h: SLOT.h, r: SLOT.r }, "loop-slot-box");
  if (state !== "empty" && system) {
    s.append("text").attr("class", "loop-slot-name").attr("x", 24).attr("y", 36).text(system.name);
    s.append("text").attr("class", "loop-slot-role").attr("x", 24).attr("y", 64).text(system.role);
  }
  return s;
}

// The row label sits on the divider, between the row's two slots
function rowLabel(g, row) {
  // An opaque patch hides the divider behind the label
  const patch = { w: 240, h: 64 };
  g.append("rect")
    .attr("class", "loop-band-base")
    .attr("x", MID - patch.w / 2)
    .attr("y", row.y + (SLOT.h - patch.h) / 2)
    .attr("width", patch.w)
    .attr("height", patch.h);
  const t = g
    .append("text")
    .attr("class", "loop-row-label")
    .attr("x", MID)
    .attr("y", row.y + SLOT.h / 2 - 4)
    .attr("text-anchor", "middle");
  t.append("tspan").attr("class", "loop-row-iteration").text(row.label);
  t.append("tspan").attr("x", MID).attr("dy", 28).text(row.space);
  return t;
}

function outerRing(g, state) {
  const ring = g.append("g").attr("class", "loop-outer");
  roundedRect(ring, OUTER, "loop-ring loop-ring-outer");
  const s = ring
    .append("g")
    .attr("class", `loop-slot loop-slot-wide is-${state}`)
    .attr("transform", `translate(${LOOPS_SLOT.x} ${LOOPS_SLOT.y})`);
  roundedRect(
    s,
    { x: 0, y: 0, w: LOOPS_SLOT.w, h: LOOPS_SLOT.h, r: LOOPS_SLOT.r },
    "loop-slot-box",
  );
  if (state !== "empty") {
    s.append("text")
      .attr("class", "loop-slot-name")
      .attr("x", 24)
      .attr("y", 40)
      .text(SYSTEMS.loops.name);
    s.append("text")
      .attr("class", "loop-slot-role")
      .attr("x", 150)
      .attr("y", 40)
      .text(SYSTEMS.loops.role);
  }
  return ring;
}

function render(el) {
  const stage = el.dataset.stage ?? "full";
  const svg = select(el)
    .append("svg")
    .attr("class", `loop-diagram loop-stage-${stage}`)
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      "The sensemaking loop: foraging on the left, sensemaking on the right, iterated twice, with the analysis itself tracked around it",
    );

  const inner = svg.append("g").attr("class", "loop-inner");
  roundedRect(inner, INNER, "loop-ring loop-ring-inner");
  loopArrows(inner);

  if (stage === "pirolli") {
    const { foraging, sensemaking } = halves(svg);
    const list = (g, x, items) =>
      g
        .append("text")
        .attr("class", "loop-list")
        .attr("x", x)
        .attr("y", 266)
        .attr("text-anchor", "middle")
        .selectAll("tspan")
        .data(items)
        .join("tspan")
        .attr("x", x)
        .attr("dy", (d, i) => (i ? 54 : 0))
        .text((d) => d);
    list(foraging, CENTERS[0], ["gather", "filter", "organize"]);
    list(sensemaking, CENTERS[1], ["build a model", "test it", "revise it"]);
    sensemaking.classed("fragment", true).attr("data-fragment-index", 1);
    return;
  }

  halves(svg, {
    activities: [["Define the groups"], ["What separates them, and is it real?"]],
  });

  if (stage === "iterations") {
    ROWS.forEach((row, i) => {
      const band = svg
        .append("g")
        .attr("class", "loop-band fragment")
        .attr("data-fragment-index", i);
      const box = { x: INNER.x + 30, y: row.y - 12, w: INNER.w - 60, h: SLOT.h + 24, r: 20 };
      // An opaque base first, so the divider does not show through the tint
      roundedRect(band, box, "loop-band-base");
      roundedRect(band, box, "loop-band-box");
      band
        .append("text")
        .attr("class", "loop-band-label")
        .attr("x", MID)
        .attr("y", row.y + SLOT.h / 2 + 10)
        .attr("text-anchor", "middle")
        .text(`${row.label}, in ${row.space}`);
    });
    const ring = outerRing(svg, false);
    ring.classed("fragment", true).attr("data-fragment-index", 2);
    ring.select(".loop-slot").remove();
    ring
      .append("text")
      .attr("class", "loop-band-label")
      .attr("x", MID)
      .attr("y", LOOPS_SLOT.y + 40)
      .attr("text-anchor", "middle")
      .text("And one level above: the analysis itself");
    return;
  }

  // "progress" fills the slots named in data-done and marks the one in data-next
  const done = (el.dataset.done ?? "").split(",").filter(Boolean);
  const next = el.dataset.next;
  const stateOf = (key) => {
    if (stage === "full" || done.includes(key)) return "filled";
    return key === next ? "next" : "empty";
  };
  const systemsByRow = [
    ["coral", "tourdino"],
    ["embeddings", "kokiri"],
  ];
  ROWS.forEach((row, i) => {
    rowLabel(svg, row);
    [COLS.left, COLS.right].forEach((x, j) => {
      const key = systemsByRow[i][j];
      // On the empty diagram the next slot arrives on a click, over its empty twin
      if (stage === "empty" && key === next) {
        slot(svg, x, row.y, SYSTEMS[key], "empty");
        const g = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
        slot(g, x, row.y, SYSTEMS[key], "next");
        return;
      }
      slot(svg, x, row.y, SYSTEMS[key], stateOf(key));
    });
  });
  outerRing(svg, stateOf("loops"));
}

register("loop", render);

// Keep the token import referenced
void rule;

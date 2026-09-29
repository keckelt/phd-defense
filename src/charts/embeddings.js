import { contourDensity, extent, geoPath, scaleLinear, select, symbol, symbolDiamond } from "d3";

import { cohortBlock, operationSquare } from "./coral.js";
import { cohortRows, embeddingRows } from "./data.js";
import { register } from "./registry.js";

/** Expression space charts, all on the same UMAP projection with cohort metadata. */

const W = 1400;
const H = 640;

// Which cohort token each group wears, in the order the groups appear
const GROUP_COLOR = { "Type A": 0, "Type B": 1, A1: 2, A2: 3 };
const GROUP_LABEL = { "Type A": "Type A", "Type B": "Type B", A1: "A1", A2: "A2" };

let joined = null;

/** The projection with the metadata attached, cached after the first call. */
function rows() {
  if (joined) return joined;
  const meta = new Map(cohortRows().map((r) => [r.patient_id, r]));
  joined = embeddingRows().map((r) => ({ ...r, ...meta.get(r.patient_id) }));
  return joined;
}

/** Position scales for a plot area, padded so no mark touches the edge. */
function scales(w, h, pad = 28) {
  const data = rows();
  const x = scaleLinear()
    .domain(extent(data, (d) => d.x))
    .nice()
    .range([pad, w - pad]);
  const y = scaleLinear()
    .domain(extent(data, (d) => d.y))
    .nice()
    .range([h - pad, pad]);
  return { x, y };
}

function mean(data, key) {
  return data.reduce((sum, d) => sum + d[key], 0) / data.length;
}

function centroid(data, { x, y }) {
  const n = data.length;
  return {
    px: data.reduce((s, d) => s + x(d.x), 0) / n,
    py: data.reduce((s, d) => s + y(d.y), 0) / n,
  };
}

/** The scatter itself. `color` maps a row to a cohort index or -1 for neutral. */
function scatter(g, data, { x, y }, colors, color = () => -1, radius = 6) {
  g.append("g")
    .attr("class", "emb-items")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", (d) => x(d.x))
    .attr("cy", (d) => y(d.y))
    .attr("r", radius)
    .attr("class", (d) => (color(d) < 0 ? "emb-item is-neutral" : "emb-item"))
    .attr("fill", (d) => (color(d) < 0 ? null : colors.cohorts[color(d)]));
}

/** A diamond at the centroid, with a direct label beside it. */
function centroidMark(g, data, sc, colors, group) {
  const c = centroid(data, sc);
  const mark = g
    .append("g")
    .attr("class", "emb-centroid")
    .attr("transform", `translate(${c.px} ${c.py})`);
  mark
    .append("path")
    .attr("d", symbol(symbolDiamond).size(1300)())
    .attr("fill", colors.cohorts[GROUP_COLOR[group]]);
  mark
    .append("text")
    .attr("class", "emb-label")
    .attr("x", 30)
    .attr("y", 10)
    .text(GROUP_LABEL[group]);
  return c;
}

/** Lines from every item of a group to its centroid (Gestalt connectedness). */
function membershipLines(g, data, sc, colors, group) {
  const c = centroid(data, sc);
  g.append("g")
    .attr("class", "emb-membership")
    .selectAll("line")
    .data(data)
    .join("line")
    .attr("x1", c.px)
    .attr("y1", c.py)
    .attr("x2", (d) => sc.x(d.x))
    .attr("y2", (d) => sc.y(d.y))
    .attr("stroke", colors.cohorts[GROUP_COLOR[group]]);
}

/** Density contours of a group, bandwidth one tenth of the range. */
function contours(g, data, sc, colors, group, w, h, thresholds = 6) {
  const density = contourDensity()
    .x((d) => sc.x(d.x))
    .y((d) => sc.y(d.y))
    .size([w, h])
    .bandwidth((sc.x.range()[1] - sc.x.range()[0]) / 10 / 2.5)
    .thresholds(thresholds)(data);
  g.append("g")
    .attr("class", "emb-contours")
    .selectAll("path")
    .data(density)
    .join("path")
    .attr("d", geoPath())
    .attr("stroke", colors.cohorts[GROUP_COLOR[group]])
    .attr("fill", colors.cohorts[GROUP_COLOR[group]]);
}

function frame(svg, label) {
  return svg
    .append("svg")
    .attr("class", "emb-chart")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr("aria-label", label);
}

function subtitle(g, text) {
  g.append("text")
    .attr("class", "emb-legend-detail")
    .attr("x", 634)
    .attr("y", 40)
    .attr("text-anchor", "end")
    .text(text);
}

function panelTitle(g, x, text, anchor = "start") {
  g.append("text")
    .attr("class", "emb-panel-title")
    .attr("x", x)
    .attr("y", 36)
    .attr("text-anchor", anchor)
    .text(text);
}

function plotArea(g, x, y, w, h) {
  g.append("rect")
    .attr("class", "emb-plot-area")
    .attr("x", x)
    .attr("y", y)
    .attr("width", w)
    .attr("height", h)
    .attr("rx", 12);
}

// Cohort graph next to a projection without it

function groupProblem(el, { palette: colors }) {
  const svg = frame(
    select(el),
    "Left, the cohort graph from Coral: all 600 patients split into Type A and Type B. Right, the same patients projected, as dots without their groups",
  );
  const data = rows();
  const panelW = 640;
  const top = 60;
  const panelH = H - top - 10;

  // Left: the graph the cohorts came with, drawn as Coral draws it
  const left = svg.append("g").attr("class", "emb-panel");
  panelTitle(left, 0, "The cohorts");
  subtitle(left, "a graph, built in Coral");
  plotArea(left, 0, top, panelW, panelH);
  const total = data.length;
  const count = (group) => data.filter((d) => d.tumor_type === group).length;
  const midY = top + panelH / 2;
  const graph = left.append("g");
  // A straight run first, so the curves clear the operation's label
  const link = (x1, y1, x2, y2, run = 0) =>
    graph
      .append("path")
      .attr("class", "coral-link")
      .attr(
        "d",
        `M ${x1} ${y1} H ${x1 + run} C ${(x1 + run + x2) / 2} ${y1} ${(x1 + run + x2) / 2} ${y2} ${x2} ${y2}`,
      );
  const blockH = 64;
  link(200, midY, 240, midY);
  link(300, midY, 410, midY - 110, 50);
  link(300, midY, 410, midY + 110, 50);
  cohortBlock(graph, {
    x: 20,
    w: 180,
    y: midY - blockH / 2,
    name: "All patients",
    n: total,
    total,
    reference: true,
  });
  operationSquare(graph, { x: 240, y: midY - 30, kind: "split", label: "Split: tumor type" });
  for (const [group, dy] of [
    ["Type A", -110],
    ["Type B", 110],
  ]) {
    cohortBlock(graph, {
      x: 410,
      y: midY + dy - blockH / 2,
      w: 200,
      name: group,
      n: count(group),
      total,
      color: colors.cohorts[GROUP_COLOR[group]],
    });
  }

  // Right: the projection knows the patients, not the groups
  const right = svg
    .append("g")
    .attr("class", "emb-panel fragment")
    .attr("data-fragment-index", 0)
    .attr("transform", `translate(${W - panelW} 0)`);
  panelTitle(right, 0, "The projection");
  subtitle(right, "one dot per patient");
  plotArea(right, 0, top, panelW, panelH);
  const plot = right.append("g").attr("transform", `translate(0 ${top})`);
  scatter(plot, data, scales(panelW, panelH), colors);
  plot
    .append("text")
    .attr("class", "emb-callout")
    .attr("x", 30)
    .attr("y", 50)
    .text("Where are the groups?");
}

register("group-problem", groupProblem);

// The same cohort in the attribute space and the expression space

function twoSpaces(el, { palette: colors }) {
  const svg = frame(
    select(el),
    "The same 600 patients: two tidy blocks in the attribute space, three clusters in the expression space, where Type A splits into A1 and A2",
  );
  const data = rows();
  const panelW = 640;
  const top = 60;
  const panelH = H - top - 10;
  const typeA = data.filter((d) => d.tumor_type === "Type A");
  const typeB = data.filter((d) => d.tumor_type === "Type B");
  const subs = ["A1", "A2"].map((sub) => ({
    sub,
    members: typeA.filter((d) => d.subgroup_truth === sub),
  }));
  // Type A patients in the Type B cluster stay blue but still count toward their sub-cohort
  const centers = [
    ...subs.map((s) => ({ key: s.sub, rows: s.members })),
    { key: "Type B", rows: typeB },
  ].map(({ key, rows: r }) => ({ key, x: mean(r, "x"), y: mean(r, "y") }));
  const distance = (d, c) => (d.x - c.x) ** 2 + (d.y - c.y) ** 2;
  const nearest = (d) =>
    centers.reduce((best, c) => (distance(d, c) < distance(d, best) ? c : best)).key;
  const inTypeB = (d) => nearest(d) === "Type B";
  const splitColor = (d) => GROUP_COLOR[inTypeB(d) ? "Type A" : d.subgroup_truth];

  // Left: the attribute space, one cell per patient, Type A ordered A1 first
  const left = svg.append("g").attr("class", "emb-panel");
  panelTitle(left, 0, "Attribute space");
  subtitle(left, "what the cohorts were built from");
  plotArea(left, 0, top, panelW, panelH);
  const cell = 15;
  const cols = 30;
  const x0 = (panelW - cols * cell) / 2;
  const cells = (g, members, y0, color) =>
    g
      .append("g")
      .selectAll("rect")
      .data(members)
      .join("rect")
      .attr("class", "emb-cell")
      .attr("x", (d, i) => x0 + (i % cols) * cell)
      .attr("y", (d, i) => y0 + Math.floor(i / cols) * cell)
      .attr("width", cell - 3)
      .attr("height", cell - 3)
      .attr("rx", 2)
      .attr("fill", color);
  const blocks = [
    {
      group: "Type A",
      // A1, then the patients left blue, then A2, so a blue square sits between the runs
      members: [
        ...subs[0].members.filter((d) => !inTypeB(d)),
        ...typeA.filter(inTypeB),
        ...subs[1].members.filter((d) => !inTypeB(d)),
      ],
      y0: top + 60,
    },
    { group: "Type B", members: typeB, y0: top + 60 + 12 * cell + 90 },
  ];
  for (const block of blocks) {
    cells(left, block.members, block.y0, colors.cohorts[GROUP_COLOR[block.group]]);
    // Type A's label gives way to the split
    left
      .append("text")
      .attr("class", block.group === "Type A" ? "emb-label fragment fade-out" : "emb-label")
      .attr("data-fragment-index", block.group === "Type A" ? 3 : null)
      .attr("x", x0)
      .attr("y", block.y0 - 16)
      .text(`${block.group}, ${block.members.length} patients`);
  }
  const splitLeft = left.append("g").attr("class", "fragment").attr("data-fragment-index", 3);
  cells(splitLeft, blocks[0].members, blocks[0].y0, (d) => colors.cohorts[splitColor(d)]);
  splitLeft
    .append("text")
    .attr("class", "emb-label")
    .attr("x", x0)
    .attr("y", blocks[0].y0 - 16)
    .text(`Type A: ${subs.map((s) => `${s.sub}, ${s.members.length}`).join(" · ")}`);

  // Right: the expression space, the same patients on the projection
  const right = svg
    .append("g")
    .attr("class", "emb-panel fragment")
    .attr("data-fragment-index", 1)
    .attr("transform", `translate(${W - panelW} 0)`);
  panelTitle(right, 0, "Expression space");
  subtitle(right, "the same patients, projected");
  plotArea(right, 0, top, panelW, panelH);
  const plot = right.append("g").attr("transform", `translate(0 ${top})`);
  const sc = scales(panelW, panelH);
  scatter(plot, data, sc, colors, (d) => GROUP_COLOR[d.tumor_type]);

  // Click two: the groups as structure, and Type A sits in two places
  const structure = plot.append("g").attr("class", "fragment").attr("data-fragment-index", 2);
  const typeAContours = structure
    .append("g")
    .attr("class", "fragment fade-out")
    .attr("data-fragment-index", 3);
  contours(typeAContours, typeA, sc, colors, "Type A", panelW, panelH);
  contours(structure, typeB, sc, colors, "Type B", panelW, panelH);

  // Click three: the split where the projection splits Type A
  const split = plot.append("g").attr("class", "fragment").attr("data-fragment-index", 3);
  scatter(split, typeA, sc, colors, splitColor);
  for (const { sub, members } of subs) contours(split, members, sc, colors, sub, panelW, panelH);
  const parent = centroid(typeA, sc);
  split
    .append("g")
    .attr("class", "emb-edges")
    .selectAll("line")
    .data(subs.map((s) => centroid(s.members, sc)))
    .join("line")
    .attr("class", "emb-edge")
    .attr("x1", parent.px)
    .attr("y1", parent.py)
    .attr("x2", (c) => c.px)
    .attr("y2", (c) => c.py);

  // Centroids on top of everything: Type A and Type B, then A1 and A2
  const marks = plot.append("g").attr("class", "fragment").attr("data-fragment-index", 2);
  centroidMark(marks, typeA, sc, colors, "Type A");
  centroidMark(marks, typeB, sc, colors, "Type B");
  const subMarks = plot.append("g").attr("class", "fragment").attr("data-fragment-index", 3);
  for (const { sub, members } of subs) centroidMark(subMarks, members, sc, colors, sub);

  plot
    .append("text")
    .attr("class", "emb-question fragment")
    .attr("data-fragment-index", 2)
    .attr("x", 300)
    .attr("y", 345)
    .text("Type A, in two places");
  plot
    .append("text")
    .attr("class", "emb-question fragment")
    .attr("data-fragment-index", 3)
    .attr("x", 300)
    .attr("y", 383)
    .text("What separates them?");
}

register("two-spaces", twoSpaces);

// Groups as structure, built up in three fragments

function groupStructure(el, { palette: colors }) {
  const svg = frame(
    select(el),
    "Cohorts drawn on the projection as centroids, membership lines and density contours",
  );
  const data = rows();
  const plotW = 880;
  const plot = svg.append("g").attr("transform", `translate(${W - plotW} 0)`);
  plotArea(plot, 0, 0, plotW, H);
  const sc = scales(plotW, H, 40);
  const groups = ["Type A", "Type B"];

  scatter(plot, data, sc, colors);

  // Fragment order: centroid, membership, contours
  const layers = [
    { index: 1, draw: membershipLines, cls: "emb-layer-membership" },
    { index: 2, draw: contours, cls: "emb-layer-contours" },
  ];
  const marks = plot.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  for (const group of groups) {
    centroidMark(
      marks,
      data.filter((d) => d.tumor_type === group),
      sc,
      colors,
      group,
    );
  }
  for (const layer of layers) {
    const g = plot
      .append("g")
      .attr("class", `fragment ${layer.cls}`)
      .attr("data-fragment-index", layer.index);
    for (const group of groups) {
      const members = data.filter((d) => d.tumor_type === group);
      if (layer.draw === contours) contours(g, members, sc, colors, group, plotW, H);
      else layer.draw(g, members, sc, colors, group);
    }
  }
  // Centroids stay on top of the lines and contours
  marks.raise();

  // The legend of what each fragment added, at the side
  const legend = svg.append("g").attr("transform", "translate(40 60)");
  const items = [
    { index: 0, text: "Centroid: the group's mean position" },
    { index: 1, text: "Membership: every item joined to its centroid" },
    { index: 2, text: "Contours: where the group is dense" },
  ];
  legend
    .selectAll("text")
    .data(items)
    .join("text")
    .attr("class", "emb-legend fragment")
    .attr("data-fragment-index", (d) => d.index)
    .attr("x", 0)
    .attr("y", (d, i) => i * 64)
    .selectAll("tspan")
    .data((d) => d.text.split(": "))
    .join("tspan")
    .attr("x", 0)
    .attr("dy", (d, i) => (i ? 30 : 0))
    .attr("class", (d, i) => (i ? "emb-legend-detail" : "emb-legend-head"))
    .text((d) => d);
}

register("group-structure", groupStructure);

// Type A split into A1 and A2 by the projection

function typeASplit(el, { palette: colors }) {
  const svg = frame(
    select(el),
    "Type A and Type B on the projection; Type A is split into sub-cohorts A1 and A2, both linked to Type A",
  );
  const data = rows();
  const plotW = 880;
  const plot = svg.append("g").attr("transform", `translate(${W - plotW} 0)`);
  plotArea(plot, 0, 0, plotW, H);
  const sc = scales(plotW, H, 40);
  const typeA = data.filter((d) => d.tumor_type === "Type A");
  const typeB = data.filter((d) => d.tumor_type === "Type B");

  // Type B stays unchanged
  scatter(plot, typeB, sc, colors, () => GROUP_COLOR["Type B"]);
  contours(plot, typeB, sc, colors, "Type B", plotW, H);

  // Before the click: Type A as one group
  const before = plot.append("g").attr("class", "fragment fade-out").attr("data-fragment-index", 0);
  scatter(before, typeA, sc, colors, () => GROUP_COLOR["Type A"]);
  contours(before, typeA, sc, colors, "Type A", plotW, H);

  // After the click: the same points as A1 and A2, split where the projection splits them
  const after = plot.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  scatter(after, typeA, sc, colors, (d) => GROUP_COLOR[d.subgroup_truth]);
  const subs = ["A1", "A2"].map((sub) => {
    const members = typeA.filter((d) => d.subgroup_truth === sub);
    contours(after, members, sc, colors, sub, plotW, H);
    return { sub, members, c: centroid(members, sc) };
  });

  // The hierarchy: each sub-cohort is linked to the cohort it came from
  const parent = centroid(typeA, sc);
  after
    .append("g")
    .attr("class", "emb-edges")
    .selectAll("line")
    .data(subs)
    .join("line")
    .attr("class", "emb-edge")
    .attr("x1", parent.px)
    .attr("y1", parent.py)
    .attr("x2", (d) => d.c.px)
    .attr("y2", (d) => d.c.py);

  // Centroids on top: Type A and Type B throughout, A1 and A2 after the click
  const marks = plot.append("g");
  centroidMark(marks, typeA, sc, colors, "Type A");
  centroidMark(marks, typeB, sc, colors, "Type B");
  const subMarks = plot.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  for (const { sub, members } of subs) centroidMark(subMarks, members, sc, colors, sub);

  const side = svg.append("g").attr("transform", "translate(40 60)");
  const beforeText = side
    .append("text")
    .attr("class", "emb-legend fragment fade-out")
    .attr("data-fragment-index", 0);
  beforeText.append("tspan").attr("class", "emb-legend-head").attr("x", 0).text("One cohort");
  beforeText
    .append("tspan")
    .attr("class", "emb-legend-detail")
    .attr("x", 0)
    .attr("dy", 34)
    .text(`Type A, ${typeA.length} patients`);
  const afterText = side
    .append("text")
    .attr("class", "emb-legend fragment")
    .attr("data-fragment-index", 0);
  afterText.append("tspan").attr("class", "emb-legend-head").attr("x", 0).text("Two sub-cohorts");
  for (const [i, { sub, members }] of subs.entries()) {
    afterText
      .append("tspan")
      .attr("class", "emb-legend-detail")
      .attr("x", 0)
      .attr("dy", i ? 30 : 34)
      .text(`${sub}, ${members.length} patients`);
  }
  afterText
    .append("tspan")
    .attr("class", "emb-legend-head")
    .attr("x", 0)
    .attr("dy", 80)
    .text("What separates them?");
}

register("type-a-split", typeASplit);

// Summary and difference for A1 against A2

const ATTRIBUTES = [
  { key: "sex", label: "Sex", values: ["F", "M"] },
  { key: "stage", label: "Stage", values: ["I", "II", "III", "IV"] },
  { key: "center", label: "Treatment center", values: ["C1", "C2", "C3"] },
  { key: "tumor_type", label: "Tumor type", values: ["Type A"] },
];

/** Share of each category per group, in percent. */
function shares(group) {
  const members = rows().filter((d) => d.subgroup_truth === group);
  const out = [];
  for (const attr of ATTRIBUTES) {
    for (const value of attr.values) {
      const n = members.filter((d) => d[attr.key] === value).length;
      out.push({ attr: attr.label, value, share: (100 * n) / members.length });
    }
  }
  return out;
}

function summaryDifference(el, { palette: colors }) {
  const svg = frame(
    select(el),
    "Summary bars for A1 and A2 on sex, stage, center and tumor type, and a diverging difference chart ranked by change",
  );
  const a1 = shares("A1");
  const a2 = shares("A2");
  const rowH = 44;
  const top = 110;
  const groupGap = 30;

  // Row positions, with a gap between attributes
  let y = top;
  const rowsY = new Map();
  let lastAttr = null;
  for (const r of a1) {
    if (lastAttr && r.attr !== lastAttr) y += groupGap;
    rowsY.set(`${r.attr}:${r.value}`, y);
    y += rowH;
    lastAttr = r.attr;
  }

  const barMax = 100;
  const summaryCol = (x0, data, group, index) => {
    const g = svg.append("g").attr("transform", `translate(${x0} 0)`);
    panelTitle(g, 0, group);
    g.append("text").attr("class", "emb-legend-detail").attr("x", 0).attr("y", 58).text("Summary");
    const scale = scaleLinear().domain([0, barMax]).range([0, 220]);
    const row = g.selectAll("g.row").data(data).join("g").attr("class", "row");
    row
      .append("rect")
      .attr("class", "emb-bar")
      .attr("x", 110)
      .attr("y", (d) => rowsY.get(`${d.attr}:${d.value}`) + 4)
      .attr("width", (d) => scale(d.share))
      .attr("height", rowH - 14)
      .attr("rx", 4)
      .attr("fill", colors.cohorts[index]);
    row
      .append("text")
      .attr("class", "emb-row-label")
      .attr("x", 100)
      .attr("y", (d) => rowsY.get(`${d.attr}:${d.value}`) + rowH / 2 + 3)
      .attr("text-anchor", "end")
      .text((d) => d.value);
    row
      .append("text")
      .attr("class", "emb-value")
      .attr("x", (d) => 118 + scale(d.share))
      .attr("y", (d) => rowsY.get(`${d.attr}:${d.value}`) + rowH / 2 + 3)
      .text((d) => `${Math.round(d.share)}%`);
    return g;
  };
  const left = summaryCol(30, a1, "A1", GROUP_COLOR.A1);
  summaryCol(430, a2, "A2", GROUP_COLOR.A2);
  // Attribute names once, in the left margin
  for (const attr of ATTRIBUTES) {
    const first = rowsY.get(`${attr.label}:${attr.values[0]}`);
    left
      .append("text")
      .attr("class", "emb-attr")
      .attr("x", 0)
      .attr("y", first - 8)
      .text(attr.label);
  }

  // The difference, self-contained: A2 minus A1, ranked by change
  const diffs = a1
    .map((r, i) => ({ ...r, diff: a2[i].share - r.share }))
    .sort((p, q) => Math.abs(q.diff) - Math.abs(p.diff));
  const g = svg
    .append("g")
    .attr("class", "fragment")
    .attr("data-fragment-index", 0)
    .attr("transform", "translate(880 0)");
  panelTitle(g, 0, "Difference, A2 minus A1");
  g.append("text")
    .attr("class", "emb-legend-detail")
    .attr("x", 0)
    .attr("y", 58)
    .text("Share of patients");
  const mid = 230;
  const scale = scaleLinear()
    .domain([-50, 50])
    .range([mid - 170, mid + 170]);
  g.append("line")
    .attr("class", "emb-axis")
    .attr("x1", mid)
    .attr("x2", mid)
    .attr("y1", top - 6)
    .attr("y2", top + diffs.length * rowH);
  const row = g
    .selectAll("g.row")
    .data(diffs)
    .join("g")
    .attr("class", "row")
    .attr("transform", (d, i) => `translate(0 ${top + i * rowH})`);
  row
    .append("rect")
    .attr("class", "emb-bar")
    .attr("x", (d) => Math.min(mid, scale(d.diff)))
    .attr("y", 4)
    .attr("width", (d) => Math.abs(scale(d.diff) - mid))
    .attr("height", rowH - 14)
    .attr("rx", 4)
    .attr("fill", (d) =>
      d.diff > 0 ? colors.cohorts[GROUP_COLOR.A2] : colors.cohorts[GROUP_COLOR.A1],
    );
  row
    .append("text")
    .attr("class", "emb-row-label")
    .attr("x", (d) => (d.diff >= 0 ? mid - 12 : mid + 12))
    .attr("y", rowH / 2 + 3)
    .attr("text-anchor", (d) => (d.diff >= 0 ? "end" : "start"))
    .text((d) => `${d.attr}: ${d.value}`);
  // A value at the end of every bar, on the side the bar points to, like the summaries
  row
    .append("text")
    .attr("class", "emb-callout")
    .attr("x", (d) => (d.diff >= 0 ? scale(d.diff) + 10 : scale(d.diff) - 10))
    .attr("y", rowH / 2 + 3)
    .attr("text-anchor", (d) => (d.diff >= 0 ? "start" : "end"))
    .text((d) => `${d.diff > 0 ? "+" : ""}${d.diff.toFixed(0)}%`);
}

register("summary-difference", summaryDifference);

// TourDino charts: look-alike comparisons and the test decision tree
import { select } from "d3";

import { chiSquared, formatP, pValue, percent } from "./coral.js";
import { cohortRows } from "./data.js";
import { register } from "./registry.js";

function svgFor(el, w, h, cls, label) {
  return select(el)
    .append("svg")
    .attr("class", `tourdino-chart ${cls}`)
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("role", "img")
    .attr("aria-label", label);
}

/** Share of a marker among patients with a known value, in two groups. */
function markerContrast(rows, marker, key, a, b) {
  const known = rows.filter((r) => r[marker] !== "unknown");
  const ga = known.filter((r) => r[key] === a);
  const gb = known.filter((r) => r[key] === b);
  const ma = ga.filter((r) => r[marker] === "mutated").length;
  const mb = gb.filter((r) => r[marker] === "mutated").length;
  const chi2 = chiSquared([
    [ma, ga.length - ma],
    [mb, gb.length - mb],
  ]);
  return {
    groups: [
      { name: `Stage ${a}`, n: ga.length, share: ma / ga.length },
      { name: `Stage ${b}`, n: gb.length, share: mb / gb.length },
    ],
    chi2,
    p: pValue(chi2),
  };
}

// Two comparisons that look alike, and only one holds up

function renderLookalike(el) {
  const W = 1500;
  const H = 620;
  const all = cohortRows();
  const c3a = all.filter((r) => r.center === "C3" && r.tumor_type === "Type A");
  const panels = [
    { title: "All patients", data: markerContrast(all, "TP53", "stage", "II", "IV") },
    { title: "A small subgroup", data: markerContrast(c3a, "TP53", "stage", "II", "IV") },
  ];
  const svg = svgFor(
    el,
    W,
    H,
    "tourdino-lookalike",
    "One question asked twice, for all patients and for a small subgroup: the same gap between stage II and stage IV, significant only with enough patients",
  );

  const panelW = 560;
  const plotH = 300;
  const top = 150;
  svg
    .append("text")
    .attr("class", "tourdino-question")
    .attr("x", W / 2)
    .attr("y", 36)
    .attr("text-anchor", "middle")
    .text("Is TP53 mutated more often in stage IV than in stage II?");
  const yMax = 0.5;
  panels.forEach((panel, i) => {
    const g = svg.append("g").attr("transform", `translate(${100 + i * 740} ${top})`);
    g.append("text").attr("class", "tourdino-title").attr("y", -44).text(panel.title);
    const n = panel.data.groups.reduce((sum, group) => sum + group.n, 0);
    g.append("text")
      .attr("class", "tourdino-subtitle")
      .attr("y", -14)
      .text(`Share with TP53 mutated, ${n} patients`);
    g.append("line")
      .attr("class", "tourdino-baseline")
      .attr("x1", 0)
      .attr("x2", panelW)
      .attr("y1", plotH)
      .attr("y2", plotH);
    panel.data.groups.forEach((group, j) => {
      const x = 90 + j * 260;
      const h = (group.share / yMax) * plotH;
      // Stages are not cohorts: light gray for II, dark for IV
      g.append("rect")
        .attr("class", `tourdino-bar${j === 0 ? " is-reference" : ""}`)
        .attr("x", x)
        .attr("y", plotH - h)
        .attr("width", 120)
        .attr("height", h)
        .attr("rx", 4);
      g.append("text")
        .attr("class", "tourdino-value")
        .attr("x", x + 60)
        .attr("y", plotH - h - 12)
        .attr("text-anchor", "middle")
        .text(percent(group.share));
      g.append("text")
        .attr("class", "tourdino-tick")
        .attr("x", x + 60)
        .attr("y", plotH + 30)
        .attr("text-anchor", "middle")
        .text(group.name);
      g.append("text")
        .attr("class", "tourdino-tick is-faint")
        .attr("x", x + 60)
        .attr("y", plotH + 56)
        .attr("text-anchor", "middle")
        .text(`n = ${group.n}`);
    });
    // The verdict, shown on the first click
    const verdict = g.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
    const real = panel.data.p < 0.05;
    verdict
      .append("text")
      .attr("class", `tourdino-verdict ${real ? "is-real" : "is-not"}`)
      .attr("x", panelW / 2)
      .attr("y", plotH + 120)
      .attr("text-anchor", "middle")
      .text(formatP(panel.data.p));
    verdict
      .append("text")
      .attr("class", "tourdino-subtitle")
      .attr("x", panelW / 2)
      .attr("y", plotH + 154)
      .attr("text-anchor", "middle")
      .text(real ? "chi-squared test: the difference holds up" : "chi-squared test: it does not");
  });
}

register("tourdino-lookalike", renderLookalike);

// The test decision tree

const TREE = {
  root: { x: 750, y: 50, text: "What do you want to compare?" },
  level1: [
    { id: "attributes", x: 400, y: 190, edge: "Attributes", text: "Which attribute types?" },
    { id: "items", x: 1100, y: 190, edge: "Items", text: "Which value type?" },
  ],
  leaves: [
    {
      parent: "attributes",
      x: 160,
      edge: "numerical, numerical",
      test: ["Spearman", "correlation"],
      glyph: "scatter",
    },
    {
      parent: "attributes",
      x: 400,
      edge: "categorical, numerical",
      test: ["Kolmogorov-", "Smirnov test"],
      glyph: "ks",
    },
    {
      parent: "attributes",
      x: 640,
      edge: "categorical, categorical",
      test: ["Pearson's", "chi-squared test"],
      glyph: "sets",
    },
    {
      parent: "items",
      x: 960,
      edge: "categorical",
      test: ["Pearson's", "chi-squared test"],
      glyph: "bars",
    },
    {
      parent: "items",
      x: 1260,
      edge: "numerical",
      test: ["Wilcoxon", "rank-sum test"],
      glyph: "box",
    },
  ],
};

/** The explanatory chart each leaf produces, as a small glyph. */
function glyph(g, kind, palette) {
  const w = 120;
  const h = 80;
  g.append("line")
    .attr("class", "tourdino-glyph-axis")
    .attr("x1", 0)
    .attr("x2", w)
    .attr("y1", h)
    .attr("y2", h);
  g.append("line")
    .attr("class", "tourdino-glyph-axis")
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", 0)
    .attr("y2", h);
  const color = palette.cohorts[0];
  if (kind === "scatter") {
    const pts = [
      [10, 70],
      [22, 55],
      [30, 62],
      [40, 44],
      [52, 50],
      [60, 30],
      [72, 38],
      [84, 22],
      [96, 28],
      [108, 12],
    ];
    g.selectAll("circle")
      .data(pts)
      .join("circle")
      .attr("cx", (d) => d[0])
      .attr("cy", (d) => d[1])
      .attr("r", 4)
      .style("fill", color);
  } else if (kind === "ks") {
    g.append("line")
      .attr("class", "tourdino-glyph-axis")
      .attr("x1", 0)
      .attr("x2", w)
      .attr("y1", h / 2)
      .attr("y2", h / 2);
    g.append("path")
      .attr("class", "tourdino-glyph-line")
      .attr("d", "M 0 40 L 15 50 L 30 44 L 45 56 L 60 36 L 75 30 L 90 14 L 105 26 L 120 40")
      .style("stroke", color);
  } else if (kind === "sets") {
    g.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", w)
      .attr("height", h)
      .attr("class", "tourdino-glyph-fill");
    g.append("path").attr("d", `M 0 0 L ${w} 0 L ${w} 22 L 0 30 Z`).style("fill", color);
    g.append("path")
      .attr("d", `M 0 40 L ${w} 54 L ${w} 66 L 0 50 Z`)
      .style("fill", color)
      .style("opacity", 0.6);
  } else if (kind === "bars") {
    const vals = [0.55, 0.3, 0.45, 0.35, 0.8, 0.2];
    vals.forEach((v, i) => {
      g.append("rect")
        .attr("x", 6 + i * 19)
        .attr("y", h - v * h)
        .attr("width", 14)
        .attr("height", v * h)
        .attr("rx", 3)
        .style("fill", i % 2 ? palette.faint : color);
    });
  } else if (kind === "box") {
    const box = (x, lo, q1, med, q3, hi) => {
      g.append("line")
        .attr("class", "tourdino-glyph-line")
        .attr("x1", x)
        .attr("x2", x)
        .attr("y1", lo)
        .attr("y2", hi)
        .style("stroke", color);
      g.append("rect")
        .attr("x", x - 14)
        .attr("y", q3)
        .attr("width", 28)
        .attr("height", q1 - q3)
        .attr("class", "tourdino-glyph-box")
        .style("stroke", color);
      g.append("line")
        .attr("class", "tourdino-glyph-line")
        .attr("x1", x - 14)
        .attr("x2", x + 14)
        .attr("y1", med)
        .attr("y2", med)
        .style("stroke", color);
    };
    box(38, 72, 60, 42, 26, 8);
    box(86, 76, 66, 54, 40, 22);
  }
}

function renderTree(el, { palette }) {
  const W = 1500;
  // Tall enough for the tree and its chart glyphs
  const H = 480;
  const svg = svgFor(
    el,
    W,
    H,
    "tourdino-tree",
    "The decision tree: the task and the data types pick the test, and the same branch picks the chart",
  );

  const edges = svg.append("g");
  const nodes = svg.append("g");

  const edge = (from, to, label) => {
    edges
      .append("path")
      .attr("class", "tourdino-edge")
      .attr(
        "d",
        `M ${from.x} ${from.y + 18} C ${from.x} ${(from.y + to.y) / 2} ${to.x} ${(from.y + to.y) / 2} ${to.x} ${to.y - 64}`,
      );
    nodes
      .append("text")
      .attr("class", "tourdino-edge-label")
      .attr("x", to.x)
      .attr("y", to.y - 36)
      .attr("text-anchor", "middle")
      .text(label);
  };

  nodes
    .append("text")
    .attr("class", "tourdino-node")
    .attr("x", TREE.root.x)
    .attr("y", TREE.root.y)
    .attr("text-anchor", "middle")
    .text(TREE.root.text);
  for (const n of TREE.level1) {
    edge(TREE.root, n, n.edge);
    nodes
      .append("text")
      .attr("class", "tourdino-node")
      .attr("x", n.x)
      .attr("y", n.y)
      .attr("text-anchor", "middle")
      .text(n.text);
  }
  TREE.leaves.forEach((leaf) => {
    const parent = TREE.level1.find((n) => n.id === leaf.parent);
    const to = { x: leaf.x, y: 300 };
    edge(parent, to, leaf.edge);
    const t = nodes
      .append("text")
      .attr("class", "tourdino-test")
      .attr("x", leaf.x)
      .attr("y", 300)
      .attr("text-anchor", "middle");
    t.selectAll("tspan")
      .data(leaf.test)
      .join("tspan")
      .attr("x", leaf.x)
      .attr("dy", (d, j) => (j ? 30 : 0))
      .text((d) => d);
    const gl = nodes
      .append("g")
      .attr("class", "tourdino-glyph")
      .attr("transform", `translate(${leaf.x - 60} 360)`);
    glyph(gl, leaf.glyph, palette);
  });
}

register("tourdino-tree", renderTree);

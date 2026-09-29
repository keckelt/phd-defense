import { scaleLinear, select } from "d3";

import importance from "../../data/importance.json";
import { operationSquare } from "./coral.js";
import { cohortRows, embeddingRows } from "./data.js";
import { register } from "./registry.js";
import { rule } from "./tokens.js";

/** Kokiri charts: marker pairs, marker ranking and the selection bias chain. */

const PANEL_W = 700;
const H = 560;

const GROUPS = [
  { key: "A1", color: 2 },
  { key: "A2", color: 3 },
];

// Test statistics; shares are rechecked against the data below
const TESTS = {
  ATM: { shares: { A1: 48.0, A2: 42.5 }, p: "p = 0.30", verdict: "not significant" },
  NF1: { shares: { A1: 53.0, A2: 45.0 }, p: "p = 0.13", verdict: "not significant" },
  "ATM+NF1": { shares: { A1: 34.5, A2: 6.2 }, p: "p = 1.2e-10", verdict: "chi-squared 41.4" },
};

let members = null;

/** Patients of A1 and A2 with their markers, cached. */
function groupRows() {
  if (members) return members;
  const truth = new Map(embeddingRows().map((r) => [r.patient_id, r.subgroup_truth]));
  members = cohortRows()
    .map((r) => ({ ...r, group: truth.get(r.patient_id) }))
    .filter((r) => r.group === "A1" || r.group === "A2");
  return members;
}

/** Percent of a group where every listed marker is mutated. */
function mutatedShare(group, markers) {
  const rows = groupRows().filter((r) => r.group === group);
  const hits = rows.filter((r) => markers.every((m) => r[m] === "mutated")).length;
  return (100 * hits) / rows.length;
}

function panel(svg, x0, width, spec, colors, index) {
  const markers = spec.split("+");
  const title = markers.length > 1 ? `${markers.join(" and ")} both mutated` : `${spec} mutated`;
  // The first panel is there from the start; each further one is a click
  const g = svg
    .append("g")
    .attr("class", index ? "kok-panel fragment" : "kok-panel")
    .attr("data-fragment-index", index ? index - 1 : null)
    .attr("transform", `translate(${x0} 0)`);
  g.append("text")
    .attr("class", "kok-title")
    .attr("x", width / 2)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .text(title);

  const plotTop = 90;
  const plotH = 330;
  const y = scaleLinear()
    .domain([0, 60])
    .range([plotTop + plotH, plotTop]);
  const barW = Math.min(150, width / 3.2);
  const gap = 28;
  const x0bar = width / 2 - barW - gap / 2;

  g.append("line")
    .attr("class", "kok-baseline")
    .attr("x1", x0bar - 30)
    .attr("x2", x0bar + 2 * barW + gap + 30)
    .attr("y1", y(0))
    .attr("y2", y(0));

  GROUPS.forEach((group, i) => {
    const share = TESTS[spec].shares[group.key];
    const measured = mutatedShare(group.key, markers);
    if (Math.abs(measured - share) > 0.1) {
      console.warn(
        `Share of ${spec} in ${group.key}: report says ${share}, data gives ${measured}`,
      );
    }
    const x = x0bar + i * (barW + gap);
    g.append("rect")
      .attr("class", "kok-bar")
      .attr("x", x)
      .attr("y", y(share))
      .attr("width", barW)
      .attr("height", y(0) - y(share))
      .attr("rx", 4)
      .attr("fill", colors.cohorts[group.color]);
    g.append("text")
      .attr("class", "kok-value")
      .attr("x", x + barW / 2)
      .attr("y", y(share) - 14)
      .attr("text-anchor", "middle")
      .text(`${share.toFixed(1)}%`);
    g.append("text")
      .attr("class", "kok-group")
      .attr("x", x + barW / 2)
      .attr("y", y(0) + 36)
      .attr("text-anchor", "middle")
      .text(group.key);
  });

  const test = TESTS[spec];
  const verdict = g
    .append("g")
    .attr("class", markers.length > 1 ? "kok-verdict is-hit" : "kok-verdict");
  verdict
    .append("text")
    .attr("class", "kok-p")
    .attr("x", width / 2)
    .attr("y", H - 60)
    .attr("text-anchor", "middle")
    .text(test.p);
  verdict
    .append("text")
    .attr("class", "kok-verdict-text")
    .attr("x", width / 2)
    .attr("y", H - 22)
    .attr("text-anchor", "middle")
    .text(test.verdict);
}

function markerPairs(el, { palette: colors }) {
  const specs = (el.dataset.markers ?? "ATM,NF1").split(",");
  const svg = select(el)
    .append("svg")
    .attr("class", `kok-chart kok-panels-${specs.length}`)
    .attr("viewBox", `0 0 ${PANEL_W * specs.length} ${H}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      `Share of mutated patients in A1 and A2 for ${specs.join(" and ")}, with the test result`,
    );
  specs.forEach((spec, i) => panel(svg, i * PANEL_W, PANEL_W, spec, colors, i));
}

register("marker-pairs", markerPairs);

/** Marker ranking: MET ranks high because it is often missing. */

// Expected MET shares, checked against the data
const MET_REPORT = {
  unknownByGroup: { A1: 17.0, A2: 37.5 },
  unknownByCenter: { C1: 13.5, C2: 10.7, C3: 63.4 },
  c3ShareOfA2: 50.0,
};

const CENTERS = ["C1", "C2", "C3"];
const PAIRING = new Set(["ATM", "NF1"]);

function checkShare(label, measured, reported) {
  if (Math.abs(measured - reported) > 0.1) {
    console.warn(`${label}: report says ${reported}, data gives ${measured.toFixed(1)}`);
  }
}

/** Percent of rows where MET is unknown. */
function unknownShare(rows) {
  return (100 * rows.filter((r) => r.MET === "unknown").length) / rows.length;
}

/** The ranked list of markers, top rows only. */
function rankingList(g, ranking, top, width, colors, { highlight }) {
  const rows = ranking.slice(0, top);
  const rowH = 54;
  // Room for the longest gene name, SMARCA4
  const labelW = 150;
  const x = scaleLinear()
    .domain([0, rows[0].importance])
    .range([0, width - labelW - 40]);

  rows.forEach((r, i) => {
    const y = i * rowH;
    const row = g.append("g").attr("transform", `translate(0 ${y})`);
    const kind = r.marker === highlight ? "is-artifact" : PAIRING.has(r.marker) ? "is-pairing" : "";
    row
      .append("text")
      .attr("class", `kok-rank ${kind}`)
      .attr("x", 0)
      .attr("y", rowH / 2 + 9)
      .text(r.rank);
    row
      .append("text")
      .attr("class", `kok-marker ${kind}`)
      .attr("x", 38)
      .attr("y", rowH / 2 + 9)
      .text(r.marker);
    row
      .append("rect")
      .attr("class", `kok-rank-bar ${kind}`)
      .attr("x", labelW + 30)
      .attr("y", 12)
      .attr("width", x(r.importance))
      .attr("height", rowH - 24)
      .attr("rx", 3)
      .attr(
        "fill",
        r.marker === highlight
          ? colors.accent
          : PAIRING.has(r.marker)
            ? colors.heading
            : colors.faint,
      );
  });
  return { rowH, labelW };
}

/** A row of horizontal bars with a direct label and a percent at the end. */
function shareBars(g, items, width, colors, { big }) {
  const rowH = 64;
  const labelW = 70;
  const x = scaleLinear()
    .domain([0, 100])
    .range([0, width - labelW - 120]);
  items.forEach((item, i) => {
    const y = i * rowH;
    g.append("text")
      .attr("class", "kok-share-label")
      .attr("x", 0)
      .attr("y", y + rowH / 2 + 9)
      .text(item.label);
    g.append("rect")
      .attr("class", "kok-share-track")
      .attr("x", labelW)
      .attr("y", y + 14)
      .attr("width", x(100))
      .attr("height", rowH - 28)
      .attr("rx", 3)
      .attr("fill", rule(0.08));
    g.append("rect")
      .attr("x", labelW)
      .attr("y", y + 14)
      .attr("width", x(item.value))
      .attr("height", rowH - 28)
      .attr("rx", 3)
      .attr("fill", item.color ?? colors.accent);
    g.append("text")
      .attr("class", `kok-share-value ${item.key === big ? "is-big" : ""}`)
      .attr("x", labelW + x(item.value) + 14)
      .attr("y", y + rowH / 2 + (item.key === big ? 12 : 9))
      .text(`${item.value.toFixed(1)}%`);
  });
}

function markerRanking(el, { palette: colors }) {
  const W = 1500;
  const H = 640;
  const top = importance.top;
  const svg = select(el)
    .append("svg")
    .attr("class", "kok-chart kok-ranking")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      "How Kokiri ranks the markers, the eight markers that separate A1 from A2 by Gini importance, and the distribution of MET by group and by treatment center",
    );

  // Left: the ranking as Kokiri shows it
  const left = svg.append("g").attr("transform", "translate(40 0)");
  left.append("text").attr("class", "kok-title").attr("x", 0).attr("y", 40).text("Markers, ranked");
  left
    .append("text")
    .attr("class", "kok-subtitle")
    .attr("x", 0)
    .attr("y", 76)
    .text("Gini importance, A1 against A2, before any imputation");
  // Two lines on how the ranking is made, shown before the bars
  [
    "1 · A random forest learns to tell A1 from A2.",
    "2 · Markers are scored by how much they help the trees.",
  ].forEach((line, i) => {
    left
      .append("text")
      .attr("class", "kok-how")
      .attr("x", 0)
      .attr("y", 112 + i * 30)
      .text(line);
  });
  const ranked = left.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  const list = ranked.append("g").attr("transform", "translate(0 170)");
  const { rowH, labelW } = rankingList(list, importance.before, top, 560, colors, {
    highlight: importance.imputed,
  });

  // Bracket label on the marker pair
  const pairingRows = importance.before.filter((r) => PAIRING.has(r.marker) && r.rank <= top);
  if (pairingRows.length) {
    const y0 = 170 + (Math.min(...pairingRows.map((r) => r.rank)) - 1) * rowH;
    const y1 = 170 + Math.max(...pairingRows.map((r) => r.rank)) * rowH;
    ranked
      .append("path")
      .attr("class", "kok-bracket")
      .attr("d", `M ${labelW + 16} ${y0 + 8} h -8 V ${y1 - 8} h 8`);
    const longest = Math.max(...pairingRows.map((r) => r.importance));
    const barEnd = labelW + 30 + (560 - labelW - 40) * (longest / importance.before[0].importance);
    ranked
      .append("text")
      .attr("class", "kok-note")
      .attr("x", barEnd + 20)
      .attr("y", (y0 + y1) / 2 + 9)
      .text("the pairing");
  }

  // Right: the distribution behind the MET rank, in two steps
  const right = svg.append("g").attr("transform", "translate(720 0)");
  const groups = groupRows();
  const byGroup = GROUPS.map((group) => {
    const value = unknownShare(groups.filter((r) => r.group === group.key));
    checkShare(`MET unknown in ${group.key}`, value, MET_REPORT.unknownByGroup[group.key]);
    return { key: group.key, label: group.key, value, color: colors.cohorts[group.color] };
  });
  const step1 = right.append("g").attr("class", "fragment").attr("data-fragment-index", 1);
  step1
    .append("text")
    .attr("class", "kok-title")
    .attr("x", 0)
    .attr("y", 40)
    .text("Behind the rank: MET is unknown for");
  shareBars(step1.append("g").attr("transform", "translate(0 70)"), byGroup, 740, colors, {
    big: null,
  });
  step1
    .append("text")
    .attr("class", "kok-note")
    .attr("x", 0)
    .attr("y", 70 + 2 * 64 + 26)
    .text("Not mutated more often. Recorded less often.");

  const byCenter = CENTERS.map((center) => {
    const value = unknownShare(cohortRows().filter((r) => r.center === center));
    checkShare(`MET unknown at ${center}`, value, MET_REPORT.unknownByCenter[center]);
    return { key: center, label: center, value, color: colors.muted };
  });
  const c3InA2 =
    (100 * groups.filter((r) => r.group === "A2" && r.center === "C3").length) /
    groups.filter((r) => r.group === "A2").length;
  checkShare("C3 share of A2", c3InA2, MET_REPORT.c3ShareOfA2);
  const step2 = right
    .append("g")
    .attr("class", "fragment")
    .attr("data-fragment-index", 2)
    .attr("transform", "translate(0 300)");
  step2
    .append("text")
    .attr("class", "kok-title")
    .attr("x", 0)
    .attr("y", 40)
    .text("Unknown depends on the treatment center");
  shareBars(step2.append("g").attr("transform", "translate(0 70)"), byCenter, 740, colors, {
    big: "C3",
  });
  step2
    .append("text")
    .attr("class", "kok-note is-artifact")
    .attr("x", 0)
    .attr("y", 70 + 3 * 64 + 26)
    .text(`C3 treats ${Math.round(c3InA2)}% of A2, and the marker is not biology`);
}

register("marker-ranking", markerRanking);

/** Selection bias as a chain: every selection brings something along. */

function meanAge(rows) {
  return rows.reduce((s, r) => s + r.age, 0) / rows.length;
}

/** Mean age before and after the KRAS filter, one dumbbell per tumor type. */
function thumbAgeShift(g, w, h, colors) {
  const rows = [0, 1].map((i) => {
    const tumor = i ? "Type B" : "Type A";
    const group = cohortRows().filter((r) => r.tumor_type === tumor);
    return {
      label: tumor,
      before: meanAge(group),
      after: meanAge(group.filter((r) => r.KRAS === "mutated")),
      color: colors.cohorts[i],
    };
  });
  const x = scaleLinear()
    .domain([54, 68])
    .range([110, w - 70]);
  const rowH = h / 2;
  rows.forEach((row, i) => {
    const y = i * rowH + rowH / 2;
    g.append("text")
      .attr("class", "kok-thumb-label")
      .attr("x", 0)
      .attr("y", y + 7)
      .text(row.label);
    g.append("line")
      .attr("class", "kok-shift")
      .attr("x1", x(row.before))
      .attr("x2", x(row.after))
      .attr("y1", y)
      .attr("y2", y)
      .attr("stroke", row.color);
    g.append("circle")
      .attr("class", "kok-shift-before")
      .attr("cx", x(row.before))
      .attr("cy", y)
      .attr("r", 9)
      .attr("stroke", row.color);
    g.append("circle").attr("cx", x(row.after)).attr("cy", y).attr("r", 11).attr("fill", row.color);
    g.append("text")
      .attr("class", "kok-thumb-label")
      .attr("x", x(row.before) - 16)
      .attr("y", y + 7)
      .attr("text-anchor", "end")
      .text(row.before.toFixed(1));
    g.append("text")
      .attr("class", "kok-thumb-label")
      .attr("x", x(row.after) + 20)
      .attr("y", y + 7)
      .text(row.after.toFixed(1));
  });
}

/** Two bars, A1 against A2, on a 0 to 100 percent scale. */
function groupBars(g, w, h, colors, value) {
  const x = scaleLinear()
    .domain([0, 100])
    .range([0, w - 130]);
  const rowH = h / 2;
  GROUPS.forEach((group, i) => {
    const members = groupRows().filter((r) => r.group === group.key);
    const v = value(members);
    g.append("text")
      .attr("class", "kok-thumb-label")
      .attr("x", 0)
      .attr("y", i * rowH + rowH / 2 + 7)
      .text(group.key);
    g.append("rect")
      .attr("x", 44)
      .attr("y", i * rowH + 12)
      .attr("width", x(v))
      .attr("height", rowH - 24)
      .attr("rx", 3)
      .attr("fill", colors.cohorts[group.color]);
    g.append("text")
      .attr("class", "kok-thumb-label")
      .attr("x", 44 + x(v) + 10)
      .attr("y", i * rowH + rowH / 2 + 7)
      .text(`${v.toFixed(1)}%`);
  });
}

/** A1 and A2 on the projection, at its own aspect ratio, labels beside the clusters. */
function thumbClusters(g, w, h, colors) {
  // Type B stays as faint context
  const pts = embeddingRows().map((r) => ({ ...r, group: r.subgroup_truth }));
  const [x0, x1] = [Math.min(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x))];
  const [y0, y1] = [Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y))];
  const k = Math.min((w - 90) / (x1 - x0), (h - 12) / (y1 - y0));
  const x = (v) => 60 + (v - x0) * k;
  const y = (v) => h - 6 - (v - y0) * k;
  const color = { A1: colors.cohorts[2], A2: colors.cohorts[3] };
  g.selectAll("circle")
    .data(pts)
    .join("circle")
    .attr("cx", (p) => x(p.x))
    .attr("cy", (p) => y(p.y))
    .attr("r", 3.5)
    .attr("fill", (p) => color[p.group] ?? colors.faint)
    .attr("opacity", (p) => (color[p.group] ? 0.8 : 0.3));
  for (const key of ["A1", "A2"]) {
    const own = pts.filter((p) => p.group === key);
    const cx = own.reduce((s, p) => s + x(p.x), 0) / own.length;
    const cy = own.reduce((s, p) => s + y(p.y), 0) / own.length;
    g.append("text")
      .attr("class", "kok-thumb-label")
      .attr("x", cx - 30)
      .attr("y", cy + 7)
      .attr("text-anchor", "end")
      .text(key);
  }
}

function biasScopes(el, { palette: colors }) {
  const W = 1500;
  const H = 620;
  const colW = 420;
  const colX = [0, 540, 1080];
  const rowY = [0, 300];
  const thumbH = 150;
  const svg = select(el)
    .append("svg")
    .attr("class", "kok-chart kok-scopes")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      "Every selection brings something along: filtering on KRAS moves age; splitting by the projection brings treatment center C3 along, and with it, MET unknown",
    );

  const c3 = (rows) => (100 * rows.filter((r) => r.center === "C3").length) / rows.length;
  const cells = [
    {
      row: 0,
      col: 0,
      step: 0,
      tool: "Coral",
      title: "We filter by attribute",
      detail: "keep KRAS mutated",
      draw: (g) => {
        operationSquare(g, { x: 0, y: 30, kind: "filter", label: "", size: 60 });
        g.append("text")
          .attr("class", "kok-subtitle")
          .attr("x", 84)
          .attr("y", 68)
          .text("in Type A and Type B");
      },
    },
    {
      row: 0,
      col: 1,
      step: 0,
      title: "Age comes along",
      detail: "mean age, before and after",
      draw: (g) => thumbAgeShift(g, colW, thumbH, colors),
    },
    {
      row: 1,
      col: 0,
      step: 1,
      tool: "Embeddings",
      title: "We split by structure",
      detail: "A1 and A2 from the projection",
      draw: (g) => thumbClusters(g, colW, thumbH + 40, colors),
    },
    {
      row: 1,
      col: 1,
      step: 1,
      title: "C3 comes along",
      detail: "share treated at treatment center C3",
      draw: (g) => groupBars(g, colW, thumbH, colors, c3),
    },
    {
      row: 1,
      col: 2,
      step: 2,
      tool: "Kokiri",
      title: "So does its data",
      detail: "share with MET unknown",
      draw: (g) => groupBars(g, colW, thumbH, colors, unknownShare),
    },
  ];

  for (const cell of cells) {
    const g = svg
      .append("g")
      .attr("class", "fragment")
      .attr("data-fragment-index", cell.step)
      .attr("transform", `translate(${colX[cell.col]} ${rowY[cell.row]})`);
    if (cell.tool)
      g.append("text").attr("class", "kok-tool").attr("x", 0).attr("y", 26).text(cell.tool);
    g.append("text").attr("class", "kok-title").attr("x", 0).attr("y", 66).text(cell.title);
    g.append("text").attr("class", "kok-subtitle").attr("x", 0).attr("y", 100).text(cell.detail);
    cell.draw(g.append("g").attr("transform", "translate(0 118)"));
    // Arrow from the previous cell in the row
    if (cell.col > 0) {
      g.append("text")
        .attr("class", "kok-arrow")
        .attr("x", -60)
        .attr("y", 118 + thumbH / 2 + 16)
        .attr("text-anchor", "middle")
        .text("→");
    }
  }
}

register("bias-scopes", biasScopes);

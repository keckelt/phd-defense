import { select } from "d3";

import { register } from "./registry.js";

// Appendix diagrams: multiple testing and false discovery rates

register("multiple-testing", (el) => {
  const W = 1400;
  const H = 470;
  const svg = select(el)
    .append("svg")
    .attr("class", "mt-diagram")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img");

  const captionY = 80 + 5 * 60 + 44;
  function caption(g, cls, lines) {
    g.selectAll(`text.${cls}`)
      .data(lines)
      .join("text")
      .attr("class", `mt-caption ${cls}`)
      .attr("y", (d, i) => captionY + i * 34)
      .text((d) => d);
  }

  // Left: the matrix
  const matrix = svg.append("g").attr("transform", "translate(60 0)");
  matrix.append("text").attr("class", "mt-title").attr("y", 44).text("Parallel tests in a matrix");
  const n = 5;
  const cell = 54;
  const gap = 6;
  const cells = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) cells.push({ i, j, hit: (i * 7 + j * 3) % 5 === 0 });
  matrix
    .append("g")
    .attr("transform", "translate(0 80)")
    .selectAll("rect")
    .data(cells)
    .join("rect")
    .attr("class", (d) => `mt-cell ${d.hit ? "is-hit" : ""}`)
    .attr("x", (d) => d.j * (cell + gap))
    .attr("y", (d) => d.i * (cell + gap))
    .attr("width", cell)
    .attr("height", cell)
    .attr("rx", 4);
  caption(matrix, "mt-caption-good", ["One place, one count.", "Correctable: Bonferroni, FDR."]);

  // Right: the session before the matrix
  const session = svg.append("g").attr("transform", "translate(560 0)");
  session
    .append("text")
    .attr("class", "mt-title")
    .attr("y", 44)
    .text("The looks taken before the matrix was opened");
  const looks = 9;
  const step = 86;
  const y = 160;
  session
    .append("line")
    .attr("class", "mt-timeline")
    .attr("x1", 0)
    .attr("x2", (looks - 1) * step + 60)
    .attr("y1", y + 40)
    .attr("y2", y + 40);
  const look = session
    .selectAll("g.mt-look")
    .data(Array.from({ length: looks }, (_, i) => i))
    .join("g")
    .attr("class", "mt-look")
    .attr("transform", (i) => `translate(${i * step} ${y - 30})`);
  // Each look is a tiny chart the analyst glanced at and moved on from
  look
    .append("rect")
    .attr("class", "mt-look-frame")
    .attr("width", 60)
    .attr("height", 56)
    .attr("rx", 4);
  look
    .selectAll("rect.mt-look-bar")
    .data((i) => [0.5, 0.9, 0.35, 0.7].map((v, k) => ({ v: ((v * (i + 3)) % 1) * 0.8 + 0.15, k })))
    .join("rect")
    .attr("class", "mt-look-bar")
    .attr("x", (d) => 8 + d.k * 12)
    .attr("y", (d) => 50 - d.v * 40)
    .attr("width", 8)
    .attr("height", (d) => d.v * 40);
  session
    .append("text")
    .attr("class", "mt-more")
    .attr("x", looks * step - 10)
    .attr("y", y + 12)
    .text("…");
  caption(session, "mt-caption-bad", [
    "Across sessions, uncounted.",
    "Uncorrected, and still open.",
  ]);
});

// False discovery rates by confirmation strategy (Zgraggen et al., CHI 2018)

const STRATEGIES = [
  { label: "No confirmation", rate: 0.75, text: "about 75%", lead: true },
  { label: "Confirmed on the same data", rate: 0.11, text: "11%" },
  { label: "Looks tracked, p-values adjusted", rate: 0.06, text: "6%" },
  { label: "Confirmed on held-out data", rate: 0.046, text: "4.6%" },
];

register("false-discoveries", (el) => {
  const W = 1400;
  const rowH = 96;
  const top = 70;
  const H = top + STRATEGIES.length * rowH + 20;
  const labelW = 520;
  const barW = 700;
  const svg = select(el)
    .append("svg")
    .attr("class", "mt-diagram fd-chart")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      "False discovery rate by confirmation strategy: about 75% without confirmation, 11% on the same data, 6% with tracked and adjusted looks, 4.6% on held-out data",
    );

  svg
    .append("text")
    .attr("class", "mt-caption mt-caption-good")
    .attr("x", labelW)
    .attr("y", 34)
    .text("Share of the reported insights that were false discoveries");

  const row = svg
    .selectAll("g.fd-row")
    .data(STRATEGIES)
    .join("g")
    .attr("class", "fd-row")
    .attr("transform", (d, i) => `translate(0 ${top + i * rowH})`);
  row
    .append("text")
    .attr("class", "fd-label")
    .attr("x", labelW - 24)
    .attr("y", 44)
    .attr("text-anchor", "end")
    .text((d) => d.label);
  row
    .append("rect")
    .attr("class", "fd-track")
    .attr("x", labelW)
    .attr("y", 14)
    .attr("width", barW)
    .attr("height", 44)
    .attr("rx", 4);
  row
    .append("rect")
    .attr("class", (d) => `fd-bar ${d.lead ? "is-lead" : ""}`)
    .attr("x", labelW)
    .attr("y", 14)
    .attr("width", (d) => d.rate * barW)
    .attr("height", 44)
    .attr("rx", 4);
  row
    .append("text")
    .attr("class", (d) => `fd-value ${d.lead ? "is-lead" : ""}`)
    .attr("x", (d) => labelW + d.rate * barW + 16)
    .attr("y", 46)
    .text((d) => d.text);
});

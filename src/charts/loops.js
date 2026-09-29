import { scaleLinear, select } from "d3";

import importance from "../../data/importance.json";
import { register } from "./registry.js";
import { rule } from "./tokens.js";

/** Ranking before and after imputing MET, as a slope chart in Loops' difference colors. */

const PAIRING = new Set(["ATM", "NF1"]);

function rankingShift(el, { palette: colors }) {
  const W = 1400;
  const H = 700;
  const top = importance.top;
  const rowH = 58;
  const colX = { before: 220, after: W - 220 };
  const top0 = 120;
  const y = (rank) => top0 + (rank - 1) * rowH;
  const outY = y(top + 1) + 16;

  const before = importance.before.slice(0, top);
  const after = importance.after.slice(0, top);
  const rankBefore = new Map(importance.before.map((r) => [r.marker, r.rank]));
  const rankAfter = new Map(importance.after.map((r) => [r.marker, r.rank]));
  const diffColor = (marker) => {
    const a = rankBefore.get(marker);
    const b = rankAfter.get(marker);
    if (a <= top && b > top) return colors.diff.del;
    if (a > top && b <= top) return colors.diff.add;
    if (a !== b) return colors.diff.change;
    return colors.faint;
  };

  const svg = select(el)
    .append("svg")
    .attr("class", "loops-chart")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("role", "img")
    .attr(
      "aria-label",
      `Top ${top} markers before and after imputing ${importance.imputed}: ${importance.imputed} leaves the ranking, the pairing stays on top`,
    );

  const x = scaleLinear().domain([0, before[0].importance]).range([0, 150]);

  function column(key, rows, xc, align) {
    const g = svg.append("g").attr("class", `loops-col loops-col-${key}`);
    g.append("text")
      .attr("class", "loops-version")
      .attr("x", xc)
      .attr("y", 44)
      .attr("text-anchor", "middle")
      .text(key === "before" ? "Version 1" : "Version 2");
    g.append("text")
      .attr("class", "loops-version-sub")
      .attr("x", xc)
      .attr("y", 76)
      .attr("text-anchor", "middle")
      .text(
        key === "before" ? `${importance.imputed} as recorded` : `${importance.imputed} imputed`,
      );
    rows.forEach((r) => {
      const dir = align === "right" ? -1 : 1;
      const row = g.append("g").attr("transform", `translate(${xc} ${y(r.rank)})`);
      row
        .append("rect")
        .attr("x", align === "right" ? -x(r.importance) - 100 : 100)
        .attr("y", -16)
        .attr("width", x(r.importance))
        .attr("height", 32)
        .attr("rx", 3)
        .attr("fill", PAIRING.has(r.marker) ? colors.heading : rule(0.25));
      row
        .append("text")
        .attr(
          "class",
          `loops-marker ${PAIRING.has(r.marker) ? "is-pairing" : ""} ${r.marker === importance.imputed ? "is-artifact" : ""}`,
        )
        .attr("x", 0)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .text(r.marker);
      row
        .append("text")
        .attr("class", "loops-rank")
        .attr("x", dir * -88)
        .attr("y", 9)
        .attr("text-anchor", "middle")
        .text(r.rank);
    });
    return g;
  }

  column("before", before, colX.before, "right");

  const later = svg.append("g").attr("class", "fragment").attr("data-fragment-index", 0);
  column("after", after, colX.after, "left").each(function () {
    later.node().appendChild(this);
  });

  // Where the markers that left the top go
  const gone = before.filter((r) => rankAfter.get(r.marker) > top);
  if (gone.length) {
    later
      .append("text")
      .attr("class", "loops-out")
      .attr("x", colX.after)
      .attr("y", outY + 40)
      .attr("text-anchor", "middle")
      .text(
        `out of the top ${top}: ${gone.map((r) => `${r.marker} to ${rankAfter.get(r.marker)}`).join(", ")}`,
      );
  }

  // Slopes, drawn under the labels
  const slopes = later.insert("g", ":first-child").attr("class", "loops-slopes");
  // Clear of the rank numbers, which sit beside names up to SMARCA4 long
  const x0 = colX.before + 108;
  const x1 = colX.after - 108;
  const markers = new Set([...before, ...after].map((r) => r.marker));
  for (const marker of markers) {
    const a = rankBefore.get(marker);
    const b = rankAfter.get(marker);
    const ya = a <= top ? y(a) : outY;
    const yb = b <= top ? y(b) : outY;
    slopes
      .append("path")
      .attr("d", `M ${x0} ${ya} C ${(x0 + x1) / 2} ${ya}, ${(x0 + x1) / 2} ${yb}, ${x1} ${yb}`)
      .attr("fill", "none")
      .attr("stroke", diffColor(marker))
      .attr("stroke-width", marker === importance.imputed || PAIRING.has(marker) ? 6 : 3)
      .attr("opacity", marker === importance.imputed || PAIRING.has(marker) ? 0.95 : 0.55);
  }

  // Legend in Loops' colors
  const legend = later.append("g").attr("transform", `translate(${W / 2 - 250} ${H - 16})`);
  [
    ["left the top", colors.diff.del],
    ["entered", colors.diff.add],
    ["moved", colors.diff.change],
  ].forEach(([label, color], i) => {
    const lx = i * 180;
    legend
      .append("rect")
      .attr("x", lx)
      .attr("y", -14)
      .attr("width", 26)
      .attr("height", 14)
      .attr("rx", 3)
      .attr("fill", color);
    legend
      .append("text")
      .attr("class", "loops-legend")
      .attr("x", lx + 36)
      .attr("y", -1)
      .text(label);
  });
}

register("ranking-shift", rankingShift);

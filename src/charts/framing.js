import { select } from "d3";

import { cohortRows } from "./data.js";
import { register } from "./registry.js";

// Framing diagrams: the characterize/compare moves and how the systems fit together

const svgIn = (el, w, h, cls) =>
  select(el).append("svg").attr("class", cls).attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img");

/** Share of rows whose KRAS is mutated. */
function mutatedShare(rows) {
  return rows.filter((r) => r.KRAS === "mutated").length / rows.length;
}

const pct = (v) => `${Math.round(v * 100)}%`;

register("comparison-moves", (el) => {
  const rows = cohortRows();
  const shareA = mutatedShare(rows.filter((r) => r.tumor_type === "Type A"));
  const shareB = mutatedShare(rows.filter((r) => r.tumor_type === "Type B"));
  const shareAll = mutatedShare(rows);

  const W = 1400;
  const H = 650;
  const svg = svgIn(el, W, H, "moves-diagram");

  const scale = 440; // Bar length for 100%
  const barH = 46;
  const DY = 44; // Room for the second line of each statement

  function panel(x, title, statement, fragmentIndex) {
    const g = svg.append("g").attr("transform", `translate(${x} 0)`);
    // A panel with an index enters as a whole on that click
    if (fragmentIndex !== undefined) {
      g.attr("class", "fragment").attr("data-fragment-index", fragmentIndex);
    }
    g.append("text").attr("class", "moves-title").attr("x", 0).attr("y", 48).text(title);
    g.selectAll("text.moves-statement")
      .data(statement)
      .join("text")
      .attr("class", "moves-statement")
      .attr("x", 0)
      .attr("y", (d, i) => 104 + i * DY)
      .text((d) => d);
    return g;
  }

  function caption(g, lines) {
    g.selectAll("text.moves-caption")
      .data(lines)
      .join("text")
      .attr("class", "moves-caption")
      .attr("x", 0)
      .attr("y", (d, i) => 420 + DY + i * 36)
      .text((d) => d);
  }

  function bar(g, y, share, cls, label, value) {
    const row = g.append("g").attr("class", `moves-bar ${cls}`);
    row
      .append("rect")
      .attr("x", 0)
      .attr("y", y)
      .attr("width", Math.max(6, share * scale))
      .attr("height", barH)
      .attr("rx", 4);
    row
      .append("text")
      .attr("class", "moves-bar-label")
      .attr("x", 0)
      .attr("y", y - 12)
      .text(label);
    row
      .append("text")
      .attr("class", "moves-bar-value")
      .attr("x", share * scale + 14)
      .attr("y", y + barH / 2 + 10)
      .text(value);
    return row;
  }

  // Left: characterizing a group needs the context of the group it came from
  const left = panel(40, "Characterize a group", [
    `“${pct(shareA)} of patients with tumor type A`,
    "carry a KRAS mutation.”",
  ]);
  bar(left, 176 + DY, shareA, "is-cohort-1", "Tumor type A", pct(shareA));
  const leftReveal = left.append("g").attr("class", "fragment").attr("data-fragment-index", "0");
  bar(leftReveal, 290 + DY, shareAll, "is-reference", "All patients", pct(shareAll));
  caption(leftReveal, [
    "What is this group like?",
    `${pct(shareA)} means something only next to ${pct(shareAll)}.`,
  ]);

  // Right: comparing groups asks what separates them
  const right = panel(
    740,
    "Compare groups",
    ["“KRAS is mutated more often", "in tumor type A than in tumor type B.”"],
    1,
  );
  bar(right, 176 + DY, shareA, "is-cohort-1", "Tumor type A", pct(shareA));
  bar(right, 290 + DY, shareB, "is-cohort-2", "Tumor type B", pct(shareB));
  caption(right, ["What separates these groups?", "The picture shows both sides."]);

  // The point, across both panels
  svg
    .append("g")
    .attr("class", "fragment")
    .attr("data-fragment-index", "2")
    .selectAll("text")
    .data([
      "Both are answered by looking at differences.",
      "Visualizing differences, to characterize and to compare.",
    ])
    .join("text")
    .attr("class", "moves-point")
    .attr("x", W / 2)
    .attr("y", (d, i) => 536 + DY + i * 40)
    .attr("text-anchor", "middle")
    .text((d) => d);
});

/* ------------------------------------------------------------------ */

const SYSTEMS = {
  coral: { name: "Coral", role: "Form cohorts by attribute", url: "coral.caleydoapp.org" },
  tourdino: { name: "TourDino", role: "Compare operation", url: "github.com/Caleydo/tourdino" },
  kokiri: { name: "Kokiri", role: "Characterize operation", url: "github.com/jku-vds-lab/kokiri" },
  embeddings: {
    name: "Embeddings",
    role: "Projection Space Explorer",
    url: "github.com/jku-vds-lab/projection-space-explorer",
  },
  loops: { name: "Loops", role: "JupyterLab extension", url: "github.com/jku-vds-lab/loops" },
};

function box(g, { x, y, w, h, r = 14 }, cls) {
  return g
    .append("rect")
    .attr("class", cls)
    .attr("x", x)
    .attr("y", y)
    .attr("width", w)
    .attr("height", h)
    .attr("rx", r);
}

function systemBox(g, key, geo, cls = "") {
  const s = SYSTEMS[key];
  const node = g.append("g").attr("class", `comp-system ${cls}`);
  box(node, geo, "comp-system-box");
  node
    .append("text")
    .attr("class", "comp-system-name")
    .attr("x", geo.x + 28)
    .attr("y", geo.y + 52)
    .text(s.name);
  node
    .append("text")
    .attr("class", "comp-system-role")
    .attr("x", geo.x + 28)
    .attr("y", geo.y + 88)
    .text(s.role);
  return node;
}

register("composition", (el) => {
  const W = 1400;
  const H = 545;
  const svg = svgIn(el, W, H, "comp-diagram");

  // Coral holds TourDino and Kokiri: one session
  const session = svg.append("g").attr("class", "comp-session");
  box(session, { x: 40, y: 70, w: 720, h: 330, r: 22 }, "comp-session-box");
  session
    .append("text")
    .attr("class", "comp-system-name comp-coral-name")
    .attr("x", 72)
    .attr("y", 128)
    .text("Coral");
  session
    .append("text")
    .attr("class", "comp-system-role")
    .attr("x", 72)
    .attr("y", 164)
    .text(SYSTEMS.coral.role);
  systemBox(session, "tourdino", { x: 72, y: 214, w: 320, h: 120 });
  systemBox(session, "kokiri", { x: 412, y: 214, w: 320, h: 120 });

  // Embeddings and Loops: separate applications
  const separate = svg
    .append("g")
    .attr("class", "comp-separate fragment")
    .attr("data-fragment-index", "1");
  systemBox(separate, "embeddings", { x: 860, y: 70, w: 500, h: 140 });
  systemBox(separate, "loops", { x: 860, y: 260, w: 500, h: 140 });

  // Deployment
  const deployed = svg
    .append("g")
    .attr("class", "comp-deployed fragment")
    .attr("data-fragment-index", "2");
  box(deployed, { x: 40, y: 478, w: 570, h: 44, r: 22 }, "comp-badge");
  deployed
    .append("text")
    .attr("class", "comp-badge-text")
    .attr("x", 325)
    .attr("y", 507)
    .attr("text-anchor", "middle")
    .text("Coral and TourDino: deployed at Boehringer Ingelheim");
});

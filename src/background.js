import { easeCubicInOut, select } from "d3";

import { LAYOUTS, createPoints } from "./layouts.js";

// Point cloud behind the slides, morphing to the layout named by `data-step`

const POINT_RADIUS = 5;
const TRANSITION_MS = 900;

/** Read the ambient stage of the slide that is currently showing. */
function ambientStep(slide) {
  if (!slide) return null;
  // Vertical sub-slides inherit the stage of their stack
  const owner =
    slide.closest("section[data-step]") ?? slide.parentElement?.closest?.("section[data-step]");
  const value = owner?.dataset.step;
  if (value === undefined) return null;
  const step = Number(value);
  return Object.hasOwn(LAYOUTS, step) ? step : null;
}

/** Read cloud colors from CSS so theme switches restyle it. */
function readPalette() {
  const style = getComputedStyle(document.querySelector(".reveal-viewport") ?? document.body);
  const token = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
  return {
    neutral: token("--deck-cloud-neutral", "#9aa4b2"),
    groups: [
      token("--deck-cloud-1", "#4c78a8"),
      token("--deck-cloud-2", "#f58518"),
      token("--deck-cloud-3", "#54a24b"),
      token("--deck-cloud-4", "#b279a2"),
    ],
  };
}

function colorFor(placed, palette) {
  return placed.group < 0 ? palette.neutral : palette.groups[placed.group % palette.groups.length];
}

export function initBackground(deck) {
  const printing = /print-pdf/gi.test(window.location.search);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = !printing && !reducedMotion;

  const points = createPoints();

  const layer = select(document.body)
    .insert("div", ".reveal")
    .attr("class", "deck-background")
    .attr("aria-hidden", "true");

  const svg = layer.append("svg");
  const circles = svg
    .selectAll("circle")
    .data(points)
    .join("circle")
    .attr("r", POINT_RADIUS)
    .attr("fill", readPalette().neutral);

  let size = { width: 0, height: 0 };
  let currentStep = null;

  /** Which layout the current slide wants. */
  function stateOf() {
    return { step: ambientStep(deck.getCurrentSlide()) };
  }

  function render(step, withTransition) {
    const layout = LAYOUTS[step];
    const palette = readPalette();
    const target =
      withTransition && animate
        ? circles.transition().duration(TRANSITION_MS).ease(easeCubicInOut)
        : circles.interrupt();

    target
      .attr("cx", (p) => layout(p).x * size.width)
      .attr("cy", (p) => layout(p).y * size.height)
      .attr("fill", (p) => colorFor(layout(p), palette));
  }

  function resize() {
    size = { width: window.innerWidth, height: window.innerHeight };
    svg.attr("width", size.width).attr("height", size.height);
    if (currentStep !== null) render(currentStep, false);
  }

  function update(withTransition) {
    const { step } = stateOf();
    layer.classed("is-visible", step !== null);
    if (step === null) return;
    currentStep = step;
    render(step, withTransition);
  }

  resize();
  update(false);

  deck.on("slidechanged", () => update(true));
  window.addEventListener("resize", resize);

  // Let the caller repaint after a theme switch
  return { repaint: () => update(false) };
}

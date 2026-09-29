/** Chart registry: renders every `data-chart` element with its registered function. */

import { renderers } from "./registry.js";

export { register } from "./registry.js";

function renderAll(context) {
  for (const el of document.querySelectorAll("[data-chart]")) {
    const render = renderers.get(el.dataset.chart);
    if (!render) {
      console.warn(`No chart registered for "${el.dataset.chart}"`);
      continue;
    }
    el.replaceChildren();
    try {
      render(el, context);
    } catch (error) {
      console.error(`Chart "${el.dataset.chart}" failed`, error);
    }
  }
}

/** Import every chart module and stylesheet in this directory. */
export function loadCharts() {
  import.meta.glob("./*.css", { eager: true });
  import.meta.glob(["./*.js", "!./index.js", "!./registry.js", "!./tokens.js", "!./data.js"], {
    eager: true,
  });
}

/** Restore authored fragment order and let Reveal renumber chart slides. */
function syncChartFragments(deck) {
  const slides = new Set(
    [...document.querySelectorAll("[data-chart]")].map((el) => el.closest("section")),
  );
  for (const slide of slides) {
    for (const el of slide.querySelectorAll(".fragment[data-authored-index]")) {
      el.dataset.fragmentIndex = el.dataset.authoredIndex;
    }
    deck.syncFragments(slide);
  }
}

/** Render all charts now and on every ground change. Returns a repaint hook. */
export function initCharts(deck, paletteReader) {
  const context = () => ({ deck, palette: paletteReader() });
  const render = () => {
    renderAll(context());
    syncChartFragments(deck);
  };
  render();
  return { repaint: render };
}

// Deck entry point: styles, charts, reveal setup
import "reveal.js/reset.css";
import "reveal.js/reveal.css";
import "reveal.js/theme/white.css";
import "reveal.js/plugin/highlight/monokai.css";

import "./style.css";

import Reveal from "reveal.js";
import RevealNotes from "reveal.js/plugin/notes";
import RevealSearch from "reveal.js/plugin/search";

import { initBackground } from "./background.js";
import { initCharts, loadCharts } from "./charts/index.js";
import { palette } from "./charts/tokens.js";
import { applyInitialStyle, initStylePanel } from "./theme.js";

// Set the style before reveal renders, so the first paint is already right
applyInitialStyle();

const plugins = [RevealNotes, RevealSearch];

// Register every chart module before the deck renders
loadCharts();

// Load the large highlight plugin only when the deck has code blocks
if (document.querySelector("pre code")) {
  const { default: RevealHighlight } = await import("reveal.js/plugin/highlight");
  plugins.push(RevealHighlight);
}

// Reveal renders at this fixed size and scales it to the projector
const deck = new Reveal({
  width: 1920,
  height: 1080,
  hash: true,

  // Presenter aids
  slideNumber: "c/t",
  progress: true,
  transition: "slide",
  transitionSpeed: "fast",

  // PDF export via ?print-pdf
  pdfSeparateFragments: false,
  pdfMaxPagesPerSlide: 1,

  plugins,
});

// Reveal renumbers fragments on start, before the charts add theirs; keep the authored order
for (const el of document.querySelectorAll(".reveal .fragment[data-fragment-index]")) {
  el.dataset.authoredIndex = el.dataset.fragmentIndex;
}

await deck.initialize();

// Expose the instance for the Playwright tests and the console
window.deck = deck;

const background = initBackground(deck);
const charts = initCharts(deck, palette);
initStylePanel(() => {
  background.repaint();
  charts.repaint();
});

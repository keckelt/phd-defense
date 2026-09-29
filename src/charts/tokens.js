// Chart colors read from the CSS theme tokens

function styleOf() {
  return getComputedStyle(document.querySelector(".reveal-viewport") ?? document.body);
}

/** Read one token, with a fallback outside the deck. */
export function token(name, fallback = "") {
  return styleOf().getPropertyValue(name).trim() || fallback;
}

/** The palette a chart needs, read fresh on every render. */
export function palette() {
  return {
    ink: token("--r-main-color", "#333"),
    heading: token("--r-heading-color", "#111"),
    muted: token("--deck-muted", "#666"),
    faint: token("--deck-faint", "#999"),
    accent: token("--r-link-color", "#7a2e6e"),
    background: token("--r-background-color", "#fff"),
    // Space-separated rgb triple
    rule: token("--deck-rule", "0 0 0"),
    cohorts: [1, 2, 3, 4].map((i) => token(`--deck-cohort-${i}`, "#888")),
    diff: {
      add: token("--deck-diff-add", "#66c2a5"),
      del: token("--deck-diff-del", "#f05268"),
      change: token("--deck-diff-change", "#fbe156"),
    },
  };
}

/** A rule color with alpha, from the --deck-rule triple. */
export function rule(alpha = 0.15) {
  return `rgb(${token("--deck-rule", "0 0 0")} / ${alpha})`;
}

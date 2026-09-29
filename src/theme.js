// Background color switching and its panel, opened with T

export const AXES = {
  ground: {
    label: "Ground",
    options: [
      { id: "paper", label: "Warm paper", swatch: "#fbf7f1" },
      { id: "warm", label: "Warm white", swatch: "#fdfbf7" },
      { id: "white", label: "Pure white", swatch: "#ffffff" },
      { id: "dark", label: "Dark", swatch: "#12161c" },
    ],
  },
};

const DEFAULTS = { ground: "paper" };
const STORAGE_KEY = "deck-style";

/** Storage throws in some privacy modes, so never let it break the deck. */
function readStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function store(style) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(style));
  } catch {
    // The style still applies for this session
  }
}

function valid(axis, value) {
  return AXES[axis].options.some((o) => o.id === value) ? value : null;
}

function apply(style) {
  const root = document.documentElement;
  for (const axis of Object.keys(AXES)) {
    root.dataset[axis] = style[axis];
  }
}

/** Apply the style before first paint: URL, then storage, then default. */
export function applyInitialStyle() {
  const params = new URLSearchParams(window.location.search);
  const stored = readStored();
  const style = {};
  for (const axis of Object.keys(AXES)) {
    style[axis] = valid(axis, params.get(axis)) ?? valid(axis, stored[axis]) ?? DEFAULTS[axis];
  }
  apply(style);
  return style;
}

/** Current style, read back off the document. */
function currentStyle() {
  const root = document.documentElement;
  return Object.fromEntries(Object.keys(AXES).map((axis) => [axis, root.dataset[axis]]));
}

/** A shareable URL that locks in the current combination. */
function permalink() {
  const url = new URL(window.location.href);
  for (const [axis, value] of Object.entries(currentStyle())) {
    url.searchParams.set(axis, value);
  }
  return url.toString();
}

/** Build the panel; `onChange` runs after every switch. */
export function initStylePanel(onChange) {
  if (/print-pdf/gi.test(window.location.search)) return;

  const panel = document.createElement("div");
  panel.className = "style-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="style-panel-head">
      <strong>Ground</strong>
      <span>T to close</span>
    </div>
    ${Object.entries(AXES)
      .map(
        ([axis, { label, options }]) => `
      <div class="style-row" data-axis="${axis}">
        <span class="style-row-label">${label}</span>
        <div class="style-options">
          ${options
            .map(
              (o) => `
            <button type="button" data-value="${o.id}"
              style="${o.css ? `font-family:${o.css}` : ""}">
              ${o.swatch ? `<i style="background:${o.swatch}"></i>` : ""}${o.label}
            </button>
          `,
            )
            .join("")}
        </div>
      </div>
    `,
      )
      .join("")}
    <button type="button" class="style-copy">Copy link to this combination</button>
  `;
  document.body.append(panel);

  const copyButton = panel.querySelector(".style-copy");

  function syncPressedState() {
    const style = currentStyle();
    for (const row of panel.querySelectorAll(".style-row")) {
      const chosen = style[row.dataset.axis];
      for (const button of row.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.value === chosen));
      }
    }
  }

  panel.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    const axis = button.closest(".style-row").dataset.axis;
    document.documentElement.dataset[axis] = button.dataset.value;
    store(currentStyle());
    syncPressedState();
    onChange?.(currentStyle());
  });

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(permalink());
      copyButton.textContent = "Copied";
    } catch {
      copyButton.textContent = permalink();
    }
    setTimeout(() => {
      copyButton.textContent = "Copy link to this combination";
    }, 1800);
  });

  function setOpen(open) {
    panel.hidden = !open;
    if (open) {
      syncPressedState();
    } else if (document.activeElement?.closest(".style-panel")) {
      // Leave focus behind and reveal never sees another key press
      document.activeElement.blur();
    }
  }

  function handleKey(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.matches("input, textarea, [contenteditable]")) return;

    if (event.key === "t" || event.key === "T") {
      setOpen(panel.hidden);
    } else if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
    }
  }

  // Keep panel keys from reveal, but still handle T and Escape
  panel.addEventListener("keydown", (event) => {
    event.stopPropagation();
    handleKey(event);
  });

  document.addEventListener("keydown", handleKey);

  syncPressedState();
}

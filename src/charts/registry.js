// Chart registry, kept apart from index.js to avoid a circular import

export const renderers = new Map();

/** Register the render function for a `data-chart` name. */
export function register(name, render) {
  renderers.set(name, render);
}

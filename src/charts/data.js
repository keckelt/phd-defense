// Load the example cohort data bundled with the deck
import { csvParse } from "d3";

import cohortText from "../../data/cohort.csv?raw";
import embeddingText from "../../data/embedding.csv?raw";

let cohort = null;
let embedding = null;

// The twenty markers, real gene names on made-up patients
export const MARKERS = [
  "APC",
  "ARID1A",
  "KRAS",
  "CDH1",
  "CDKN2A",
  "ERBB4",
  "ATM",
  "ERBB2",
  "FBXW7",
  "IDH1",
  "JAK2",
  "NF1",
  "NOTCH1",
  "TP53",
  "MET",
  "RB1",
  "SMAD4",
  "SMARCA4",
  "SOX2",
  "TSC2",
];

/** Cohort.csv: metadata plus the twenty markers, one row per patient. */
export function cohortRows() {
  cohort ??= csvParse(cohortText, (d) => ({ ...d, age: Number(d.age) }));
  return cohort;
}

/** Embedding.csv: the UMAP projection plus subgroup_truth. */
export function embeddingRows() {
  embedding ??= csvParse(embeddingText, (d) => ({
    patient_id: d.patient_id,
    x: Number(d.x),
    y: Number(d.y),
    subgroup_truth: d.subgroup_truth,
  }));
  return embedding;
}

/** Expression.csv, loaded lazily, with numeric E001-E200. */
export async function expressionRows() {
  const { default: text } = await import("../../data/expression.csv?raw");
  return csvParse(text, (d) => {
    const row = { patient_id: d.patient_id };
    for (const key of Object.keys(d)) if (key !== "patient_id") row[key] = Number(d[key]);
    return row;
  });
}

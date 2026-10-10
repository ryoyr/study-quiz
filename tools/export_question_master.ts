import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { questions } from "../src/data/questions.ts";

const contentVersion = process.env.CONTENT_VERSION?.trim() || "2026.10.11.1";
const updatedAt = process.env.CONTENT_UPDATED_AT?.trim() || "2026-10-11T00:00:00.000Z";
const datasetId = "lpic-101";
const datasetVersion = 1;
const root = resolve("public/content");
const datasetPath = `questions/${datasetId}.json`;

const dataset = {
  schemaVersion: 1,
  datasetId,
  version: datasetVersion,
  questions,
};
const manifest = {
  schemaVersion: 1,
  contentVersion,
  updatedAt,
  datasets: [
    {
      id: datasetId,
      version: datasetVersion,
      path: datasetPath,
      questionCount: questions.length,
    },
  ],
};

for (const [path, value] of [
  [resolve(root, "manifest.json"), manifest],
  [resolve(root, datasetPath), dataset],
] as const) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(`wrote ${path}`);
}

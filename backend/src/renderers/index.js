import path from "node:path";
import fs from "node:fs/promises";
import { renderPptx } from "./pptx.js";
import { infographicHtml } from "./infographicHtml.js";
import { advisoryToHtml } from "./advisoryHtml.js";

const DIR = path.resolve("storage/outputs");

export async function renderIfNeeded(type, content, id) {
  await fs.mkdir(DIR, { recursive: true });
  if (type === "presentation") {
    const f = `${id}.pptx`;
    await renderPptx(content, path.join(DIR, f));
    return f;
  }
  if (type === "video") {
    const f = `${id}.srt`;
    await fs.writeFile(path.join(DIR, f), content.srt || "");
    return f;
  }
  if (type === "infographic") {
    const f = `${id}.html`;
    await fs.writeFile(path.join(DIR, f), infographicHtml(content));
    return f;
  }
  if (type === "advisory") {
    const f = `${id}.html`;
    await fs.writeFile(path.join(DIR, f), advisoryToHtml(content));
    return f;
  }
  return null; // linkedin / twitter / executive_summary: JSON only (UI renders + copy button)
}

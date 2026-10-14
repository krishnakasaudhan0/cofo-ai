import pLimit from "p-limit";
import { IR } from "./schemas.js";
import { generateStructured } from "../llm/structured.js";
import { ANALYZER_SYSTEM, renderSources } from "./prompt.js";
import { chunkText } from "./chunk.js";

const Extraction = IR.pick({
  facts: true,
  entities: true,
  timeline: true,
  numbers: true,
  risks: true,
  recommendations: true
});

const Synthesis = IR.omit({
  facts: true,
  entities: true,
  timeline: true,
  numbers: true,
  risks: true,
  recommendations: true
});

export async function analyzeLong(bundle) {
  const limit = pLimit(3);
  const chunks = chunkText(renderSources(bundle));

  // MAP: extract per chunk, prefix ids to keep them unique
  const parts = await Promise.all(
    chunks.map((c, i) =>
      limit(async () => {
        const r = await generateStructured({
          purpose: `analyze:map:${i}`,
          name: "return_extraction",
          schema: Extraction,
          system: ANALYZER_SYSTEM,
          user: c,
          maxTokens: 8000,
        });
        r.facts = (r.facts || []).map((f, j) => ({ ...f, id: `c${i}f${j + 1}` }));
        return r;
      })
    )
  );

  const merged = {
    facts: parts.flatMap((p) => p.facts || []),
    entities: dedupeBy(parts.flatMap((p) => p.entities || []), (e) => (e.name || "").toLowerCase()),
    timeline: parts.flatMap((p) => p.timeline || []),
    numbers: parts.flatMap((p) => p.numbers || []),
    risks: parts.flatMap((p) => p.risks || []),
    recommendations: parts.flatMap((p) => p.recommendations || []),
    visualCandidates: [],
  };

  // REDUCE: synthesize summary/intent/keyPoints from compact facts only
  const compact = merged.facts.map((f) => `${f.id}: ${f.claim}`).join("\n");
  const synth = await generateStructured({
    purpose: "analyze:reduce",
    name: "return_synthesis",
    schema: Synthesis,
    system: ANALYZER_SYSTEM + "\nYou are given already-extracted facts. Reference them by id.",
    user: `<operator_note>${bundle.sources.filter((s) => s.source_type === "raw_text").map((s) => s.content).join("\n")}</operator_note>\n<facts>\n${compact}\n</facts>`,
    maxTokens: 8000,
  });

  return { ...synth, ...merged };
}

const dedupeBy = (arr, key) => [...new Map(arr.map((x) => [key(x), x])).values()];

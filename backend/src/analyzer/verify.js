import { cleanMarkdown } from "../ingestion/clean.js";

const norm = (s) => (s || "").toLowerCase().replace(/[\s\u00a0]+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

export function verifyFacts(ir, bundle) {
  const hay = {};
  bundle.sources.forEach((s, i) => { 
    hay[`S${i + 1}`] = norm(cleanMarkdown(s.content || '')); 
  });

  const good = [];
  const dropped = [];

  for (const f of (ir.facts || [])) {
    const haystack = hay[f.sourceId] || "";
    const needle = norm(f.sourceSpan);
    if (needle && haystack.includes(needle)) {
      good.push(f);
    } else {
      dropped.push(f);
    }
  }
  
  const ok = new Set(good.map((f) => f.id));

  // Remove dangling references
  ir.keyPoints = (ir.keyPoints || [])
    .map((k) => ({ ...k, factIds: (k.factIds || []).filter((id) => ok.has(id)) }))
    .filter((k) => k.factIds.length > 0);

  ir.visualCandidates = (ir.visualCandidates || []).map((v) => ({ 
    ...v, 
    dataFactIds: (v.dataFactIds || []).filter((id) => ok.has(id)) 
  }));

  ir.facts = good;

  return { ir, dropped };
}

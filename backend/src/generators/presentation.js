import { z } from "zod";
import { pick as p } from "./common.js";

export const schema = z.object({
  deckTitle: z.string(),
  slides: z.array(z.object({
    title: z.string().max(80),
    bullets: z.array(z.string().max(120)).min(2).max(5),
    speakerNotes: z.string(),
    visualHint: z.string().describe("chart/image/icon suggestion for this slide"),
  })).min(3).max(15),
});

export const pick = (ir) => p(ir, ["meta", "summary", "keyPoints", "facts", "numbers", "timeline", "risks", "recommendations", "visualCandidates"]);

export const instructions = `Create a professional presentation with a logical narrative arc (context → key findings → business impact → tactical actions).`;

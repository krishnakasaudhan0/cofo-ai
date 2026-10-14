import { z } from "zod";
import { pick as p } from "./common.js";

export const schema = z.object({
  headline: z.string().max(80),
  subheadline: z.string().max(140),
  keyMessage: z.string().max(160),
  layout: z.enum(["vertical_flow", "grid_2x2", "timeline", "comparison", "stat_hero"]),
  sections: z.array(z.object({
    heading: z.string().max(50),
    stat: z.string().max(40).describe("big number or key stat"),
    text: z.string().max(180),
    icon: z.string().describe("emoji or icon name"),
    chart: z.object({
      kind: z.enum(["none", "bar", "line", "pie"]).default("none"),
      labels: z.array(z.string()).default([]),
      values: z.array(z.number()).default([])
    }).optional(),
  })).min(3).max(6),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(3).max(5),
  layoutNotes: z.string(),
});

export const pick = (ir) => p(ir, ["meta", "summary", "keyPoints", "numbers", "timeline", "visualCandidates"]);

export const instructions = `Create infographic content, layout recommendation, data callouts, and key messaging. Pick layout based on data shape (e.g. "timeline", "stat_hero"). Use valid hex codes (e.g. #6366f1) for palette.`;

import { z } from "zod";
import { pick as p } from "./common.js";

export const schema = z.object({
  headline: z.string().max(100),
  bottomLine: z.string().max(300),
  keyFindings: z.array(z.string().max(200)).min(3).max(5),
  risks: z.array(z.string().max(160)).max(4),
  decisionsNeeded: z.array(z.string().max(160)).max(3),
  nextSteps: z.array(z.string().max(160)).max(4),
});

export const pick = (ir) => p(ir, ["meta", "summary", "keyPoints", "facts", "numbers", "risks", "recommendations"]);
export const instructions = `Create an executive summary for senior leadership: punchy headline, bottom-line takeaway, core findings, key risks, decisions needed and immediate next steps.`;

import { z } from "zod";
import { pick as p } from "./common.js";

export const schema = z.object({
  title: z.string(),
  advisoryId: z.string().describe("e.g. ADV-2026-001"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string(),
  background: z.string(),
  affected: z.array(z.string()),
  impact: z.string(),
  recommendedActions: z.array(z.object({
    step: z.string(),
    priority: z.enum(["immediate", "short_term", "long_term"])
  })),
  indicators: z.array(z.string()).optional().default([]),
  references: z.array(z.string()).optional().default([]),
});

export const pick = (ir) => p(ir, ["meta", "summary", "keyPoints", "facts", "risks", "recommendations", "constraints"]);

export const instructions = `Create a formal, structured technical advisory document with risk severity level, impact analysis, affected systems, and prioritized tactical recommendations.`;

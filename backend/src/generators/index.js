import { generateStructured } from "../llm/structured.js";
import { BASE_SYSTEM, paramsBlock } from "./common.js";
import * as linkedin from "./linkedin.js";
import * as twitter from "./twitter.js";
import * as executive_summary from "./executive_summary.js";
import * as advisory from "./advisory.js";
import * as presentation from "./presentation.js";
import * as video from "./video.js";
import * as infographic from "./infographic.js";

export const generators = { linkedin, twitter, executive_summary, advisory, presentation, video, infographic };

export async function runGenerator(type, ir, params, { previous, feedback } = {}) {
  const g = generators[type];
  if (!g) throw new Error(`Unknown output type: ${type}`);

  const irSlice = g.pick(ir);
  let user = `${paramsBlock(params)}\n<operator_context>${ir.operatorContext || ""}</operator_context>\n<ir>\n${JSON.stringify(irSlice)}\n</ir>\n\n${g.instructions}`;

  if (previous && feedback) {
    user += `\n\n<previous_output>${JSON.stringify(previous)}</previous_output>\n<revision_feedback>${feedback}</revision_feedback>\nRevise the previous output according to the feedback. Keep what already works.`;
  }

  const out = await generateStructured({
    purpose: `gen:${type}`,
    name: `return_${type}`,
    schema: g.schema,
    system: `${BASE_SYSTEM}\n${g.system ?? ""}`,
    user,
    maxTokens: g.maxTokens ?? 6000,
  });
  return g.post ? g.post(out, ir) : out;
}

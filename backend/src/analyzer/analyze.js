import { generateStructured } from "../llm/structured.js";
import { IR } from "./schemas.js";
import { ANALYZER_SYSTEM, renderSources } from "./prompt.js";
import { verifyFacts } from "./verify.js";
import { analyzeLong } from "./analyzeLong.js";

const SHORT_LIMIT = 40_000; // ~10k tokens

export async function analyze(bundle) {
  const rendered = renderSources(bundle);

  let ir;
  if (rendered.length <= SHORT_LIMIT) {
    ir = await generateStructured({
      purpose: "analyze",
      name: "return_ir",
      schema: IR,
      system: ANALYZER_SYSTEM,
      user: rendered,
      maxTokens: 12000,
    });
  } else {
    ir = await analyzeLong(bundle);
  }
  return verifyFacts(ir, bundle);
}

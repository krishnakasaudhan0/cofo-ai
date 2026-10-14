import { z } from "zod";
import { generateStructured } from "../llm/structured.js";

const Report = z.object({
  unsupported: z.array(z.object({
    quote: z.string().describe("the claim in the output"),
    reason: z.string(),
  })),
});

export async function faithfulness(ir, type, content) {
  try {
    const r = await generateStructured({
      purpose: "check:faithfulness",
      name: "return_report",
      schema: Report,
      maxTokens: 2000,
      system: "You audit generated content. List every factual claim (number, name, date, causal statement) in OUTPUT that is NOT supported by FACTS. Ignore tone, framing and generic filler. Return an empty list if everything is supported.",
      user: `<facts>${JSON.stringify((ir.facts || []).map(({ id, claim }) => ({ id, claim })))}</facts>\n<output>${JSON.stringify(content)}</output>`,
    });
    return r.unsupported?.length ? r.unsupported : null;
  } catch (err) {
    console.warn("Faithfulness check skipped due to error:", err.message);
    return null;
  }
}

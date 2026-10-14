import { z } from "zod";
import { pick } from "./common.js";

export const schema = z.object({
  hook: z.string().max(210).describe("First line, must stand alone before 'see more'"),
  body: z.string().max(2800),
  cta: z.string().max(200),
  hashtags: z.array(z.string().regex(/^#\w+$/)).max(5),
});

export const pickFn = (ir) => pick(ir, ["meta", "summary", "keyPoints", "facts", "numbers", "intent"]);
export { pickFn as pick };

export const instructions = `Write one LinkedIn post ready to publish. Short paragraphs, 1-2 lines each, blank line between. hook = first line. Include relevant hashtags.`;

export const post = (o) => ({
  ...o,
  fullText: `${o.hook}\n\n${o.body}\n\n${o.cta}\n\n${(o.hashtags || []).join(" ")}`
});

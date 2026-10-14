import { z } from "zod";
import { pick as p } from "./common.js";

export const schema = z.object({
  tweets: z.array(z.object({
    text: z.string().max(270).describe("Tweet text <= 270 chars"),
  })).min(1).max(12),
});

export const pick = (ir) => p(ir, ["meta", "summary", "keyPoints", "facts", "numbers"]);

export const instructions = `Write a punchy Twitter/X thread (or single tweet if content is brief). Tweet 1 is the hook. Each tweet must be <= 270 characters. Do NOT number tweets in the text; numbering is added in post-processing.`;

export const post = (o) => ({
  tweets: (o.tweets || []).map((t, i, a) => ({
    text: a.length > 1 ? `${t.text}\n\n${i + 1}/${a.length}` : t.text,
  })),
});

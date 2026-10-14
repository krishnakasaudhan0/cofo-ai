import { z } from "zod";
import { pick as p } from "./common.js";

export const schema = z.object({
  title: z.string(),
  totalDurationSec: z.number().int().min(15).max(600),
  script: z.string().describe("Full narration script"),
  scenes: z.array(z.object({
    n: z.number().int(),
    durationSec: z.number().min(2).max(40),
    sceneDescription: z.string(),
    storyboard: z.string().describe("Shot composition, camera, movement"),
    visual: z.string().describe("Visual recommendation: stock/footage/graphic/chart"),
    narration: z.string(),
    onScreenText: z.string(),
  })).min(3).max(20),
  visualRecommendations: z.object({ style: z.string(), colorPalette: z.array(z.string()), music: z.string() }),
});

export const pick = (ir) => p(ir, ["meta", "summary", "keyPoints", "facts", "numbers", "timeline", "visualCandidates"]);

export const instructions = `Create a complete video package including script, scene-by-scene storyboard, narration, on-screen graphics, and visual recommendations.`;

export const post = (o) => ({ ...o, srt: buildSrt(o.scenes || []) });

function buildSrt(scenes) {
  const ts = (s) => {
    const ms = Math.round(s * 1000);
    const f = (n, l = 2) => String(n).padStart(l, "0");
    return `${f(Math.floor(ms / 3600000))}:${f(Math.floor(ms / 60000) % 60)}:${f(Math.floor(ms / 1000) % 60)},${f(ms % 1000, 3)}`;
  };
  let t = 0, idx = 1, out = [];
  for (const sc of scenes) {
    const words = (sc.narration || "").split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const per = 8;
    const chunks = Array.from({ length: Math.ceil(words.length / per) }, (_, i) => words.slice(i * per, (i + 1) * per).join(" "));
    const d = sc.durationSec / chunks.length;
    chunks.forEach((c, i) => out.push(`${idx++}\n${ts(t + i * d)} --> ${ts(t + (i + 1) * d)}\n${c}\n`));
    t += sc.durationSec;
  }
  return out.join("\n");
}

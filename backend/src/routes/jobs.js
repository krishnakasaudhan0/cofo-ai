import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { bus } from "../jobs/events.js";
import { runJob } from "../jobs/runJob.js";

export const jobs = Router();

const GenerateBody = z.object({
  types: z
    .array(
      z.enum([
        "linkedin",
        "twitter",
        "executive_summary",
        "advisory",
        "presentation",
        "video",
        "infographic",
      ])
    )
    .min(1),
  params: z
    .object({
      audience: z.string().default("general public"),
      tone: z.string().default("professional"),
      language: z.string().default("English"),
      detailLevel: z.enum(["brief", "standard", "detailed"]).default("standard"),
      objective: z.string().default("inform"),
      style: z.string().default("clear and concise"),
    })
    .default({}),
});

jobs.post("/projects/:id/generate", async (req, res) => {
  try {
    const { types, params } = GenerateBody.parse(req.body);
    const job = await prisma.generationJob.create({
      data: { projectId: req.params.id, types, params },
    });
    setImmediate(() => runJob(job.id).catch(console.error));
    return res.status(202).json({ jobId: job.id });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

jobs.get("/jobs/:id/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const send = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  bus.on(req.params.id, send);
  const ka = setInterval(() => res.write(": ping\n\n"), 20000);

  req.on("close", () => {
    bus.off(req.params.id, send);
    clearInterval(ka);
  });
});

jobs.get("/jobs/:id", async (req, res) => {
  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: req.params.id },
      include: { outputs: true },
    });
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

import { Router } from "express";
import { prisma } from "../db.js";
import { runJob } from "../jobs/runJob.js";

export const outputs = Router();

outputs.post("/outputs/:id/regenerate", async (req, res) => {
  try {
    const prev = await prisma.output.findUnique({
      where: { id: req.params.id },
      include: { job: true },
    });
    if (!prev) return res.status(404).json({ error: "Output not found" });

    const next = await prisma.output.create({
      data: {
        jobId: prev.jobId,
        type: prev.type,
        version: prev.version + 1,
        parentId: prev.id,
        status: "running",
      },
    });

    const job = await prisma.generationJob.create({
      data: {
        projectId: prev.job.projectId,
        types: [prev.type],
        params: prev.job.params,
      },
    });

    setImmediate(() =>
      runJob(job.id, {
        regen: {
          output: next,
          previous: prev.content,
          feedback: req.body.feedback,
        },
      }).catch(console.error)
    );

    return res.status(202).json({ jobId: job.id, outputId: next.id });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

outputs.get("/outputs/:id", async (req, res) => {
  try {
    const output = await prisma.output.findUnique({
      where: { id: req.params.id },
    });
    if (!output) return res.status(404).json({ error: "Output not found" });
    return res.json(output);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

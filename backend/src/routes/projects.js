import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../db.js";
import { SourceBundle } from "../analyzer/schemas.js";
import { analyze } from "../analyzer/analyze.js";
import { cleanMarkdown } from "../ingestion/clean.js";

export const projects = Router();

projects.post("/projects", async (req, res) => {
  try {
    const bundle = SourceBundle.parse(req.body);
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(bundle.sources.map((s) => [s.source_type, cleanMarkdown(s.content)])))
      .digest("hex");

    // IR cache: same sources → reuse the IR (saves latency & tokens)
    const hit = await prisma.project.findFirst({
      where: { contentHash: hash, status: "ready" },
      include: { ir: true }
    });
    if (hit) {
      return res.json({ projectId: hit.id, cached: true, ir: hit.ir?.data, status: "ready" });
    }

    const project = await prisma.project.create({
      data: {
        userId: req.user?.id || null,
        sourceBundle: bundle,
        contentHash: hash,
        title: bundle.sources.find((s) => s.title)?.title ?? "Untitled Content Transformation",
      },
    });

    setImmediate(() => analyzeProject(project.id).catch(console.error));
    return res.status(202).json({ projectId: project.id, status: "analyzing" });
  } catch (err) {
    console.error("Create project error:", err);
    return res.status(400).json({ error: err.message });
  }
});

async function analyzeProject(id) {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) return;
  try {
    const { ir, dropped } = await analyze(p.sourceBundle);
    await prisma.canonicalIR.create({
      data: { projectId: id, data: ir, droppedFacts: dropped },
    });
    await prisma.project.update({ where: { id }, data: { status: "ready" } });
  } catch (e) {
    console.error("Project analysis failed:", e);
    await prisma.project.update({
      where: { id },
      data: { status: "failed", error: String(e.message).slice(0, 500) },
    });
  }
}

projects.get("/projects/:id", async (req, res) => {
  try {
    const p = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { ir: true, jobs: { include: { outputs: true } } },
    });
    if (!p) return res.status(404).json({ error: "Project not found" });
    return res.json(p);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

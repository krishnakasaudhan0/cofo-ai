import pLimit from "p-limit";
import { prisma } from "../db.js";
import { bus } from "./events.js";
import { runGenerator } from "../generators/index.js";
import { renderIfNeeded } from "../renderers/index.js";
import { faithfulness } from "../checks/faithfulness.js";

export async function runJob(jobId, { regen } = {}) {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    include: { project: { include: { ir: true } } },
  });

  if (!job || !job.project?.ir) {
    throw new Error(`Job or compiled IR not found for jobId ${jobId}`);
  }

  const ir = job.project.ir.data;
  await prisma.generationJob.update({ where: { id: jobId }, data: { status: "running" } });

  const limit = pLimit(3); // concurrency cap to prevent rate limits
  const results = await Promise.allSettled(
    job.types.map((type) =>
      limit(async () => {
        const out =
          regen?.output ??
          (await prisma.output.create({ data: { jobId, type, status: "running" } }));
        bus.emit(jobId, { outputId: out.id, type, status: "running" });

        try {
          const content = await runGenerator(
            type,
            ir,
            job.params,
            regen && { previous: regen.previous, feedback: regen.feedback }
          );

          const warnings = await faithfulness(ir, type, content).catch(() => null);
          const fileUrl = await renderIfNeeded(type, content, out.id);

          await prisma.output.update({
            where: { id: out.id },
            data: { status: "done", content, warnings, fileUrl },
          });

          bus.emit(jobId, { outputId: out.id, type, status: "done", content, warnings, fileUrl });
        } catch (e) {
          console.error(`Generator error for ${type}:`, e);
          await prisma.output.update({
            where: { id: out.id },
            data: { status: "failed", error: String(e.message).slice(0, 500) },
          });

          bus.emit(jobId, { outputId: out.id, type, status: "failed", error: e.message });
          throw e;
        }
      })
    )
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const status = ok === results.length ? "done" : ok > 0 ? "partial" : "failed";
  await prisma.generationJob.update({ where: { id: jobId }, data: { status } });
  bus.emit(jobId, { jobStatus: status });
}

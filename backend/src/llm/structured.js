import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "../db.js";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

/**
 * generateStructured: Core primitive for reliable structured output with Gemini.
 * Forces valid schema conformance with an automatic repair loop and telemetry logging.
 */
export async function generateStructured({
  purpose,
  name = "return_result",
  schema,
  system = "",
  user = "",
  model = DEFAULT_MODEL,
  maxTokens = 8000,
  maxRetries = 2,
}) {
  const { $schema, ...jsonSchema } = zodToJsonSchema(schema, { $refStrategy: "none" });

  const systemInstruction = `${system ? system + "\n\n" : ""}CRITICAL: You MUST return a single, valid JSON object that strictly adheres to the following JSON Schema:
${JSON.stringify(jsonSchema, null, 2)}
Do not output markdown codeblocks (no \`\`\`json). Output pure, parseable JSON only.`;

  const messages = [
    {
      role: "user",
      parts: [{ text: user }]
    }
  ];

  const t0 = Date.now();
  let inTok = 0;
  let outTok = 0;
  let lastIssues = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const payload = {
        contents: messages,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: maxTokens,
          temperature: 0.2
        }
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const usage = data.usageMetadata || {};
      inTok += usage.promptTokenCount || 0;
      outTok += usage.candidatesTokenCount || 0;

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      // Clean possible wrapper fences
      const cleanJsonText = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      let parsedJson;
      try {
        parsedJson = JSON.parse(cleanJsonText);
      } catch (jsonErr) {
        lastIssues = [`JSON Parse Error: ${jsonErr.message}`];
        messages.push({
          role: "model",
          parts: [{ text: rawText }]
        });
        messages.push({
          role: "user",
          parts: [{ text: `The response was not valid JSON:\n${rawText}\nError: ${jsonErr.message}. Output ONLY valid JSON.` }]
        });
        continue;
      }

      const parsed = schema.safeParse(parsedJson);

      if (parsed.success) {
        await logLlmCall({ purpose, model, inTok, outTok, t0, retries: attempt, ok: true });
        return parsed.data;
      }

      lastIssues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`);

      // Repair turn: feed back model's output and validation issues for self-repair
      messages.push({
        role: "model",
        parts: [{ text: JSON.stringify(parsedJson) }]
      });
      messages.push({
        role: "user",
        parts: [{
          text: `Validation failed against schema:\n${lastIssues.join("\n")}\nPlease correct the errors and return a compliant JSON object.`
        }]
      });

    } catch (err) {
      lastIssues = [err.message];
      if (attempt === maxRetries) break;
    }
  }

  await logLlmCall({ purpose, model, inTok, outTok, t0, retries: maxRetries, ok: false });
  throw new Error(`Structured output failed (${purpose}): ${lastIssues?.join(" | ")}`);
}

async function logLlmCall({ purpose, model, inTok, outTok, t0, retries, ok }) {
  try {
    await prisma.llmCall.create({
      data: {
        purpose,
        model,
        inTokens: inTok,
        outTokens: outTok,
        latencyMs: Date.now() - t0,
        retries,
        ok
      }
    });
  } catch (err) {
    // Non-fatal if telemetry logging fails
    console.warn("Failed to log LlmCall:", err.message);
  }
}

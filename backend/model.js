import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function getGroqChatCompletion(
  userDocs,
  userPrompt,
  selectedOutput
) {
  return await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",

    messages: [
      {
        role: "system",
        content: `
You are a content specialist and expert in generating content based ONLY on the
user's document, prompt, and selected output.

Rules:
1. Do not add information that is not present in the user document or requested by the user.
2. Follow the selected output type exactly.
3. Return ONLY valid JSON.
4. Do not wrap the JSON in markdown or code fences.

Selected output types:

- linkedinPost:
  Generate a LinkedIn post.

- video:
  Generate a video package containing a timeline.
  Each scene must contain:
  scene, visualScript, voiceover, musicCues.

- ppt:
  Generate a slide-wise presentation.
  Each slide must contain:
  slide, content, imageDescription.

- advisoryNote:
  Generate an advisory note.

- infographic:
  Generate infographic content.

Return this JSON structure:

{
  "selectedOutput": "<selected output>",
  "linkedinPost": "",
  "video": {
    "timeline": []
  },
  "ppt": {
    "slides": []
  },
  "advisoryNote": "",
  "infographic": ""
}
        `,
      },
      {
        role: "user",
        content: `
USER DOCUMENT:
${userDocs}

USER PROMPT:
${userPrompt}

SELECTED OUTPUT:
${selectedOutput}
        `,
      },
    ],

    response_format: {
      type: "json_object",
    },
  });
}
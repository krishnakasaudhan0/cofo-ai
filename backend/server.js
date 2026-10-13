import express from "express";
import cors from "cors";
import { getGroqChatCompletion } from "./model.js";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/generate", async (req, res) => {
  try {
    const { pdfText, prompt, selectedOutput } = req.body;

    // Validate input
    if (!pdfText) {
      return res.status(400).json({
        error: "pdfText is required",
      });
    }

    if (!selectedOutput) {
      return res.status(400).json({
        error: "selectedOutput is required",
      });
    }

    const result = await getGroqChatCompletion(
      pdfText,
      prompt,
      selectedOutput
    );

    // Extract LLM response
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "No content returned from LLM",
      });
    }

    // Convert JSON string returned by model into actual JSON
    const generatedContent = JSON.parse(content);

    console.log("Generated content:");
    console.log(generatedContent);

    res.json(generatedContent);

  } catch (error) {
    console.error("Generation error:", error);

    res.status(500).json({
      error: "Failed to generate content",
      message: error.message,
    });
  }
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
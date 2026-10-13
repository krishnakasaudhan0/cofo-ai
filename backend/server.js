import express from "express";
import cors from "cors";
import { getGroqChatCompletion } from "./model.js";

const app = express();

app.use(cors());
app.use(express.json());



app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});
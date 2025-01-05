import { GoogleGenerativeAI } from "@google/generative-ai";
import { StreamingTextResponse } from "ai";
import { CompletionRequestBody } from "@/lib/types";

// Create a Google Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export const runtime = "edge";

// This is the instructions that GPT-4 will use to know how to respond. For more information on
// the difference between a system message and a user message, see:
// https://platform.openai.com/docs/guides/gpt/chat-completions-api
const systemPrompt = `You are an expert poet, you will be given a list of bulleted strings and 
you will write a short and concise poem using some of the information in the list. 
Only respond with a poem, don't make the poem too long.`;

// This is used to format the message that the user sends to the API. Note we should
// never have the client create the prompt directly as this could mean that the client
// could use your api for any general purpose completion and leak the "secret sauce" of
// your prompt.
async function buildPrompt(
  req: Request,
): Promise<string> {
  const body = await req.json();

  // We use zod to validate the request body. To change the data that is sent to the API,
  // change the CompletionRequestBody type in lib/types.ts
  const { layers } = CompletionRequestBody.parse(body);

  const bulletedList = layers.map((layer) => `* ${layer}`).join("\n");

  return `${systemPrompt}\n\nInput:\n${bulletedList}`;
}

export async function POST(req: Request) {
  // Ask Gemini for a streaming completion given the prompt
  const prompt = await buildPrompt(req);

  // Create a streaming completion using Gemini
  const response = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 200,
      temperature: 0.7,
    },
  });

  // Create a ReadableStream from the Gemini response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  // Respond with the stream
  const result = new StreamingTextResponse(stream);

  return result;
}

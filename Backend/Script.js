import "dotenv/config";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// Build the system prompt depending on whether we have document context.
function buildSystemPrompt({ context, memory }) {
  let prompt =
    "You are a helpful, friendly assistant inside a RAG application. " +
    "Answer clearly and concisely. Use markdown when it helps.";

  if (memory && memory.length) {
    const facts = memory.map((m) => `- ${m.fact}`).join("\n");
    prompt +=
      "\n\nThings to remember about this conversation:\n" + facts;
  }

  if (context && context.trim()) {
    prompt +=
      "\n\nThe user has attached a document. Use the following context to " +
      "answer their question. If the answer is not in the context, say so " +
      "and then answer from general knowledge if you can.\n\n" +
      `Document context:\n${context}`;
  }

  return prompt;
}

// Assemble the full message array: system + recent history + new question.
function buildMessages({ context, memory, history, question }) {
  const messages = [
    { role: "system", content: buildSystemPrompt({ context, memory }) },
  ];
  if (Array.isArray(history)) {
    // history already excludes the brand-new user message
    for (const m of history) messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: "user", content: question });
  return messages;
}

// Non-streaming completion (kept for the simple /ask route).
export const ChatCompletion = async (context, question) => {
  const chatCompletion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    messages: buildMessages({ context, question, history: [], memory: [] }),
  });
  return chatCompletion.choices[0]?.message?.content || "";
};

// Streaming completion. Calls onToken(text) for each piece of text and
// returns the full assembled answer at the end.
export const ChatCompletionStream = async (
  { context, question, history, memory },
  onToken
) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing. Add it to your .env file.");
  }
  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      stream: true,
      messages: buildMessages({ context, question, history, memory }),
    });

    let full = "";
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        full += token;
        if (onToken) onToken(token);
      }
    }
    return full;
  } catch (err) {
    if (err.status === 401) {
      throw new Error("Groq rejected the API key (401). Check GROQ_API_KEY in .env.");
    }
    throw new Error(`The AI model failed to respond: ${err.message}`);
  }
};

import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { mkdir, unlink } from "fs/promises";

import { extractText } from "./LoadPdf.js";
import { TextSplitter } from "./Chunking.js";
import { StoreChunks, Retrieve } from "./Indexing.js";
import { ChatCompletionStream } from "./Script.js";
import {
  listSessions,
  getSession,
  createSession,
  renameSession,
  deleteSession,
  addMessage,
  attachDocument,
  getHistoryForLLM,
  getMemory,
  addMemory,
} from "./Store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });

// multer keeps the original extension so extractText can detect the type.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const route = express.Router();

// ============================================================
// SESSIONS  (the ChatGPT-style left sidebar)
// ============================================================

// List all chats (lightweight, for the sidebar).
route.get("/sessions", (req, res) => {
  res.json({ sessions: listSessions() });
});

// Create a new chat ("New chat" button).
route.post("/sessions", async (req, res) => {
  const session = await createSession();
  res.json({ session });
});

// Get one chat with its full message history.
route.get("/sessions/:id", (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Chat not found." });
  res.json({ session });
});

// Rename a chat.
route.patch("/sessions/:id", async (req, res) => {
  const { title } = req.body;
  const session = await renameSession(req.params.id, title);
  if (!session) return res.status(404).json({ error: "Chat not found." });
  res.json({ session });
});

// Delete a chat.
route.delete("/sessions/:id", async (req, res) => {
  await deleteSession(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// MEMORY
// ============================================================
route.get("/sessions/:id/memory", (req, res) => {
  res.json({ memory: getMemory(req.params.id) });
});

route.post("/sessions/:id/memory", async (req, res) => {
  const { fact } = req.body;
  if (!fact) return res.status(400).json({ error: "Provide a 'fact'." });
  const memory = await addMemory(req.params.id, fact);
  if (!memory) return res.status(404).json({ error: "Chat not found." });
  res.json({ memory });
});

// ============================================================
// UPLOAD  (the '+' icon -> use RAG)
// ============================================================
// Accepts a pdf/docx/txt, extracts + chunks + embeds it into a Pinecone
// namespace tied to this chat session.
route.post("/sessions/:id/upload", upload.single("file"), async (req, res) => {
  try {
    const session = getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Chat not found." });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const text = await extractText(req.file.path, req.file.originalname);
    if (!text || !text.trim()) {
      await unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: "Could not read any text from the file." });
    }

    const chunks = await TextSplitter(text);
    const namespace = `chat-${session.id}`;
    const stored = await StoreChunks(chunks, namespace);

    await attachDocument(session.id, {
      name: req.file.originalname,
      namespace,
      chunks: stored,
    });

    // we don't need the raw upload on disk after embedding
    await unlink(req.file.path).catch(() => {});

    res.json({
      message: "Document attached.",
      document: { name: req.file.originalname, chunks: stored },
    });
  } catch (err) {
    console.error(err);
    if (req.file) await unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CHAT  (streaming, general + RAG)
// ============================================================
// Streams the answer back as Server-Sent Events.
route.post("/sessions/:id/chat", async (req, res) => {
  try {
    const session = getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Chat not found." });

    const { message } = req.body;
    if (!message || !message.trim())
      return res.status(400).json({ error: "Provide a 'message'." });

    // History BEFORE we add the new user message, then save the user message.
    const history = getHistoryForLLM(session.id, 10);
    await addMessage(session.id, "user", message);

    // If a document is attached, retrieve relevant context (RAG).
    let context = "";
    if (session.document?.namespace) {
      context = await Retrieve(message, 4, session.document.namespace);
    }
    const memory = getMemory(session.id);

    // --- Server-Sent Events headers ---
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const send = (event, data) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    const full = await ChatCompletionStream(
      { context, question: message, history, memory },
      (token) => send("token", { token })
    );

    // Persist the assistant's full answer.
    const saved = await addMessage(session.id, "assistant", full);
    send("done", { messageId: saved.id, title: getSession(session.id).title });
    res.end();
  } catch (err) {
    console.error(err);
    // If headers already sent, stream the error; else send JSON.
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

export default route;

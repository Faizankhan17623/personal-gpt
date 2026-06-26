// ============================================================
// Store.js — chat sessions, messages and memory
// ------------------------------------------------------------
// Two layers working together:
//   1) node-cache  -> fast in-memory access while the server runs
//   2) JSON files  -> persistence so nothing is lost on restart
//
// On boot we load all saved sessions from disk into the cache.
// Every write updates the cache AND writes the JSON file back,
// so the cache stays hot and the disk stays the source of truth.
// ============================================================

import NodeCache from "node-cache";
import { randomUUID } from "crypto";
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  unlink,
} from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const CHATS_DIR = path.join(DATA_DIR, "chats");

// stdTTL: 0 -> entries never expire on their own (we manage them).
const cache = new NodeCache({ stdTTL: 0, useClones: false });
const SESSIONS_KEY = "sessions"; // cache key holding an array of session objects

// --- disk helpers --------------------------------------------------------
async function ensureDirs() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(CHATS_DIR)) await mkdir(CHATS_DIR, { recursive: true });
}

function chatFile(id) {
  return path.join(CHATS_DIR, `${id}.json`);
}

async function persist(session) {
  await ensureDirs();
  await writeFile(chatFile(session.id), JSON.stringify(session, null, 2), "utf8");
}

// --- boot: load everything from disk into the cache ----------------------
export async function initStore() {
  await ensureDirs();
  const files = (await readdir(CHATS_DIR)).filter((f) => f.endsWith(".json"));
  const sessions = [];
  for (const f of files) {
    try {
      const raw = await readFile(path.join(CHATS_DIR, f), "utf8");
      sessions.push(JSON.parse(raw));
    } catch {
      // skip a corrupt file rather than crash the whole server
    }
  }
  // newest first
  sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  cache.set(SESSIONS_KEY, sessions);
  console.log(`Store loaded ${sessions.length} chat session(s).`);
}

function getSessions() {
  return cache.get(SESSIONS_KEY) || [];
}

function setSessions(sessions) {
  cache.set(SESSIONS_KEY, sessions);
}

// --- public API ----------------------------------------------------------

// Lightweight list for the sidebar (no full message bodies).
export function listSessions() {
  return getSessions().map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    hasDocument: !!s.document,
    documentName: s.document?.name || null,
  }));
}

export function getSession(id) {
  return getSessions().find((s) => s.id === id) || null;
}

export async function createSession(title = "New chat") {
  const now = Date.now();
  const session = {
    id: randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [], // { id, role: 'user'|'assistant', content, createdAt }
    memory: [], // short list of "remembered" facts for this chat
    document: null, // { name, namespace, chunks } when a doc is attached
  };
  const sessions = getSessions();
  sessions.unshift(session);
  setSessions(sessions);
  await persist(session);
  return session;
}

export async function renameSession(id, title) {
  const session = getSession(id);
  if (!session) return null;
  session.title = title;
  session.updatedAt = Date.now();
  await persist(session);
  return session;
}

export async function deleteSession(id) {
  const sessions = getSessions().filter((s) => s.id !== id);
  setSessions(sessions);
  if (existsSync(chatFile(id))) await unlink(chatFile(id));
  return true;
}

// Add a message. If it's the first user message, auto-title the chat from it.
export async function addMessage(id, role, content) {
  const session = getSession(id);
  if (!session) return null;

  const message = {
    id: randomUUID(),
    role,
    content,
    createdAt: Date.now(),
  };
  session.messages.push(message);
  session.updatedAt = message.createdAt;

  // Auto title: first user message becomes the chat title (like ChatGPT).
  const isFirstUser =
    role === "user" &&
    session.messages.filter((m) => m.role === "user").length === 1;
  if (isFirstUser && (session.title === "New chat" || !session.title)) {
    session.title = makeTitle(content);
  }

  // Keep newest session at the top of the sidebar list.
  const sessions = getSessions().filter((s) => s.id !== id);
  sessions.unshift(session);
  setSessions(sessions);

  await persist(session);
  return message;
}

export async function attachDocument(id, document) {
  const session = getSession(id);
  if (!session) return null;
  session.document = document; // { name, namespace, chunks }
  session.updatedAt = Date.now();
  await persist(session);
  return session;
}

// --- memory --------------------------------------------------------------
// A simple per-chat memory: short bullet facts the model can reuse.
export async function addMemory(id, fact) {
  const session = getSession(id);
  if (!session) return null;
  session.memory.push({ fact, createdAt: Date.now() });
  // keep memory bounded so the prompt stays small
  if (session.memory.length > 20) session.memory = session.memory.slice(-20);
  await persist(session);
  return session.memory;
}

export function getMemory(id) {
  const session = getSession(id);
  return session ? session.memory : [];
}

// Build the recent conversation as chat messages for the LLM.
export function getHistoryForLLM(id, limit = 10) {
  const session = getSession(id);
  if (!session) return [];
  return session.messages
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.content }));
}

// --- helpers -------------------------------------------------------------
function makeTitle(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const short = clean.length > 40 ? clean.slice(0, 40).trim() + "…" : clean;
  return short || "New chat";
}

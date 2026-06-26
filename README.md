# Personal Gpt

A full-stack **RAG (Retrieval-Augmented Generation) chat agent** with a ChatGPT-style
interface. Chat freely with an AI, or attach a document (PDF / Word / TXT) and ask
questions answered from its content. Every conversation is saved with history, and
the AI streams its replies word-by-word.

![Personal Gpt](Frontend/src/assets/hero.png)

---

## ✨ Features

- **ChatGPT-style UI** — left sidebar with **New chat**, **Search chats**, and a
  **Recents** list of all past conversations (click to reopen, delete with the trash icon).
- **Auto-titled chats** — the first message you send becomes the chat title, just like ChatGPT.
- **Streaming responses** — answers appear token-by-token via Server-Sent Events.
- **RAG with documents** — click the **`+`** icon → *Use RAG — attach a document*
  to upload a **PDF, Word (.docx), or TXT**. The file is read, chunked, embedded, and
  stored in Pinecone, then answers are grounded in that document.
- **General chat + RAG** — talk normally any time; attach a doc to switch into
  document-grounded answers.
- **Persistent history + memory** — chats are kept in an in-memory cache for speed
  **and** mirrored to JSON files on disk, so nothing is lost on restart. Each chat
  also keeps a small per-conversation memory.

---

## 🧱 Tech Stack

| Layer       | Technology                                            |
| ----------- | ----------------------------------------------------- |
| Frontend    | React + Vite, Redux Toolkit, react-markdown           |
| Backend     | Node.js, Express, Server-Sent Events                  |
| LLM         | Groq (`llama-3.3-70b-versatile`)                      |
| Embeddings  | Pinecone `multilingual-e5-large` (1024-dim)           |
| Vector DB   | Pinecone                                              |
| File parse  | pdf-parse (PDF), mammoth (Word), fs (TXT)             |
| Storage     | node-cache + JSON files on disk                       |

---

## 📁 Project Structure

```
Ragg/
├── Backend/
│   ├── index.js          # Express app + boot
│   ├── Routing.js        # API routes (sessions, upload, chat)
│   ├── Store.js          # node-cache + JSON persistence (chats & memory)
│   ├── Script.js         # Groq chat completion (streaming + non-streaming)
│   ├── Indexing.js       # Pinecone upsert + retrieve (per-chat namespaces)
│   ├── Embeddings.js     # embed documents / queries
│   ├── Chunking.js       # text splitter
│   ├── LoadPdf.js        # extract text from pdf/docx/txt
│   ├── Pinecone.js       # Pinecone client
│   ├── nodemon.json      # ignores data/ & uploads/ so dev streams don't reset
│   └── .env.example      # copy to .env and add your keys
└── Frontend/
    └── src/
        ├── api.js                 # backend client (incl. SSE stream reader)
        ├── store/                 # Redux Toolkit store + chat slice
        └── components/            # Sidebar, ChatWindow, Composer
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A **Groq** API key — https://console.groq.com/keys
- A **Pinecone** account with an index named `rag` (1024 dimensions) — https://app.pinecone.io

### 1. Backend
```bash
cd Backend
npm install
cp .env.example .env      # then edit .env and add your keys
npm run dev               # starts on http://localhost:4000
```

### 2. Frontend
```bash
cd Frontend
npm install
npm run dev               # opens http://localhost:5173
```

Open the frontend URL, click **New chat**, and start talking. To use RAG, click the
**`+`** icon and attach a document.

---

## 🔌 API Overview

| Method | Endpoint                          | Purpose                          |
| ------ | --------------------------------- | -------------------------------- |
| GET    | `/api/sessions`                   | List all chats (sidebar)         |
| POST   | `/api/sessions`                   | Create a new chat                |
| GET    | `/api/sessions/:id`               | Get a chat with full history     |
| PATCH  | `/api/sessions/:id`               | Rename a chat                    |
| DELETE | `/api/sessions/:id`               | Delete a chat                    |
| POST   | `/api/sessions/:id/upload`        | Upload a document (RAG)          |
| POST   | `/api/sessions/:id/chat`          | Send a message (streams SSE)     |
| GET    | `/api/sessions/:id/memory`        | Read per-chat memory             |
| POST   | `/api/sessions/:id/memory`        | Add a fact to memory             |

---

## 📦 Deploying to Production

- **Frontend**: build with `npm run build` (output in `Frontend/dist/`) and host on any
  static host (Vercel, Netlify, etc.). Update the `BASE` URL in `Frontend/src/api.js`
  to point at your deployed backend.
- **Backend**: deploy to any Node host (Render, Railway, a VPS, etc.). Set the
  environment variables from `.env.example` in the host's dashboard. For multi-instance
  hosting, swap the JSON-file storage in `Store.js` for a shared database.

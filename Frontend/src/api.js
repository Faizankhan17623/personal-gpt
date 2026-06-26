// Thin API client for the RAG backend.
const BASE = "http://localhost:4000/api";

export async function listSessions() {
  const r = await fetch(`${BASE}/sessions`);
  const data = await r.json();
  return data.sessions;
}

export async function createSession() {
  const r = await fetch(`${BASE}/sessions`, { method: "POST" });
  const data = await r.json();
  return data.session;
}

export async function getSession(id) {
  const r = await fetch(`${BASE}/sessions/${id}`);
  if (!r.ok) throw new Error("Chat not found");
  const data = await r.json();
  return data.session;
}

export async function renameSession(id, title) {
  const r = await fetch(`${BASE}/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await r.json();
  return data.session;
}

export async function deleteSession(id) {
  await fetch(`${BASE}/sessions/${id}`, { method: "DELETE" });
}

export async function uploadDocument(id, file) {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(`${BASE}/sessions/${id}/upload`, {
    method: "POST",
    body: form,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Upload failed");
  return data.document;
}

// Stream a chat answer. Calls onToken(text) per chunk, onDone({title}) at end.
// Wrapped in try/catch so a dropped connection becomes a friendly error
// instead of an uncaught TypeError that breaks the UI.
export async function streamChat(id, message, { onToken, onDone, onError }) {
  let res;
  try {
    res = await fetch(`${BASE}/sessions/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch (err) {
    onError?.(
      new Error(
        "Could not reach the server. Is the backend running on port 4000?"
      )
    );
    return;
  }

  if (!res.ok && !res.body) {
    const data = await res.json().catch(() => ({}));
    onError?.(new Error(data.error || "Chat failed"));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotDone = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";

      for (const frame of frames) {
        const lines = frame.split("\n");
        let event = "message";
        let dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let payload;
        try {
          payload = JSON.parse(dataStr);
        } catch {
          continue;
        }
        if (event === "token") onToken?.(payload.token);
        else if (event === "done") {
          gotDone = true;
          onDone?.(payload);
        } else if (event === "error") onError?.(new Error(payload.error));
      }
    }
  } catch (err) {
    // Connection reset mid-stream (server restart, crash, network blip).
    if (!gotDone) {
      onError?.(
        new Error("The connection dropped while the answer was streaming.")
      );
    }
  }
}

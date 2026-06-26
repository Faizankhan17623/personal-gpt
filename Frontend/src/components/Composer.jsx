import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  newChat,
  uploadDoc,
  pushUserMessage,
  startAssistantMessage,
  appendToken,
  finishAssistantMessage,
  streamError,
} from "../store/chatSlice";
import { streamChat } from "../api";
import { createTypewriter } from "../typewriter";

export default function Composer() {
  const dispatch = useDispatch();
  const { activeId, streaming, uploading, activeDocument } = useSelector(
    (s) => s.chat
  );
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef(null);

  // Make sure we have a chat to talk in; returns its id.
  const ensureSession = async () => {
    if (activeId) return activeId;
    const action = await dispatch(newChat());
    return action.payload.id;
  };

  const handleSend = async () => {
    const message = text.trim();
    if (!message || streaming) return;
    const id = await ensureSession();
    setText("");

    dispatch(pushUserMessage(message));
    dispatch(startAssistantMessage());

    // Smooth the bursty network tokens into a steady "typing" effect.
    const typer = createTypewriter((chunk) => dispatch(appendToken(chunk)));
    let donePayload = null;

    await streamChat(id, message, {
      onToken: (t) => typer.push(t),
      onDone: (payload) => {
        donePayload = payload;
      },
      onError: (err) => dispatch(streamError(err.message)),
    });

    // Let the typewriter finish revealing everything, then mark done.
    await typer.flush();
    if (donePayload) dispatch(finishAssistantMessage(donePayload));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const id = await ensureSession();
    setMenuOpen(false);
    await dispatch(uploadDoc({ id, file }));
  };

  return (
    <div className="composer-wrap">
      <div className="composer">
        <div className="plus-wrap">
          <button
            className="plus-btn"
            title="Use a document (RAG)"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={uploading}
          >
            {uploading ? <span className="spinner" /> : "+"}
          </button>
          {menuOpen && (
            <div className="plus-menu" onMouseLeave={() => setMenuOpen(false)}>
              <button onClick={() => fileRef.current?.click()}>
                📎 Use RAG — attach a document
                <span className="hint">PDF, Word or TXT</span>
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            hidden
            onChange={handleFilePick}
          />
        </div>

        <textarea
          className="composer-input"
          placeholder={
            activeDocument
              ? `Ask about ${activeDocument.name}…`
              : "Ask anything"
          }
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!text.trim() || streaming}
          title="Send"
        >
          {streaming ? <span className="spinner dark" /> : "➤"}
        </button>
      </div>

      {activeDocument && (
        <div className="doc-chip">
          📄 {activeDocument.name} · {activeDocument.chunks} chunks indexed —
          answers now use this document
        </div>
      )}
      {uploading && (
        <div className="upload-loader">
          <span className="spinner" /> Reading & indexing your document…
        </div>
      )}
    </div>
  );
}

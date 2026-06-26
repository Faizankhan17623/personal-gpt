import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";
import Composer from "./Composer";

function Welcome() {
  return (
    <div className="welcome">
      <h1>What can I help with?</h1>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="typing">
      <span></span>
      <span></span>
      <span></span>
    </span>
  );
}

export default function ChatWindow() {
  const { messages, streaming } = useSelector((s) => s.chat);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <main className="chat-window">
      <header className="chat-header">
        <span className="model-name">Personal Gpt ▾</span>
      </header>

      <div className={`chat-body ${hasMessages ? "" : "centered"}`}>
        {!hasMessages ? (
          <Welcome />
        ) : (
          <div className="messages">
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="bubble">
                  {m.role === "assistant" && !m.content && streaming ? (
                    <TypingDots />
                  ) : (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <Composer />
    </main>
  );
}

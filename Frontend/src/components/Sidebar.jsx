import { useDispatch, useSelector } from "react-redux";
import {
  newChat,
  openChat,
  removeChat,
  setSearch,
  toggleSidebar,
} from "../store/chatSlice";

export default function Sidebar() {
  const dispatch = useDispatch();
  const { sessions, activeId, search, sidebarOpen } = useSelector((s) => s.chat);

  const filtered = sessions.filter((s) =>
    (s.title || "").toLowerCase().includes(search.toLowerCase())
  );

  if (!sidebarOpen) {
    return (
      <div className="sidebar collapsed">
        <button className="icon-btn" title="Open sidebar" onClick={() => dispatch(toggleSidebar())}>
          ☰
        </button>
        <button className="icon-btn" title="New chat" onClick={() => dispatch(newChat())}>
          ✎
        </button>
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <span className="brand">Personal Gpt</span>
        <button className="icon-btn" title="Close sidebar" onClick={() => dispatch(toggleSidebar())}>
          ⟨
        </button>
      </div>

      <button className="new-chat-btn" onClick={() => dispatch(newChat())}>
        <span className="ic">✎</span> New chat
      </button>

      <div className="search-box">
        <span className="ic">⌕</span>
        <input
          placeholder="Search chats"
          value={search}
          onChange={(e) => dispatch(setSearch(e.target.value))}
        />
      </div>

      <div className="recents-label">Recents</div>

      <nav className="chat-list">
        {filtered.length === 0 && (
          <div className="empty-recents">No chats yet</div>
        )}
        {filtered.map((s) => (
          <div
            key={s.id}
            className={`chat-item ${s.id === activeId ? "active" : ""}`}
            onClick={() => dispatch(openChat(s.id))}
          >
            <span className="chat-title">
              {s.hasDocument && <span className="doc-dot" title={s.documentName}>📄</span>}
              {s.title}
            </span>
            <button
              className="del-btn"
              title="Delete chat"
              onClick={(e) => {
                e.stopPropagation();
                dispatch(removeChat(s.id));
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}

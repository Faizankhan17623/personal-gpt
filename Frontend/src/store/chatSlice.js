import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as api from "../api";

// --- async thunks ---------------------------------------------------------
export const fetchSessions = createAsyncThunk("chat/fetchSessions", async () => {
  return await api.listSessions();
});

export const newChat = createAsyncThunk("chat/newChat", async () => {
  return await api.createSession();
});

export const openChat = createAsyncThunk("chat/openChat", async (id) => {
  return await api.getSession(id);
});

export const removeChat = createAsyncThunk("chat/removeChat", async (id) => {
  await api.deleteSession(id);
  return id;
});

export const renameChat = createAsyncThunk(
  "chat/renameChat",
  async ({ id, title }) => {
    return await api.renameSession(id, title);
  }
);

export const uploadDoc = createAsyncThunk(
  "chat/uploadDoc",
  async ({ id, file }) => {
    const document = await api.uploadDocument(id, file);
    return { id, document };
  }
);

// --- slice ----------------------------------------------------------------
const slice = createSlice({
  name: "chat",
  initialState: {
    sessions: [], // sidebar list
    activeId: null,
    messages: [], // messages of the active chat
    activeDocument: null, // { name, chunks } for active chat
    streaming: false,
    uploading: false,
    sidebarOpen: true,
    search: "",
  },
  reducers: {
    setActive(state, action) {
      state.activeId = action.payload;
    },
    setSearch(state, action) {
      state.search = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    // optimistic add of the user's message
    pushUserMessage(state, action) {
      state.messages.push({
        id: `tmp-${Date.now()}`,
        role: "user",
        content: action.payload,
      });
    },
    // create an empty assistant message that we'll stream into
    startAssistantMessage(state) {
      state.streaming = true;
      state.messages.push({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
      });
    },
    appendToken(state, action) {
      const last = state.messages[state.messages.length - 1];
      if (last && last.role === "assistant") last.content += action.payload;
    },
    finishAssistantMessage(state, action) {
      state.streaming = false;
      // bump the active session's title in the sidebar if it changed
      const title = action.payload?.title;
      if (title && state.activeId) {
        const s = state.sessions.find((x) => x.id === state.activeId);
        if (s) s.title = title;
      }
    },
    streamError(state, action) {
      state.streaming = false;
      const last = state.messages[state.messages.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        last.content = `⚠️ ${action.payload || "Something went wrong."}`;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.sessions = action.payload;
      })
      .addCase(newChat.fulfilled, (state, action) => {
        state.sessions.unshift({
          id: action.payload.id,
          title: action.payload.title,
          createdAt: action.payload.createdAt,
          updatedAt: action.payload.updatedAt,
          hasDocument: false,
          documentName: null,
        });
        state.activeId = action.payload.id;
        state.messages = [];
        state.activeDocument = null;
      })
      .addCase(openChat.fulfilled, (state, action) => {
        state.activeId = action.payload.id;
        state.messages = action.payload.messages;
        state.activeDocument = action.payload.document
          ? {
              name: action.payload.document.name,
              chunks: action.payload.document.chunks,
            }
          : null;
      })
      .addCase(removeChat.fulfilled, (state, action) => {
        state.sessions = state.sessions.filter((s) => s.id !== action.payload);
        if (state.activeId === action.payload) {
          state.activeId = null;
          state.messages = [];
          state.activeDocument = null;
        }
      })
      .addCase(renameChat.fulfilled, (state, action) => {
        const s = state.sessions.find((x) => x.id === action.payload.id);
        if (s) s.title = action.payload.title;
      })
      .addCase(uploadDoc.pending, (state) => {
        state.uploading = true;
      })
      .addCase(uploadDoc.fulfilled, (state, action) => {
        state.uploading = false;
        state.activeDocument = action.payload.document;
        const s = state.sessions.find((x) => x.id === action.payload.id);
        if (s) {
          s.hasDocument = true;
          s.documentName = action.payload.document.name;
        }
      })
      .addCase(uploadDoc.rejected, (state) => {
        state.uploading = false;
      });
  },
});

export const {
  setActive,
  setSearch,
  toggleSidebar,
  pushUserMessage,
  startAssistantMessage,
  appendToken,
  finishAssistantMessage,
  streamError,
} = slice.actions;

export default slice.reducer;

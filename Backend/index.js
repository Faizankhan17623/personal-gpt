import "dotenv/config";
import express from "express";
import cors from "cors";
import route from "./Routing.js";
import { initStore } from "./Store.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors()); // allow the Vite frontend to call this API
app.use(express.json({ limit: "5mb" }));

// health check
app.get("/", (req, res) => res.send("RAG backend is running."));

// mount the API
app.use("/api", route);

// load saved chats from disk into the cache, then start listening
await initStore();

app.listen(PORT, () => {
  console.log(`Running on the port number ${PORT}`);
});

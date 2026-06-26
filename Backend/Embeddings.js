import { embeddings } from "./initialize.js";

// chunks: string[]  ->  number[][]  (one vector per chunk)
export const EmbedDocuments = async (chunks) => {
  try {
    return await embeddings.embedDocuments(chunks);
  } catch (err) {
    throw new Error(`Embedding the document failed: ${err.message}`);
  }
};

// question: string  ->  number[]  (single vector)
export const EmbedQuery = async (question) => {
  try {
    return await embeddings.embedQuery(question);
  } catch (err) {
    throw new Error(`Embedding the question failed: ${err.message}`);
  }
};

// Kept your original name as an alias so nothing else breaks.
export const Embeding = EmbedDocuments;

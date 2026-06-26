import { PineconeEmbeddings } from "@langchain/pinecone";

// Shared instance used across the whole app.
export const embeddings = new PineconeEmbeddings({
  model: "multilingual-e5-large", // dense model -> 1024-dim vectors (matches the 'rag' index)
});

// Kept as a factory too (optional).
export const Initialize = async () => {
  return embeddings;
};

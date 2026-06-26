import "dotenv/config";
import { Pinecone } from "@pinecone-database/pinecone";

export const Pineconeindex = async () => {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is missing. Add it to your .env file.");
  }
  try {
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Uses the index name from your .env (falls back to 'rag2').
    // NOTE: must be a DENSE index (dimension 1024) to match the embeddings.
    return pc.index(process.env.PINECONE_INDEX_NAME || "rag2");
  } catch (err) {
    throw new Error(`Could not connect to Pinecone: ${err.message}`);
  }
};

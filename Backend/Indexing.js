import { Pineconeindex } from "./Pinecone.js";
import { EmbedDocuments, EmbedQuery } from "./Embeddings.js";

// Store every chunk of a document as a vector in Pinecone.
// chunks:    string[]
// namespace: keeps each chat's document isolated from the others.
export const StoreChunks = async (chunks, namespace) => {
  try {
    const index = await Pineconeindex();
    const target = namespace ? index.namespace(namespace) : index;

    // The embedding model accepts at most 96 inputs per call, so embed + upsert
    // in batches instead of sending every chunk at once.
    const BATCH = 96;
    let stored = 0;

    for (let start = 0; start < chunks.length; start += BATCH) {
      const batch = chunks.slice(start, start + BATCH);
      const vectors = await EmbedDocuments(batch);

      const records = vectors.map((values, i) => ({
        id: `chunk-${Date.now()}-${start + i}`,
        values,
        metadata: { text: batch[i] },
      }));

      await target.upsert(records);
      stored += records.length;
    }

    return stored;
  } catch (err) {
    // Most common cause: the Pinecone index is sparse or the wrong dimension.
    if (/sparse|dense|dimension/i.test(err.message || "")) {
      throw new Error(
        "Pinecone index mismatch: it must be a DENSE index with dimension 1024. " +
          `(${err.message})`
      );
    }
    throw new Error(`Failed to store document in Pinecone: ${err.message}`);
  }
};

// Find the chunks most relevant to the user's question (within a namespace).
// Returns the joined text of the top matches (the "context" for the LLM).
export const Retrieve = async (question, topK = 3, namespace) => {
  try {
    const index = await Pineconeindex();
    const target = namespace ? index.namespace(namespace) : index;
    const queryVector = await EmbedQuery(question);

    const result = await target.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
    });

    const context = result.matches
      .map((m) => m.metadata?.text)
      .filter(Boolean)
      .join("\n\n");

    return context;
  } catch (err) {
    // Retrieval failing shouldn't kill the whole chat — fall back to no context
    // so the model can still answer from general knowledge.
    console.error("Retrieve failed, continuing without document context:", err.message);
    return "";
  }
};

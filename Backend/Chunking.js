import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export const TextSplitter = async (text) => {
  const NewSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const texts = await NewSplitter.splitText(text); 
  return texts; 
};

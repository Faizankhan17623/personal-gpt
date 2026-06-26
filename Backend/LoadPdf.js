import { PDFParse } from "pdf-parse";
import { readFile } from "fs/promises";
import mammoth from "mammoth";
import path from "path";

// Extract plain text from an uploaded file (pdf / docx / doc / txt / md).
// Accepts a full local path (multer saves uploads to disk).
export async function extractText(filePath, originalName = "") {
  const ext = path.extname(originalName || filePath).toLowerCase();

  try {
    if (ext === ".pdf") {
      const buffer = await readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text;
    }

    if (ext === ".docx" || ext === ".doc") {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    if (ext === ".txt" || ext === ".md") {
      return await readFile(filePath, "utf8");
    }
  } catch (err) {
    throw new Error(
      `Could not read text from the ${ext || "file"}: ${err.message}`
    );
  }

  throw new Error(`Unsupported file type: ${ext}. Use pdf, docx, txt or md.`);
}

// --- kept for backward compatibility with the original ingest route -------
export async function PdfLoading(filePath) {
  const isUrl = /^https?:\/\//i.test(filePath);
  if (isUrl) {
    const parser = new PDFParse({ url: filePath });
    const result = await parser.getText();
    return result.text;
  }
  return extractText(filePath, filePath);
}

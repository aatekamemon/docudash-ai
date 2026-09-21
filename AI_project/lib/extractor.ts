import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { extractText as extractPdfText } from "unpdf";

/**
 * Extracts readable plain text from a file buffer based on its extension/type.
 * Supports: .docx, .doc, .pdf, .xlsx, .xls, .csv, .txt
 * Gracefully returns null if extraction fails or if the file contains no text layer.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileType: string
): Promise<string | null> {
  const normalizedType = fileType.toLowerCase().replace(".", "").trim();

  try {
    if (normalizedType === "docx" || normalizedType === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim();
      return text && text.length > 0 ? text : null;
    }

    if (normalizedType === "pdf") {
      const uint8Array = new Uint8Array(buffer);
      const { text } = await extractPdfText(uint8Array);
      const fullText = Array.isArray(text) ? text.join("\n").trim() : (text as string)?.trim();
      return fullText && fullText.length > 0 ? fullText : null;
    }

    if (
      normalizedType === "xlsx" ||
      normalizedType === "xls" ||
      normalizedType === "csv"
    ) {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetTexts: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv && csv.trim().length > 0) {
            sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
          }
        }
      }

      const fullText = sheetTexts.join("\n\n").trim();
      return fullText.length > 0 ? fullText : null;
    }

    if (normalizedType === "txt") {
      const text = buffer.toString("utf-8").trim();
      return text.length > 0 ? text : null;
    }

    return null;
  } catch (error) {
    console.error(`[Text Extraction Error] for file type "${fileType}":`, error);
    return null;
  }
}

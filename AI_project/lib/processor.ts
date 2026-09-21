import { supabase } from "@/lib/supabase/client";
import { chunkText } from "@/lib/chunker";
import { generateEmbeddings } from "@/lib/embeddings";

export interface ProcessDocumentResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  error?: string;
}

/**
 * Chunks a document's extracted_text, generates 384-d vector embeddings,
 * and saves the chunks into the `document_chunks` table in Supabase.
 */
export async function processDocumentChunks(
  documentId: string
): Promise<ProcessDocumentResult> {
  try {
    // 1. Fetch document text
    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("id, file_name, extracted_text")
      .eq("id", documentId)
      .single();

    if (fetchErr || !doc) {
      return {
        success: false,
        documentId,
        chunkCount: 0,
        error: fetchErr?.message || "Document not found",
      };
    }

    if (!doc.extracted_text || doc.extracted_text.trim().length === 0) {
      return {
        success: false,
        documentId,
        chunkCount: 0,
        error: "Document has no extracted text to chunk.",
      };
    }

    // 2. Split into 300-500 word chunks with ~50 words overlap
    const chunks = chunkText(doc.extracted_text, 400, 50);

    if (chunks.length === 0) {
      return {
        success: true,
        documentId,
        chunkCount: 0,
      };
    }

    // 3. Generate embeddings using Xenova/all-MiniLM-L6-v2
    const chunkTexts = chunks.map((c) => c.chunk_text);
    const embeddings = await generateEmbeddings(chunkTexts);

    // 4. Clean up any previous chunks for this document (idempotent)
    await supabase.from("document_chunks").delete().eq("document_id", documentId);

    // 5. Prepare rows for insertion
    const rowsToInsert = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_text: chunk.chunk_text,
      chunk_index: chunk.chunk_index,
      embedding: embeddings[index],
    }));

    // Insert in batches of 50
    const batchSize = 50;
    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize);
      const { error: insertErr } = await supabase
        .from("document_chunks")
        .insert(batch);

      if (insertErr) {
        throw new Error(`Failed to insert document chunks: ${insertErr.message}`);
      }
    }

    return {
      success: true,
      documentId,
      chunkCount: chunks.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error processing chunks";
    return {
      success: false,
      documentId,
      chunkCount: 0,
      error: message,
    };
  }
}

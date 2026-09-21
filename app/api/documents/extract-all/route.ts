import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { extractTextFromBuffer } from "@/lib/extractor";

export async function POST() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase credentials are not configured." },
        { status: 500 }
      );
    }

    // 1. Fetch all documents where extracted_text is null or empty
    const { data: docs, error: fetchErr } = await supabase
      .from("documents")
      .select("id, file_name, file_type, storage_path, extracted_text");

    if (fetchErr) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch documents: ${fetchErr.message}` },
        { status: 500 }
      );
    }

    const allDocuments = docs || [];
    const pendingDocs = allDocuments.filter(
      (d) => !d.extracted_text || d.extracted_text.trim().length === 0
    );

    if (pendingDocs.length === 0) {
      return NextResponse.json({
        success: true,
        extractedCount: 0,
        skippedCount: allDocuments.length,
        totalDocuments: allDocuments.length,
        message: `All ${allDocuments.length} documents already have text extracted.`,
      });
    }

    let extractedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 2. Process each pending document
    for (const doc of pendingDocs) {
      try {
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("documents")
          .download(doc.storage_path);

        if (downloadErr || !fileData) {
          throw new Error(downloadErr?.message || "Storage download failed");
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extract text
        const extractedText = await extractTextFromBuffer(buffer, doc.file_type);

        if (extractedText && extractedText.length > 0) {
          const { error: updateErr } = await supabase
            .from("documents")
            .update({ extracted_text: extractedText })
            .eq("id", doc.id);

          if (updateErr) {
            throw new Error(`DB update error: ${updateErr.message}`);
          }

          extractedCount++;
        } else {
          // Leave as null / log
          console.warn(`[Extraction Note] No text extracted from "${doc.file_name}" (may be empty or image scan).`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Extraction failed";
        console.error(`Failed to extract text for "${doc.file_name}":`, msg);
        errors.push(`${doc.file_name}: ${msg}`);
        failedCount++;
      }
    }

    const alreadyHadText = allDocuments.length - pendingDocs.length;
    const message = `Extracted text from ${extractedCount} document${
      extractedCount === 1 ? "" : "s"
    }${alreadyHadText > 0 ? ` (${alreadyHadText} already had text)` : ""}.`;

    return NextResponse.json({
      success: true,
      extractedCount,
      failedCount,
      totalProcessed: pendingDocs.length,
      totalDocuments: allDocuments.length,
      message,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Bulk extraction failed.";
    console.error("Bulk extraction error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

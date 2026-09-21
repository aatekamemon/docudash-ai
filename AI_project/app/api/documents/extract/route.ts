import { processDocumentChunks } from "@/lib/processor";
import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { extractTextFromBuffer } from "@/lib/extractor";

export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase credentials are not configured." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "documentId is required." },
        { status: 400 }
      );
    }

    // 1. Fetch document record
    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("id, file_name, file_type, storage_path, extracted_text")
      .eq("id", documentId)
      .single();

    if (fetchErr || !doc) {
      return NextResponse.json(
        { success: false, error: `Document not found: ${fetchErr?.message}` },
        { status: 404 }
      );
    }

    // 2. Download file from Supabase storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadErr || !fileData) {
      return NextResponse.json(
        { success: false, error: `Storage download failed: ${downloadErr?.message}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Extract text
    const extractedText = await extractTextFromBuffer(buffer, doc.file_type);

    // 4. Update row in documents table
    const { error: updateErr } = await supabase
      .from("documents")
      .update({ extracted_text: extractedText })
      .eq("id", documentId);

    if (updateErr) {
      return NextResponse.json(
        { success: false, error: `Database update failed: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // 5. Automatically generate vector chunks & embeddings
    try {
      await processDocumentChunks(documentId);
    } catch (chunkErr) {
      console.warn("Auto-generation of embeddings failed:", chunkErr);
    }

    return NextResponse.json({
      success: true,
      documentId,
      hasText: !!extractedText,
      textLength: extractedText?.length || 0,
      preview: extractedText ? extractedText.slice(0, 200) : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Text extraction failed.";
    console.error("Single document extraction error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

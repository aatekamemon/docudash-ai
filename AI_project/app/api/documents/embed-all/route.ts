import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { processDocumentChunks } from "@/lib/processor";

export async function POST() {
    try {
        if (!isSupabaseConfigured()) {
            return NextResponse.json(
                { success: false, error: "Supabase credentials are not configured." },
                { status: 500 }
            );
        }

        // 1. Fetch documents with extracted text
        const { data: docs, error: fetchErr } = await supabase
            .from("documents")
            .select("id, file_name, extracted_text");

        if (fetchErr) {
            return NextResponse.json(
                { success: false, error: `Failed to fetch documents: ${fetchErr.message}` },
                { status: 500 }
            );
        }

        const docsWithText = (docs || []).filter(
            (d) => d.extracted_text && d.extracted_text.trim().length > 0
        );

        if (docsWithText.length === 0) {
            return NextResponse.json({
                success: true,
                processedCount: 0,
                totalChunksCreated: 0,
                message: "No documents have extracted text to embed. Run text extraction first.",
            });
        }

        // 2. Find documents that already have chunks
        const { data: existingChunks } = await supabase
            .from("document_chunks")
            .select("document_id");

        const documentsWithChunks = new Set<string>(
            (existingChunks || []).map((c) => c.document_id)
        );

        const pendingDocs = docsWithText.filter((d) => !documentsWithChunks.has(d.id));

        if (pendingDocs.length === 0) {
            return NextResponse.json({
                success: true,
                processedCount: 0,
                totalChunksCreated: 0,
                totalDocumentsWithChunks: documentsWithChunks.size,
                message: `All ${docsWithText.length} documents with text already have embeddings generated.`,
            });
        }

        let processedCount = 0;
        let totalChunksCreated = 0;
        const errors: string[] = [];

        // 3. Process documents sequentially
        for (const doc of pendingDocs) {
            const result = await processDocumentChunks(doc.id);
            if (result.success) {
                processedCount++;
                totalChunksCreated += result.chunkCount;
            } else {
                errors.push(`${doc.file_name}: ${result.error}`);
            }
        }

        const message = `Generated ${totalChunksCreated} chunks with 384-d embeddings across ${processedCount} document${processedCount === 1 ? "" : "s"
            }.`;

        return NextResponse.json({
            success: true,
            processedCount,
            totalChunksCreated,
            totalPending: pendingDocs.length,
            message,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Bulk embedding generation failed.";
        console.error("Bulk embedding error:", error);
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}

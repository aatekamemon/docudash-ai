import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase credentials are not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { query, matchCount = 5, threshold = 0.2 } = body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Query text is required." },
        { status: 400 }
      );
    }

    // 1. Generate 384-d query embedding
    const queryEmbedding = await generateEmbedding(query.trim());

    // 2. Call Postgres match_document_chunks function
    const { data: matches, error: rpcErr } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: matchCount,
      }
    );

    if (rpcErr) {
      return NextResponse.json(
        { success: false, error: `Similarity search error: ${rpcErr.message}` },
        { status: 500 }
      );
    }

    // 3. Enrich with document metadata
    const matchedChunks = matches || [];
    const documentIds = Array.from(
      new Set(matchedChunks.map((m: { document_id: string }) => m.document_id))
    );

    let docMap: Record<string, { file_name: string; category: string; file_type: string }> = {};

    if (documentIds.length > 0) {
      const { data: docData } = await supabase
        .from("documents")
        .select("id, file_name, category, file_type")
        .in("id", documentIds);

      if (docData) {
        docMap = docData.reduce((acc, curr) => {
          acc[curr.id] = {
            file_name: curr.file_name,
            category: curr.category,
            file_type: curr.file_type,
          };
          return acc;
        }, {} as Record<string, { file_name: string; category: string; file_type: string }>);
      }
    }

    const results = matchedChunks.map(
      (chunk: {
        id: string;
        document_id: string;
        chunk_text: string;
        chunk_index: number;
        similarity: number;
      }) => ({
        chunkId: chunk.id,
        documentId: chunk.document_id,
        chunkIndex: chunk.chunk_index,
        similarity: Number((chunk.similarity * 100).toFixed(2)),
        chunkText: chunk.chunk_text,
        document: docMap[chunk.document_id] || null,
      })
    );

    return NextResponse.json({
      success: true,
      query,
      matchCount: results.length,
      results,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Search query failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

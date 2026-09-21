import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database not configured." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("id");

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "Document ID is required." },
        { status: 400 }
      );
    }

    // 1. Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { success: false, error: "Document not found." },
        { status: 404 }
      );
    }

    // 2. Fetch document chunks
    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("id, chunk_index, chunk_text")
      .eq("document_id", documentId)
      .order("chunk_index", { ascending: true });

    const ext = doc.file_type.toLowerCase().replace(".", "");

    // Public URL for direct viewing / downloading
    const { data: pubUrlData } = supabase.storage
      .from("documents")
      .getPublicUrl(doc.storage_path);
    const publicUrl = pubUrlData.publicUrl;

    // 3. For PDFs, the browser's built-in PDF viewer can read publicUrl directly
    if (ext === "pdf") {
      return NextResponse.json({
        success: true,
        document: doc,
        viewType: "pdf",
        publicUrl,
        chunks: chunks || [],
      });
    }

    // 4. For DOCX and XLSX, download buffer from Supabase Storage to render rich HTML
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      // Fallback to text view if file download fails
      return NextResponse.json({
        success: true,
        document: doc,
        viewType: "text",
        publicUrl,
        text: doc.extracted_text || "No text available.",
        chunks: chunks || [],
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Format DOCX to HTML via Mammoth
    if (ext === "docx" || ext === "doc") {
      try {
        const result = await mammoth.convertToHtml({ buffer });
        return NextResponse.json({
          success: true,
          document: doc,
          viewType: "docx",
          publicUrl,
          html: result.value || "<p>Empty document.</p>",
          chunks: chunks || [],
        });
      } catch (err: unknown) {
        console.warn("Mammoth conversion warning:", err);
        return NextResponse.json({
          success: true,
          document: doc,
          viewType: "text",
          publicUrl,
          text: doc.extracted_text || "Unable to render formatted view.",
          chunks: chunks || [],
        });
      }
    }

    // Format XLSX / CSV to HTML tables via SheetJS
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      try {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheets = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const html = XLSX.utils.sheet_to_html(worksheet, {
            header: "",
            footer: "",
          });
          return { name: sheetName, html };
        });

        return NextResponse.json({
          success: true,
          document: doc,
          viewType: "xlsx",
          publicUrl,
          sheets,
          chunks: chunks || [],
        });
      } catch (err: unknown) {
        console.warn("SheetJS conversion warning:", err);
        return NextResponse.json({
          success: true,
          document: doc,
          viewType: "text",
          publicUrl,
          text: doc.extracted_text || "Unable to render spreadsheet view.",
          chunks: chunks || [],
        });
      }
    }

    // Default text view
    return NextResponse.json({
      success: true,
      document: doc,
      viewType: "text",
      publicUrl,
      text: doc.extracted_text || "No preview available.",
      chunks: chunks || [],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load document preview.";
    console.error("Document preview route error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

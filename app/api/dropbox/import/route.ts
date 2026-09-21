import { processDocumentChunks } from "@/lib/processor";
import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { FileCategory } from "@/lib/types";
import { extractTextFromBuffer } from "@/lib/extractor";

interface ChooserFile {
  id?: string;
  name: string;
  link: string;
  bytes?: number;
  icon?: string;
}

function determineCategory(fileName: string): FileCategory {
  const text = fileName.toLowerCase();

  const legalKeywords = [
    "policy", "policies", "ethics", "data-protection", "cyber-security",
    "cyber security", "byod", "agreement", "nda", "contract", "compliance",
    "terms", "privacy", "consent", "breach", "verification", "esop",
  ];
  if (legalKeywords.some((kw) => text.includes(kw))) return "Legal";

  const financeKeywords = [
    "finance", "financial", "statement", "invoice", "tax", "payable",
    "receivable", "balance", "budget", "audit", "bank", "payslip",
    "salary", "bonus", "compensation", "credit card", "expense",
    "revenue", "ledger", "p&l", "accounting",
  ];
  if (financeKeywords.some((kw) => text.includes(kw))) return "Finance";

  const hrKeywords = [
    "hr", "employee", "onboarding", "candidate", "interview", "resume",
    "hiring", "hire", "termination", "job offer", "rejection", "welcome email",
    "welcome package", "appraisal", "performance review", "leave", "handbook",
    "behavior", "appreciation", "exit process", "exit interview", "clearance",
    "relieving", "formalities", "engagement", "birthday", "disciplinary",
    "transfer", "promotion", "courses", "activities planner",
    "learning and development", "l&d",
  ];
  if (hrKeywords.some((kw) => text.includes(kw))) return "HR";

  const engineeringKeywords = [
    "engineering", "architecture", "roadmap", "api", "tech", "spec",
    "dev", "release", "database", "system", "infrastructure", "code",
  ];
  if (engineeringKeywords.some((kw) => text.includes(kw))) return "Engineering";

  const marketingKeywords = [
    "marketing", "campaign", "branding", "social", "advertisement", "press",
  ];
  if (marketingKeywords.some((kw) => text.includes(kw))) return "Marketing";

  return "General";
}

export async function POST(req: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database is not configured." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const files: ChooserFile[] = body.files;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided to import." },
        { status: 400 }
      );
    }

    // Fetch existing documents to avoid duplicate entries
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("id, file_name");

    const existingNames = new Set(
      (existingDocs || []).map((d) => d.file_name.toLowerCase())
    );

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      if (existingNames.has(file.name.toLowerCase())) {
        skippedCount++;
        continue;
      }

      try {
        // Download the file via the direct link provided by Dropbox Chooser
        const downloadRes = await fetch(file.link);
        if (!downloadRes.ok) {
          throw new Error(
            `Failed to download ${file.name} (${downloadRes.status} ${downloadRes.statusText})`
          );
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileExt = file.name.split(".").pop()?.toLowerCase() || "txt";
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `dropbox/${timestamp}_${sanitizedName}`;
        const category = determineCategory(file.name);

        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, buffer, {
            contentType: "application/octet-stream",
            upsert: false,
          });

        if (storageError) {
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }

        // Extract text
        const extractedText = await extractTextFromBuffer(buffer, fileExt);

        // Insert into documents table
        const { data: insertedDoc, error: insertError } = await supabase.from("documents").insert([
          {
            file_name: file.name,
            file_type: fileExt,
            category,
            storage_path: storagePath,
            drive_file_id: file.id || `dropbox_${timestamp}`,
            extracted_text: extractedText,
            uploaded_at: new Date().toISOString(),
          },
        ]).select("id").single();

        // Automatically generate vector chunks & embeddings
        if (insertedDoc?.id) {
          try {
            await processDocumentChunks(insertedDoc.id);
          } catch (embedErr) {
            console.warn(`Auto-embed error for ${file.name}:`, embedErr);
          }
        }

        if (insertError) {
          await supabase.storage.from("documents").remove([storagePath]);
          throw new Error(`DB insert failed: ${insertError.message}`);
        }

        existingNames.add(file.name.toLowerCase());
        importedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Import error for ${file.name}:`, msg);
        errors.push(`${file.name}: ${msg}`);
      }
    }

    let message = "";
    if (importedCount > 0) {
      message = `${importedCount} file${importedCount === 1 ? "" : "s"} imported, text extracted, and vector embeddings generated from Dropbox.`;
      if (skippedCount > 0) {
        message += ` (${skippedCount} already existed)`;
      }
    } else if (skippedCount > 0) {
      message = `All ${skippedCount} selected file${skippedCount === 1 ? "" : "s"} are already in your documents library.`;
    } else {
      message = "No files were imported.";
    }

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Dropbox import failed.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

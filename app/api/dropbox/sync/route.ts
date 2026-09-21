import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { FileCategory } from "@/lib/types";
import { extractTextFromBuffer } from "@/lib/extractor";

interface DropboxFileEntry {
  ".tag": "file" | "folder" | "deleted";
  name: string;
  id: string;
  path_lower: string;
  path_display: string;
  size: number;
}

interface DropboxListResponse {
  entries: DropboxFileEntry[];
  cursor: string;
  has_more: boolean;
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

const SUPPORTED_EXTS = new Set(["pdf", "docx", "xlsx", "txt", "csv"]);

export async function POST() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database is not configured." },
        { status: 500 }
      );
    }

    const token = process.env.DROPBOX_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "DROPBOX_ACCESS_TOKEN is missing in .env.local" },
        { status: 400 }
      );
    }

    // Step 1: List all files recursively from Dropbox root
    const allFiles: DropboxFileEntry[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      const url = cursor
        ? "https://api.dropboxapi.com/2/files/list_folder/continue"
        : "https://api.dropboxapi.com/2/files/list_folder";

      const payload = cursor
        ? { cursor }
        : { path: "", recursive: true, include_deleted: false };

      const listRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!listRes.ok) {
        const errorText = await listRes.text();
        return NextResponse.json(
          { success: false, error: `Dropbox API error: ${errorText}` },
          { status: listRes.status }
        );
      }

      const listData: DropboxListResponse = await listRes.json();
      for (const item of listData.entries) {
        if (item[".tag"] === "file") {
          const ext = item.name.split(".").pop()?.toLowerCase() || "";
          if (SUPPORTED_EXTS.has(ext)) {
            allFiles.push(item);
          }
        }
      }

      hasMore = listData.has_more;
      cursor = listData.cursor;
    }

    if (allFiles.length === 0) {
      return NextResponse.json({
        success: true,
        syncedCount: 0,
        skippedCount: 0,
        message: "No supported documents (PDF, DOCX, XLSX, TXT) found in your Dropbox.",
      });
    }

    // Step 2: Fetch existing documents in Supabase to avoid duplicates
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("id, drive_file_id, file_name");

    const syncedIds = new Set<string>();
    const syncedNames = new Set<string>();
    (existingDocs || []).forEach((doc) => {
      if (doc.drive_file_id) syncedIds.add(doc.drive_file_id);
      if (doc.file_name) syncedNames.add(doc.file_name.toLowerCase());
    });

    let syncedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Step 3: Download, extract, upload & save each file
    for (const file of allFiles) {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "txt";

      if (syncedIds.has(file.id) || syncedNames.has(file.name.toLowerCase())) {
        skippedCount++;
        continue;
      }

      try {
        // Download binary file from Dropbox content API
        const downloadRes = await fetch("https://content.dropboxapi.com/2/files/download", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({ path: file.path_lower }),
          },
        });

        if (!downloadRes.ok) {
          throw new Error(`Download failed (${downloadRes.status} ${downloadRes.statusText})`);
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `dropbox/${timestamp}_${sanitizedName}`;

        const determinedCategory = determineCategory(file.name);

        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, buffer, {
            contentType: "application/octet-stream",
            upsert: false,
          });

        if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

        // Extract text
        const extractedText = await extractTextFromBuffer(buffer, fileExt);

        // Insert into Supabase documents table
        const { error: insertError } = await supabase.from("documents").insert([
          {
            file_name: file.name,
            file_type: fileExt,
            category: determinedCategory,
            storage_path: storagePath,
            drive_file_id: file.id,
            extracted_text: extractedText,
            uploaded_at: new Date().toISOString(),
          },
        ]);

        if (insertError) {
          await supabase.storage.from("documents").remove([storagePath]);
          throw new Error(`DB insert failed: ${insertError.message}`);
        }

        syncedIds.add(file.id);
        syncedNames.add(file.name.toLowerCase());
        syncedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error syncing "${file.name}":`, msg);
        errors.push(`${file.name}: ${msg}`);
      }
    }

    let message = "";
    if (syncedCount > 0) {
      message = `${syncedCount} new ${syncedCount === 1 ? "file" : "files"} synced, categorized, and text-extracted from Dropbox.`;
      if (skippedCount > 0) message += ` (${skippedCount} already up to date)`;
    } else if (skippedCount > 0) {
      message = `All ${skippedCount} files from Dropbox are already synced.`;
    } else {
      message = "No matching files were found to sync.";
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Dropbox sync failed.";
    console.error("Dropbox sync route error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

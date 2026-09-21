import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { FileCategory } from "@/lib/types";
import { extractTextFromBuffer } from "@/lib/extractor";
import { processDocumentChunks } from "@/lib/processor";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDE_MIME = "application/vnd.google-apps.presentation";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";

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

async function collectFolderFiles(folderId: string, accessToken: string): Promise<string[]> {
  const collectedIds: string[] = [];
  const folderQueue: string[] = [folderId];
  const visited = new Set<string>();

  const supportedExtensions = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".csv", ".pptx"];

  while (folderQueue.length > 0) {
    const current = folderQueue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    let pageToken: string | undefined = undefined;
    while (true) {
      const q = `'${current}' in parents and trashed = false`;
      let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,mimeType)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) break;

      const data = await res.json();
      for (const item of data.files || []) {
        if (item.mimeType === GOOGLE_FOLDER_MIME) {
          folderQueue.push(item.id);
        } else {
          const isDoc = item.mimeType === GOOGLE_DOC_MIME;
          const isSheet = item.mimeType === GOOGLE_SHEET_MIME;
          const isSlide = item.mimeType === GOOGLE_SLIDE_MIME;
          const hasExt = supportedExtensions.some((ext) => item.name.toLowerCase().endsWith(ext));
          if (isDoc || isSheet || isSlide || hasExt) {
            collectedIds.push(item.id);
          }
        }
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
  }

  return collectedIds;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "Google Drive is not connected. Please sign in." },
        { status: 401 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Database is not configured." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const directFileIds: string[] = body.fileIds || [];
    const folderIds: string[] = body.folderIds || [];

    if (directFileIds.length === 0 && folderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files or folders selected for import." },
        { status: 400 }
      );
    }

    const accessToken = session.accessToken;

    // Resolve any folder IDs into document file IDs
    const resolvedFileIds = new Set<string>(directFileIds);
    for (const folderId of folderIds) {
      const folderFiles = await collectFolderFiles(folderId, accessToken);
      folderFiles.forEach((fId) => resolvedFileIds.add(fId));
    }

    const fileIds = Array.from(resolvedFileIds);

    if (fileIds.length === 0) {
      return NextResponse.json({
        success: true,
        importedCount: 0,
        skippedCount: 0,
        message: "No supported documents (Word, Excel, PDF) were found in the selected folders.",
      });
    }

    // Fetch existing documents to avoid duplicates
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("id, drive_file_id, file_name");

    const existingDriveIds = new Set<string>();
    const existingNames = new Set<string>();
    (existingDocs || []).forEach((d) => {
      if (d.drive_file_id) existingDriveIds.add(d.drive_file_id);
      if (d.file_name) existingNames.add(d.file_name.toLowerCase());
    });

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const fileId of fileIds) {
      try {
        // Fetch metadata
        const metaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!metaRes.ok) {
          throw new Error(`Failed to fetch metadata for file ID ${fileId}`);
        }

        const fileMeta = await metaRes.json();
        let finalFileName = fileMeta.name;
        let actualMimeType = fileMeta.mimeType;
        let downloadUrl = "";
        let fileExt = fileMeta.name.split(".").pop()?.toLowerCase() || "txt";
        let targetContentType = actualMimeType;

        if (actualMimeType === GOOGLE_DOC_MIME) {
          targetContentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(targetContentType)}`;
          if (!finalFileName.toLowerCase().endsWith(".docx")) finalFileName += ".docx";
          fileExt = "docx";
        } else if (actualMimeType === GOOGLE_SHEET_MIME) {
          targetContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(targetContentType)}`;
          if (!finalFileName.toLowerCase().endsWith(".xlsx")) finalFileName += ".xlsx";
          fileExt = "xlsx";
        } else if (actualMimeType === GOOGLE_SLIDE_MIME) {
          targetContentType = "application/pdf";
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(targetContentType)}`;
          if (!finalFileName.toLowerCase().endsWith(".pdf")) finalFileName += ".pdf";
          fileExt = "pdf";
        } else {
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        }

        // Check if duplicate
        if (existingDriveIds.has(fileId) || existingNames.has(finalFileName.toLowerCase())) {
          skippedCount++;
          continue;
        }

        // Download binary file
        const downloadRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!downloadRes.ok) {
          throw new Error(`Download failed (${downloadRes.status} ${downloadRes.statusText})`);
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const timestamp = Date.now();
        const sanitizedName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `google-drive/${timestamp}_${sanitizedName}`;
        const category = determineCategory(finalFileName);

        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, buffer, {
            contentType: targetContentType || "application/octet-stream",
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
            file_name: finalFileName,
            file_type: fileExt,
            category,
            storage_path: storagePath,
            drive_file_id: fileId,
            extracted_text: extractedText,
            uploaded_at: new Date().toISOString(),
          },
        ]).select("id").single();

        if (insertError) {
          await supabase.storage.from("documents").remove([storagePath]);
          throw new Error(`DB insert failed: ${insertError.message}`);
        }

        // Automatically generate vector chunks & embeddings immediately!
        if (insertedDoc?.id) {
          try {
            await processDocumentChunks(insertedDoc.id);
          } catch (chunkErr) {
            console.warn(`Auto-embed error for ${finalFileName}:`, chunkErr);
          }
        }

        existingDriveIds.add(fileId);
        existingNames.add(finalFileName.toLowerCase());
        importedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Import error for ${fileId}:`, msg);
        errors.push(`File ${fileId}: ${msg}`);
      }
    }

    let message = "";
    if (importedCount > 0) {
      message = `${importedCount} file${importedCount === 1 ? "" : "s"} imported, text extracted, and vector embeddings generated from Google Drive.`;
      if (skippedCount > 0) message += ` (${skippedCount} already existed in library)`;
    } else if (skippedCount > 0) {
      message = `All ${skippedCount} selected file${skippedCount === 1 ? "" : "s"} already exist in your documents library.`;
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
    const msg = error instanceof Error ? error.message : "Google Drive import failed.";
    console.error("Drive import error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

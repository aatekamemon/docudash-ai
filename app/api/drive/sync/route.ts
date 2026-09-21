import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { FileCategory } from "@/lib/types";
import { extractTextFromBuffer } from "@/lib/extractor";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDE_MIME = "application/vnd.google-apps.presentation";
const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";
const GOOGLE_SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  parentFolderName?: string;
  shortcutDetails?: {
    targetId: string;
    targetMimeType: string;
  };
}

function extractFolderId(rawIdOrUrl?: string): string | undefined {
  if (!rawIdOrUrl) return undefined;
  const trimmed = rawIdOrUrl.trim();
  const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return trimmed;
}

function determineCategory(fileName: string, parentFolderName?: string): FileCategory {
  const text = `${parentFolderName || ""} ${fileName}`.toLowerCase();

  const legalKeywords = [
    "policy",
    "policies",
    "ethics",
    "data-protection",
    "cyber-security",
    "cyber security",
    "byod",
    "agreement",
    "nda",
    "contract",
    "compliance",
    "terms",
    "privacy",
    "consent",
    "breach",
    "verification",
    "esop",
  ];
  if (legalKeywords.some((kw) => text.includes(kw))) {
    return "Legal";
  }

  const financeKeywords = [
    "finance",
    "financial",
    "statement",
    "invoice",
    "tax",
    "payable",
    "receivable",
    "balance",
    "budget",
    "audit",
    "bank",
    "payslip",
    "salary",
    "bonus",
    "compensation",
    "credit card",
    "expense",
    "revenue",
    "ledger",
    "p&l",
    "accounting",
  ];
  if (financeKeywords.some((kw) => text.includes(kw))) {
    return "Finance";
  }

  const hrKeywords = [
    "hr",
    "employee",
    "onboarding",
    "candidate",
    "interview",
    "resume",
    "hiring",
    "hire",
    "termination",
    "job offer",
    "rejection",
    "welcome email",
    "welcome package",
    "appraisal",
    "performance review",
    "leave",
    "handbook",
    "behavior",
    "appreciation",
    "exit process",
    "exit interview",
    "clearance",
    "relieving",
    "formalities",
    "engagement",
    "birthday",
    "disciplinary",
    "transfer",
    "promotion",
    "courses",
    "activities planner",
    "learning and development",
    "l&d",
  ];
  if (hrKeywords.some((kw) => text.includes(kw))) {
    return "HR";
  }

  const engineeringKeywords = [
    "engineering",
    "architecture",
    "roadmap",
    "api",
    "tech",
    "spec",
    "dev",
    "release",
    "database",
    "system",
    "infrastructure",
    "code",
  ];
  if (engineeringKeywords.some((kw) => text.includes(kw))) {
    return "Engineering";
  }

  const marketingKeywords = [
    "marketing",
    "campaign",
    "branding",
    "social",
    "advertisement",
    "press",
    "pitch",
    "brochure",
    "seo",
    "content",
  ];
  if (marketingKeywords.some((kw) => text.includes(kw))) {
    return "Marketing";
  }

  return "General";
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "Google Drive is not connected." },
        { status: 401 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { success: false, error: "Supabase credentials are not configured." },
        { status: 500 }
      );
    }

    const accessToken: string = session.accessToken;
    const rawFolderInput = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const rootFolderId = extractFolderId(rawFolderInput);

    const eligibleFilesMap = new Map<string, DriveItem>();
    const folderNamesMap = new Map<string, string>();

    if (rootFolderId) {
      folderNamesMap.set(rootFolderId, "Root");

      const folderQueue: string[] = [rootFolderId];
      const visitedFolders = new Set<string>();

      while (folderQueue.length > 0) {
        const currentFolderId = folderQueue.shift()!;
        if (visitedFolders.has(currentFolderId)) continue;
        visitedFolders.add(currentFolderId);

        let pageToken: string | undefined = undefined;
        while (true) {
          let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
            `'${currentFolderId}' in parents and trashed = false`
          )}&fields=nextPageToken,files(id,name,mimeType,parents,shortcutDetails)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

          if (pageToken) {
            url += `&pageToken=${encodeURIComponent(pageToken)}`;
          }

          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!res.ok) break;

          const data: { files?: DriveItem[]; nextPageToken?: string } = await res.json();

          for (const item of data.files || []) {
            if (item.mimeType === GOOGLE_FOLDER_MIME) {
              folderQueue.push(item.id);
              folderNamesMap.set(item.id, item.name);
            } else {
              item.parentFolderName = folderNamesMap.get(currentFolderId);
              eligibleFilesMap.set(item.id, item);
            }
          }

          pageToken = data.nextPageToken;
          if (!pageToken) break;
        }
      }

      // Pass 2: Global query
      let globalPageToken: string | undefined = undefined;
      while (true) {
        let globalUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          "trashed = false and mimeType != 'application/vnd.google-apps.folder'"
        )}&fields=nextPageToken,files(id,name,mimeType,parents,shortcutDetails)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

        if (globalPageToken) {
          globalUrl += `&pageToken=${encodeURIComponent(globalPageToken)}`;
        }

        const res = await fetch(globalUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) break;

        const data: { files?: DriveItem[]; nextPageToken?: string } = await res.json();

        for (const item of data.files || []) {
          const matchingParentId = item.parents?.find((p) => folderNamesMap.has(p));
          if (matchingParentId) {
            item.parentFolderName = folderNamesMap.get(matchingParentId);
            eligibleFilesMap.set(item.id, item);
          }
        }

        globalPageToken = data.nextPageToken;
        if (!globalPageToken) break;
      }
    } else {
      let pageToken: string | undefined = undefined;
      while (true) {
        let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          "trashed = false and mimeType != 'application/vnd.google-apps.folder'"
        )}&fields=nextPageToken,files(id,name,mimeType,parents,shortcutDetails)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`;

        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) break;

        const data: { files?: DriveItem[]; nextPageToken?: string } = await res.json();
        for (const item of data.files || []) {
          eligibleFilesMap.set(item.id, item);
        }

        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    }

    const eligibleFiles = Array.from(eligibleFilesMap.values());

    const { data: existingDocs } = await supabase
      .from("documents")
      .select("id, drive_file_id, file_name");

    const syncedDriveIds = new Set<string>();
    const syncedNames = new Set<string>();

    (existingDocs || []).forEach((doc) => {
      if (doc.drive_file_id) syncedDriveIds.add(doc.drive_file_id);
      if (doc.file_name) syncedNames.add(doc.file_name.toLowerCase());
    });

    let syncedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const file of eligibleFiles) {
      let actualFileId = file.id;
      let actualMimeType = file.mimeType;

      if (file.mimeType === GOOGLE_SHORTCUT_MIME && file.shortcutDetails) {
        actualFileId = file.shortcutDetails.targetId;
        actualMimeType = file.shortcutDetails.targetMimeType;
      }

      let downloadUrl = "";
      let targetMimeType = actualMimeType;
      let finalFileName = file.name;
      let fileExt = file.name.split(".").pop()?.toLowerCase() || "file";

      if (actualMimeType === GOOGLE_DOC_MIME) {
        targetMimeType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${actualFileId}/export?mimeType=${encodeURIComponent(
          targetMimeType
        )}`;
        if (!finalFileName.toLowerCase().endsWith(".docx")) finalFileName += ".docx";
        fileExt = "docx";
      } else if (actualMimeType === GOOGLE_SHEET_MIME) {
        targetMimeType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${actualFileId}/export?mimeType=${encodeURIComponent(
          targetMimeType
        )}`;
        if (!finalFileName.toLowerCase().endsWith(".xlsx")) finalFileName += ".xlsx";
        fileExt = "xlsx";
      } else if (actualMimeType === GOOGLE_SLIDE_MIME) {
        targetMimeType = "application/pdf";
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${actualFileId}/export?mimeType=${encodeURIComponent(
          targetMimeType
        )}`;
        if (!finalFileName.toLowerCase().endsWith(".pdf")) finalFileName += ".pdf";
        fileExt = "pdf";
      } else {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${actualFileId}?alt=media`;
      }

      if (
        syncedDriveIds.has(actualFileId) ||
        syncedNames.has(finalFileName.toLowerCase())
      ) {
        skippedCount++;
        continue;
      }

      try {
        const downloadRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!downloadRes.ok) {
          throw new Error(
            `Download failed (${downloadRes.status} ${downloadRes.statusText})`
          );
        }

        const arrayBuffer = await downloadRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const timestamp = Date.now();
        const sanitizedName = finalFileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `google-drive/${timestamp}_${sanitizedName}`;

        const determinedCategory = determineCategory(finalFileName, file.parentFolderName);

        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(storagePath, buffer, {
            contentType: targetMimeType || "application/octet-stream",
            upsert: false,
          });

        if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

        // Automatically extract text
        const extractedText = await extractTextFromBuffer(buffer, fileExt);

        // Insert row in documents table with extracted_text populated
        const { error: insertError } = await supabase.from("documents").insert([
          {
            file_name: finalFileName,
            file_type: fileExt,
            category: determinedCategory,
            storage_path: storagePath,
            drive_file_id: actualFileId,
            extracted_text: extractedText,
            uploaded_at: new Date().toISOString(),
          },
        ]);

        if (insertError) {
          await supabase.storage.from("documents").remove([storagePath]);
          throw new Error(`DB insert failed: ${insertError.message}`);
        }

        syncedDriveIds.add(actualFileId);
        syncedNames.add(finalFileName.toLowerCase());
        syncedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error syncing "${finalFileName}":`, msg);
        errors.push(`${finalFileName}: ${msg}`);
      }
    }

    let message = "";
    if (syncedCount > 0) {
      message = `${syncedCount} new ${
        syncedCount === 1 ? "file" : "files"
      } synced, categorized, and text-extracted from Google Drive.`;
      if (skippedCount > 0) {
        message += ` (${skippedCount} already up to date)`;
      }
    } else if (skippedCount > 0) {
      message = `All ${skippedCount} files from Google Drive are already synced.`;
    } else {
      message = "No matching files were found to sync.";
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      skippedCount,
      totalEligible: eligibleFiles.length,
      message,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    console.error("Sync handler error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error during sync.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

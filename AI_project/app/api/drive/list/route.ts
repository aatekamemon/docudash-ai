import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";

const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";

interface DriveRawFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { success: false, error: "Google Drive is not connected. Please sign in with Google." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folderId") || "root";
    const accessToken = session.accessToken;

    // Fetch folder info if not root
    let folderName = "My Drive";
    if (folderId !== "root") {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        folderName = meta.name || "Folder";
      }
    }

    // Query files and folders inside folderId
    const q = `'${folderId}' in parents and trashed = false`;
    const fields = "nextPageToken,files(id,name,mimeType,size,modifiedTime,iconLink)";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=150&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=folder,name`;

    const driveRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!driveRes.ok) {
      if (driveRes.status === 401) {
        return NextResponse.json(
          { success: false, error: "Your Google login session has expired. Please sign out and sign in again in the top navbar to refresh your Google connection." },
          { status: 401 }
        );
      }
      const err = await driveRes.text();
      return NextResponse.json(
        { success: false, error: `Google Drive API error: ${err}` },
        { status: driveRes.status }
      );
    }

    const data = await driveRes.json();
    const allItems: DriveRawFile[] = data.files || [];

    // Get existing imported files from Supabase to mark status
    let existingIds = new Set<string>();
    let existingNames = new Set<string>();
    if (isSupabaseConfigured()) {
      const { data: existingDocs } = await supabase
        .from("documents")
        .select("drive_file_id, file_name");
      (existingDocs || []).forEach((d) => {
        if (d.drive_file_id) existingIds.add(d.drive_file_id);
        if (d.file_name) existingNames.add(d.file_name.toLowerCase());
      });
    }

    const folders: Array<{ id: string; name: string }> = [];
    const files: Array<{
      id: string;
      name: string;
      mimeType: string;
      size: number;
      modifiedTime?: string;
      alreadyImported: boolean;
    }> = [];

    const supportedExtensions = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".csv", ".pptx"];

    for (const item of allItems) {
      if (item.mimeType === GOOGLE_FOLDER_MIME) {
        folders.push({ id: item.id, name: item.name });
      } else {
        const isGoogleDoc = item.mimeType === "application/vnd.google-apps.document";
        const isGoogleSheet = item.mimeType === "application/vnd.google-apps.spreadsheet";
        const isGoogleSlide = item.mimeType === "application/vnd.google-apps.presentation";
        const hasSupportedExt = supportedExtensions.some((ext) =>
          item.name.toLowerCase().endsWith(ext)
        );

        // Include supported document types
        if (isGoogleDoc || isGoogleSheet || isGoogleSlide || hasSupportedExt) {
          const isImported =
            existingIds.has(item.id) || existingNames.has(item.name.toLowerCase());

          files.push({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType,
            size: item.size ? parseInt(item.size, 10) : 0,
            modifiedTime: item.modifiedTime,
            alreadyImported: isImported,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      currentFolder: { id: folderId, name: folderName },
      folders,
      files,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to list Google Drive files.";
    console.error("Drive list error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

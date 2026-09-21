"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileCode,
  Download,
  Eye,
  Calendar,
  RefreshCw,
  FolderOpen,
  LayoutGrid,
  List as ListIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CloudDownload,
  ChevronDown,
  Sparkles,
  Zap,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { DocumentItem, FileCategory } from "@/lib/types";
import { useSession } from "next-auth/react";
import { DropboxChooserButton } from "@/components/DropboxChooserButton";
import { GoogleDrivePickerModal } from "@/components/GoogleDrivePickerModal";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";

function GoogleDriveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" fill="none">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
      <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44C.4 50 0 51.55 0 53.1h27.5L43.65 25z" fill="#00AC47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335" />
      <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D" />
      <path d="M59.8 53.1H27.5L13.75 76.9c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53.1z" fill="#2684FC" />
      <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28.1h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22.1z" fill="#FFBA00" />
    </svg>
  );
}

function DropboxIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#0061FF">
      <path d="M7.06 1.5L1.76 5.37L6.44 9.17L11.75 5.3L7.06 1.5ZM16.94 1.5L12.25 5.3L17.56 9.17L22.24 5.37L16.94 1.5ZM1.76 12.98L7.06 16.85L11.75 13.05L6.44 9.17L1.76 12.98ZM17.56 9.17L12.25 13.05L16.94 16.85L22.24 12.98L17.56 9.17ZM11.75 13.97L7.06 17.77L5.78 16.85L5.78 17.87L11.75 22.5L17.72 17.87L17.72 16.85L16.44 17.77L11.75 13.97Z" />
    </svg>
  );
}

const CATEGORIES: (FileCategory | "All")[] = [
  "All",
  "Finance",
  "HR",
  "Legal",
  "Engineering",
  "Marketing",
  "General",
];

const SELECTABLE_CATEGORIES: FileCategory[] = [
  "HR",
  "Finance",
  "Legal",
  "Engineering",
  "Marketing",
  "General",
];

export default function DocumentsPage() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [chunkCounts, setChunkCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FileCategory | "All">("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [, startTransition] = useTransition();

  const [activeDropdownDocId, setActiveDropdownDocId] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
    const [extracting, setExtracting] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [actionAlert, setActionAlert] = useState<{
    type: "success" | "error" | "idle";
    message: string;
  }>({ type: "idle", message: "" });

  const fetchDocuments = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) {
        console.error("Error fetching documents:", error);
        setDocuments([]);
      } else {
        setDocuments(data || []);

        try {
          const { data: chunks } = await supabase
            .from("document_chunks")
            .select("document_id");

          if (chunks) {
            const counts: Record<string, number> = {};
            chunks.forEach((c) => {
              counts[c.document_id] = (counts[c.document_id] || 0) + 1;
            });
            setChunkCounts(counts);
          }
        } catch {
          // Table might not exist yet before SQL is run
        }
      }
    } catch (err) {
      console.error("Supabase query error:", err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

    const handleSyncDrive = async () => {
    if (!session?.accessToken) return;
    setSyncing(true);
    setActionAlert({ type: "idle", message: "" });

    try {
      const res = await fetch("/api/drive/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to sync files.");
      setActionAlert({ type: "success", message: data.message || `${data.syncedCount} new files synced.` });
      await fetchDocuments();
    } catch (err: unknown) {
      setActionAlert({ type: "error", message: err instanceof Error ? err.message : "Sync error." });
    } finally {
      setSyncing(false);
    }
  };

  const handleExtractAll = async () => {
    setExtracting(true);
    setActionAlert({ type: "idle", message: "" });

    try {
      const res = await fetch("/api/documents/extract-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Extraction failed.");
      setActionAlert({ type: "success", message: data.message || `Text extraction completed.` });
      await fetchDocuments();
    } catch (err: unknown) {
      setActionAlert({ type: "error", message: err instanceof Error ? err.message : "Extraction error." });
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateEmbeddings = async () => {
    setEmbedding(true);
    setActionAlert({ type: "idle", message: "" });

    try {
      const res = await fetch("/api/documents/embed-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate embeddings.");
      setActionAlert({
        type: "success",
        message: data.message || `Generated embeddings for ${data.processedCount || 0} documents.`,
      });
      await fetchDocuments();
    } catch (err: unknown) {
      setActionAlert({ type: "error", message: err instanceof Error ? err.message : "Embedding error." });
    } finally {
      setEmbedding(false);
    }
  };

  const handleUpdateCategory = async (docId: string, newCategory: FileCategory) => {
    setActiveDropdownDocId(null);
    setDocuments((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, category: newCategory } : d))
    );

    try {
      const { error } = await supabase.from("documents").update({ category: newCategory }).eq("id", docId);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to update category:", err);
      fetchDocuments();
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.file_name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchesCategory = selectedCategory === "All" || (doc.category || "General") === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, selectedCategory]);

  const missingTextCount = useMemo(() => {
    return documents.filter((d) => !d.extracted_text || d.extracted_text.trim().length === 0).length;
  }, [documents]);

  const pendingEmbeddingCount = useMemo(() => {
    return documents.filter(
      (d) => d.extracted_text && d.extracted_text.trim().length > 0 && (!chunkCounts[d.id] || chunkCounts[d.id] === 0)
    ).length;
  }, [documents, chunkCounts]);

  const getFileIcon = (fileType: string) => {
    const ext = fileType.toLowerCase().replace(".", "");
    if (ext === "pdf") return <FileText className="w-4 h-4 text-rose-500" />;
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    if (ext === "docx" || ext === "doc" || ext === "txt") return <FileCode className="w-4 h-4 text-indigo-600" />;
    return <FileText className="w-4 h-4 text-slate-500" />;
  };

  const getFileIconBadge = (fileType: string) => {
    const ext = fileType.toLowerCase().replace(".", "");
    if (ext === "pdf") {
      return (
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-50 via-rose-100/60 to-rose-200/30 border border-rose-200/80 text-rose-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-200">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      return (
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-50 via-teal-100/60 to-emerald-200/30 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-200">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
      );
    }
    if (ext === "docx" || ext === "doc" || ext === "txt") {
      return (
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 via-indigo-100/60 to-indigo-200/30 border border-blue-200/80 text-indigo-600 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-200">
          <FileCode className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/80 text-slate-500 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform duration-200">
        <FileText className="w-5 h-5" />
      </div>
    );
  };

  const getCategoryBadgeClass = (category?: string | null) => {
    switch (category) {
      case "Finance": return "bg-emerald-50/90 text-emerald-800 border-emerald-200/90 shadow-2xs hover:bg-emerald-100/80";
      case "HR": return "bg-purple-50/90 text-purple-800 border-purple-200/90 shadow-2xs hover:bg-purple-100/80";
      case "Legal": return "bg-amber-50/90 text-amber-800 border-amber-200/90 shadow-2xs hover:bg-amber-100/80";
      case "Engineering": return "bg-indigo-50/90 text-indigo-800 border-indigo-200/90 shadow-2xs hover:bg-indigo-100/80";
      case "Marketing": return "bg-pink-50/90 text-pink-800 border-pink-200/90 shadow-2xs hover:bg-pink-100/80";
      default: return "bg-slate-100/90 text-slate-700 border-slate-200 shadow-2xs hover:bg-slate-200/80";
    }
  };

  const getDownloadUrl = (path: string) => {
    if (!isSupabaseConfigured() || !path.includes("/")) return "#";
    const { data } = supabase.storage.from("documents").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="space-y-6">
      {actionAlert.type === "success" && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-900">{actionAlert.message}</p>
          </div>
          <button onClick={() => setActionAlert({ type: "idle", message: "" })} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1">
            Dismiss
          </button>
        </div>
      )}

      {actionAlert.type === "error" && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-medium text-rose-800">{actionAlert.message}</p>
          </div>
          <button onClick={() => setActionAlert({ type: "idle", message: "" })} className="text-xs font-semibold text-rose-700 hover:text-rose-900 px-2 py-1">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Documents</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-50/90 text-indigo-700 rounded-full border border-indigo-200/80 shadow-2xs">
              {documents.length}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Browse, filter, auto-categorize, and generate vector embeddings for AI search.</p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button onClick={fetchDocuments} disabled={loading || syncing || extracting || embedding} className="p-2.5 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/90 shadow-xs transition active:scale-95 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          {missingTextCount > 0 && (
            <button onClick={handleExtractAll} disabled={extracting || embedding || loading} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border shadow-xs transition active:scale-95 disabled:opacity-60 bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300">
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Extracting Text...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Extract Text ({missingTextCount} pending)</span>
                </>
              )}
            </button>
          )}

          {pendingEmbeddingCount > 0 && (
            <button onClick={handleGenerateEmbeddings} disabled={embedding || extracting || loading} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border shadow-xs transition active:scale-95 disabled:opacity-60 bg-violet-600 hover:bg-violet-700 text-white border-violet-600 shadow-violet-200">
              {embedding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Generating Embeddings...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Generate Embeddings ({pendingEmbeddingCount} pending)</span>
                </>
              )}
            </button>
          )}

          <DropboxChooserButton
            buttonText="Choose from Dropbox"
            onSuccess={async (msg) => {
              setActionAlert({ type: "success", message: msg });
              await fetchDocuments();
            }}
            onError={(err) => {
              setActionAlert({ type: "error", message: err });
            }}
          />


          {session && (
            <button
              onClick={() => setIsDrivePickerOpen(true)}
              disabled={syncing || extracting || embedding}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white/95 hover:bg-white active:bg-slate-50 disabled:opacity-60 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer hover:-translate-y-0.5"
            >
              <GoogleDriveIcon className="w-4 h-4 shrink-0" />
              <span>Choose from Google Drive</span>
            </button>
          )}

          <Link href="/upload" className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all cursor-pointer">
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="text" placeholder="Search documents by filename..." value={searchQuery} onChange={(e) => { const val = e.target.value; startTransition(() => setSearchQuery(val)); }} className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition" />
          </div>

          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 self-start md:self-auto">
            <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${viewMode === "grid" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
            <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${viewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}>
              <ListIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-slate-400 font-medium whitespace-nowrap mr-1">Categories:</span>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap border ${selectedCategory === cat ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/80"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading your documents from Supabase...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-4 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">No documents found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">Upload a file or sync from Google Drive to get started.</p>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocuments.map((doc) => {
            const hasExtractedText = !!doc.extracted_text && doc.extracted_text.trim().length > 0;
            const count = chunkCounts[doc.id] || 0;

            return (
              <div key={doc.id} className="bg-white/95 backdrop-blur-xs border border-slate-200/80 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-[0_12px_28px_-6px_rgba(79,70,229,0.08)] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group">
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    {getFileIconBadge(doc.file_type)}
                    <div className="flex items-center gap-1.5 relative">
                      {doc.drive_file_id && (
                        <span className="inline-flex items-center p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-200/80" title="Synced from Google Drive">
                          <GoogleDriveIcon className="w-3 h-3" />
                        </span>
                      )}

                      <button onClick={() => setActiveDropdownDocId(activeDropdownDocId === doc.id ? null : doc.id)} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border transition cursor-pointer ${getCategoryBadgeClass(doc.category)}`}>
                        <span>{doc.category || "Uncategorized"}</span>
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </button>

                      {activeDropdownDocId === doc.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownDocId(null)} />
                          <div className="absolute right-0 top-full mt-1.5 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-1">
                            {SELECTABLE_CATEGORIES.map((cat) => (
                              <button key={cat} onClick={() => handleUpdateCategory(doc.id, cat)} className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${doc.category === cat ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"}`}>
                                {cat}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 onClick={() => setViewingDocId(doc.id)} className="font-bold text-slate-900 text-sm truncate group-hover:text-indigo-600 transition-colors cursor-pointer" title={doc.file_name}>
                      {doc.file_name}
                    </h3>
                    <div className="flex items-center flex-wrap gap-2 mt-1.5">
                      <span className="text-xs uppercase text-slate-400 font-semibold tracking-wider">{doc.file_type}</span>
                      <span className="text-slate-300">•</span>
                      {hasExtractedText ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60" title="Text extracted">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>Text Extracted</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                          <span>No Text</span>
                        </span>
                      )}

                      {count > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200/60" title={`${count} chunks stored with 384-d embeddings`}>
                          <Zap className="w-3 h-3 text-violet-600" />
                          <span>{count} {count === 1 ? "chunk" : "chunks"}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setViewingDocId(doc.id)}
                      className="inline-flex items-center gap-1.5 font-semibold text-xs text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    <a href={getDownloadUrl(doc.storage_path)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-slate-500 hover:text-slate-800 transition">
                      <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-600 text-xs font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-5">Document</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">AI Text</th>
                  <th className="py-3.5 px-4">Vector Chunks</th>
                  <th className="py-3.5 px-4">Uploaded</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => {
                  const hasExtractedText = !!doc.extracted_text && doc.extracted_text.trim().length > 0;
                  const count = chunkCounts[doc.id] || 0;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-5 font-semibold text-slate-900 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          {getFileIcon(doc.file_type)}
                        </div>
                        <span className="truncate max-w-sm">{doc.file_name}</span>
                      </td>
                      <td className="py-4 px-4">
                        {doc.drive_file_id ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <GoogleDriveIcon className="w-3 h-3" />
                            <span>Drive</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <UploadCloud className="w-3 h-3" />
                            <span>Manual</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 relative">
                        <button onClick={() => setActiveDropdownDocId(activeDropdownDocId === doc.id ? null : doc.id)} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border transition cursor-pointer ${getCategoryBadgeClass(doc.category)}`}>
                          <span>{doc.category || "Uncategorized"}</span>
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </button>

                        {activeDropdownDocId === doc.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveDropdownDocId(null)} />
                            <div className="absolute left-4 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-1">
                              {SELECTABLE_CATEGORIES.map((cat) => (
                                <button key={cat} onClick={() => handleUpdateCategory(doc.id, cat)} className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${doc.category === cat ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"}`}>
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {hasExtractedText ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80" title="Text extracted">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Extracted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {count > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200/80" title={`${count} vector chunks`}>
                            <Zap className="w-3.5 h-3.5 text-violet-600" />
                            <span>{count} Chunks</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0 chunks</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-slate-500 text-xs font-medium">
                        {new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <a href={getDownloadUrl(doc.storage_path)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    
      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSuccess={async (msg) => {
          setActionAlert({ type: "success", message: msg });
          await fetchDocuments();
        }}
        onError={(err) => {
          setActionAlert({ type: "error", message: err });
        }}
      />

      <DocumentViewerModal
        isOpen={!!viewingDocId}
        documentId={viewingDocId}
        onClose={() => setViewingDocId(null)}
      />
</div>
  );
}

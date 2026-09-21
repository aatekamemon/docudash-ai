"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Folder,
  FileText,
  FileSpreadsheet,
  FileCode,
  ArrowLeft,
  RefreshCw,
  Search,
  CheckCircle2,
  X,
  Loader2,
  CheckSquare,
  Square,
  ChevronRight,
  FolderOpen,
  FolderCheck,
} from "lucide-react";

interface DriveFolder {
  id: string;
  name: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime?: string;
  alreadyImported: boolean;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface GoogleDrivePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

function GoogleDriveIcon({ className = "w-5 h-5" }: { className?: string }) {
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

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "--";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(name: string, mime: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf") || mime === "application/pdf") {
    return <FileText className="w-5 h-5 text-rose-500" />;
  }
  if (n.endsWith(".docx") || n.endsWith(".doc") || mime.includes("word") || mime.includes("document")) {
    return <FileText className="w-5 h-5 text-blue-600" />;
  }
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv") || mime.includes("sheet")) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  }
  return <FileCode className="w-5 h-5 text-slate-500" />;
}

export function GoogleDrivePickerModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
}: GoogleDrivePickerModalProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadFolder = async (folderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load Google Drive folder.");
      }
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load files.";
      onError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
      setSearchQuery("");
      setCurrentFolderId("root");
      setBreadcrumbs([{ id: "root", name: "My Drive" }]);
      loadFolder("root");
    }
  }, [isOpen]);

  const handleOpenFolder = (folder: DriveFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadFolder(folder.id);
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem, index: number) => {
    if (index === breadcrumbs.length - 1) return;
    setCurrentFolderId(item.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    loadFolder(item.id);
  };

  const handleGoBack = () => {
    if (breadcrumbs.length <= 1) return;
    const nextBreadcrumbs = breadcrumbs.slice(0, breadcrumbs.length - 1);
    const parent = nextBreadcrumbs[nextBreadcrumbs.length - 1];
    setCurrentFolderId(parent.id);
    setBreadcrumbs(nextBreadcrumbs);
    loadFolder(parent.id);
  };

  const toggleSelectFile = (fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleSelectFolder = (folderId: string) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const q = searchQuery.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  const handleSelectAllInFolder = () => {
    const importable = filteredFiles.filter((f) => !f.alreadyImported);
    const nextFiles = new Set(selectedFileIds);
    importable.forEach((f) => nextFiles.add(f.id));
    setSelectedFileIds(nextFiles);
  };

  const handleDeselectAll = () => {
    setSelectedFileIds(new Set());
    setSelectedFolderIds(new Set());
  };

  const totalSelectedCount = selectedFileIds.size + selectedFolderIds.size;

  const handleImport = async () => {
    if (totalSelectedCount === 0) return;
    setImporting(true);

    try {
      const res = await fetch("/api/drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileIds: Array.from(selectedFileIds),
          folderIds: Array.from(selectedFolderIds),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to import selected files.");
      }

      onSuccess(data.message || "Files imported and processed successfully.");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      onError(msg);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  const isCurrentFolderSelected = selectedFolderIds.has(currentFolderId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
              <GoogleDriveIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Google Drive File & Folder Picker</h2>
              <p className="text-xs text-slate-500">Select individual files or entire folders to import</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Breadcrumbs & Search */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-4 flex-wrap">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-1.5 text-sm overflow-x-auto py-1">
            {breadcrumbs.length > 1 && (
              <button
                onClick={handleGoBack}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 mr-1 cursor-pointer"
                title="Go up one folder"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={b.id}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                <button
                  onClick={() => handleBreadcrumbClick(b, idx)}
                  className={`px-2 py-1 rounded-md transition font-medium cursor-pointer ${
                    idx === breadcrumbs.length - 1
                      ? "text-indigo-600 bg-indigo-50/70"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {b.name}
                </button>
              </React.Fragment>
            ))}

            {/* Select entire current folder button */}
            {currentFolderId !== "root" && (
              <button
                type="button"
                onClick={() => toggleSelectFolder(currentFolderId)}
                className={`ml-3 px-2.5 py-1 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                  isCurrentFolderSelected
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white hover:bg-slate-50 text-indigo-700 border-indigo-200"
                }`}
              >
                {isCurrentFolderSelected ? (
                  <>
                    <FolderCheck className="w-3.5 h-3.5" />
                    <span>Entire Folder Selected</span>
                  </>
                ) : (
                  <>
                    <Folder className="w-3.5 h-3.5" />
                    <span>Select this entire folder</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter items..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-40"
              />
            </div>
            <button
              onClick={() => loadFolder(currentFolderId)}
              disabled={loading}
              className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition cursor-pointer"
              title="Refresh folder"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* Content Explorer Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[320px] max-h-[480px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium text-slate-500">Loading Drive contents...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Folders Section */}
              {filteredFolders.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Folders ({filteredFolders.length}) — Click checkbox to select folder, or name to open
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {filteredFolders.map((f) => {
                      const isFolderSelected = selectedFolderIds.has(f.id);
                      return (
                        <div
                          key={f.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition shadow-2xs ${
                            isFolderSelected
                              ? "bg-indigo-50/70 border-indigo-400"
                              : "border-slate-200 bg-white hover:bg-slate-50/80 hover:border-slate-300"
                          }`}
                        >
                          {/* Folder Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectFolder(f.id)}
                            className="p-1 hover:bg-slate-200/50 rounded cursor-pointer"
                            title={isFolderSelected ? "Deselect folder" : "Select entire folder"}
                          >
                            {isFolderSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>

                          {/* Open Folder Navigation */}
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(f)}
                            className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer group"
                          >
                            <Folder className={`w-5 h-5 shrink-0 group-hover:scale-105 transition ${
                              isFolderSelected ? "text-indigo-600" : "text-amber-500"
                            }`} />
                            <span className="text-xs font-semibold text-slate-800 truncate flex-1">
                              {f.name}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Documents ({filteredFiles.length})
                  </h3>
                  {filteredFiles.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAllInFolder}
                        className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                      >
                        Select all in folder
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="py-10 text-center rounded-xl border border-dashed border-slate-200">
                    <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">No supported documents in this folder</p>
                    <p className="text-xs text-slate-400 mt-0.5">Upload Word, Excel, or PDF documents to your Google Drive</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                    {filteredFiles.map((file) => {
                      const isSelected = selectedFileIds.has(file.id);
                      return (
                        <div
                          key={file.id}
                          onClick={() => !file.alreadyImported && toggleSelectFile(file.id)}
                          className={`flex items-center gap-3.5 px-4 py-3 transition ${
                            file.alreadyImported
                              ? "bg-slate-50/60 opacity-70 cursor-not-allowed"
                              : "hover:bg-slate-50 cursor-pointer"
                          } ${isSelected ? "bg-indigo-50/60" : ""}`}
                        >
                          <div className="shrink-0">
                            {file.alreadyImported ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </div>

                          <div className="shrink-0">{getFileIcon(file.name, file.mimeType)}</div>

                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {formatBytes(file.size)}
                            </p>
                          </div>

                          {file.alreadyImported && (
                            <span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200">
                              Already in Library
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-medium">
            Selected: <span className="font-bold text-slate-900">{selectedFileIds.size}</span> file{selectedFileIds.size === 1 ? "" : "s"}
            {selectedFolderIds.size > 0 && (
              <>
                {" + "}
                <span className="font-bold text-indigo-600">{selectedFolderIds.size}</span> folder{selectedFolderIds.size === 1 ? "" : "s"}
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={totalSelectedCount === 0 || importing}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs shadow-indigo-200 transition flex items-center gap-2 cursor-pointer"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing & Embedding...</span>
                </>
              ) : (
                <>
                  <GoogleDriveIcon className="w-4 h-4" />
                  <span>Import Selected ({totalSelectedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

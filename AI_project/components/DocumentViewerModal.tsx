"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  Maximize2,
  Minimize2,
  Loader2,
  Table as TableIcon,
  ExternalLink,
} from "lucide-react";

interface DocumentViewerModalProps {
  documentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PreviewData {
  document: {
    id: string;
    file_name: string;
    file_type: string;
    category: string;
    storage_path: string;
    uploaded_at: string;
  };
  viewType: "pdf" | "docx" | "xlsx" | "text";
  publicUrl: string;
  html?: string;
  sheets?: Array<{ name: string; html: string }>;
  text?: string;
}

export function DocumentViewerModal({
  documentId,
  isOpen,
  onClose,
}: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewData | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      setLoading(true);
      setError(null);
      setActiveSheetIndex(0);

      fetch(`/api/documents/preview?id=${documentId}`)
        .then((res) => res.json())
        .then((json) => {
          if (!json.success) throw new Error(json.error || "Failed to load document.");
          setData(json);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Error loading document.");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setData(null);
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const getDocIcon = (type: string) => {
    const ext = type.toLowerCase().replace(".", "");
    if (ext === "pdf") return <FileText className="w-5 h-5 text-rose-500" />;
    if (ext === "xlsx" || ext === "xls" || ext === "csv") return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    if (ext === "docx" || ext === "doc") return <FileText className="w-5 h-5 text-blue-600" />;
    return <FileCode className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative bg-slate-50/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${
          isFullScreen ? "w-full h-full max-w-none max-h-none rounded-none m-0" : "w-full max-w-5xl h-[88vh]"
        }`}
      >
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-white/90 border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              {data ? getDocIcon(data.document.file_type) : <FileText className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate" title={data?.document.file_name}>
                {data?.document.file_name || "Loading document..."}
              </h2>
              {data && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 rounded-md border border-slate-200/60">
                    {data.document.file_type}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/60">
                    {data.document.category || "General"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {data?.publicUrl && (
              <a
                href={data.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition"
                title="Download original file"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer hidden sm:block"
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
          {loading ? (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-semibold text-slate-600">Opening document...</p>
            </div>
          ) : error ? (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center gap-2 text-center p-6">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full border border-rose-200">
                <X className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-900">{error}</p>
              {data?.publicUrl && (
                <a
                  href={data.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Try opening directly</span>
                </a>
              )}
            </div>
          ) : (
            <div className="h-full">
              {data?.viewType === "pdf" ? (
                /* PDF Embedded Viewer */
                <iframe
                  src={data.publicUrl}
                  className="w-full h-full min-h-[550px] rounded-xl border border-slate-200 bg-white shadow-xs"
                  title={data.document.file_name}
                />
              ) : data?.viewType === "docx" ? (
                /* Word DOCX Formatted HTML View */
                <div className="max-w-4xl mx-auto p-8 sm:p-14 bg-white rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/50">
                  <div
                    className="prose prose-slate max-w-none text-slate-800 leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-2.5 [&_th]:text-xs [&_th]:font-bold [&_td]:border [&_td]:border-slate-200 [&_td]:p-2.5 [&_td]:text-xs [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                    dangerouslySetInnerHTML={{ __html: data.html || "<p>Empty document.</p>" }}
                  />
                </div>
              ) : data?.viewType === "xlsx" && data.sheets && data.sheets.length > 0 ? (
                /* Excel Spreadsheet View */
                <div className="max-w-6xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden flex flex-col">
                  {/* Sheet Tabs Bar */}
                  {data.sheets.length > 1 && (
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
                      <TableIcon className="w-4 h-4 text-emerald-600 shrink-0 mr-1" />
                      {data.sheets.map((sheet, idx) => (
                        <button
                          key={sheet.name}
                          type="button"
                          onClick={() => setActiveSheetIndex(idx)}
                          className={`px-3 py-1 text-xs font-semibold rounded-lg border transition shrink-0 cursor-pointer ${
                            activeSheetIndex === idx
                              ? "bg-white text-emerald-800 border-emerald-300 shadow-2xs"
                              : "bg-transparent text-slate-600 border-transparent hover:bg-slate-200/70"
                          }`}
                        >
                          {sheet.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Spreadsheet HTML Table */}
                  <div className="p-4 overflow-x-auto max-h-[600px]">
                    <div
                      className="[&_table]:w-full [&_table]:border-collapse [&_th]:bg-slate-100 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_th]:text-xs [&_th]:font-bold [&_th]:text-slate-800 [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_td]:text-xs [&_td]:text-slate-700 [&_td]:whitespace-nowrap [&_tr:hover]:bg-emerald-50/40"
                      dangerouslySetInnerHTML={{
                        __html: data.sheets[activeSheetIndex]?.html || "<p>No sheet data.</p>",
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Plain Text View */
                <div className="max-w-4xl mx-auto p-6 sm:p-10 bg-white rounded-2xl border border-slate-200 shadow-sm font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {data?.text || "No text available."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

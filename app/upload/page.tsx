"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { FileCategory } from "@/lib/types";
import { DropboxChooserButton } from "@/components/DropboxChooserButton";
import { GoogleDrivePickerModal } from "@/components/GoogleDrivePickerModal";
import { useSession } from "next-auth/react";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx"];
const CATEGORIES: FileCategory[] = ["Finance", "HR", "Legal", "Engineering", "Marketing", "General"];

export default function UploadPage() {
  const { data: session } = useSession();
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<FileCategory>("General");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (selectedFile: File): boolean => {
    const extension = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setStatus({
        type: "error",
        message: `Invalid file type. Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported.`,
      });
      return false;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      setStatus({
        type: "error",
        message: "File size exceeds 25MB limit.",
      });
      return false;
    }
    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
        setStatus({ type: "idle", message: "" });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
        setStatus({ type: "idle", message: "" });
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus({ type: "error", message: "Please select a file to upload." });
      return;
    }

    if (!isSupabaseConfigured()) {
      setStatus({
        type: "error",
        message: "Supabase credentials are not configured yet. Please configure your .env.local file.",
      });
      return;
    }

    setUploading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${category.toLowerCase()}/${timestamp}_${sanitizedName}`;

      // 1. Upload file to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // 2. Insert record into Postgres "documents" table
      const { data: insertedData, error: dbError } = await supabase
        .from("documents")
        .insert([
          {
            file_name: file.name,
            file_type: fileExt,
            category: category,
            storage_path: storagePath,
            uploaded_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (dbError) {
        await supabase.storage.from("documents").remove([storagePath]);
        throw new Error(`Database record creation failed: ${dbError.message}`);
      }

      // 3. Automatically extract text in background via /api/documents/extract
      if (insertedData?.id) {
        try {
          await fetch("/api/documents/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: insertedData.id }),
          });
        } catch (extractErr) {
          console.warn("Background text extraction error:", extractErr);
        }
      }

      setStatus({
        type: "success",
        message: `"${file.name}" was uploaded and text extracted successfully!`,
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during upload.";
      setStatus({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Upload Document</h1>
        <p className="text-slate-500 text-sm mt-1">
          Add PDF, Word, or Excel documents. Text will be automatically extracted for AI search.
        </p>
      </div>

      <form onSubmit={handleUpload} className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Status Alerts */}
        {status.type === "success" && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">{status.message}</p>
              <div className="mt-2">
                <Link
                  href="/documents"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                >
                  View in Documents list <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {status.type === "error" && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-rose-700">{status.message}</p>
          </div>
        )}

        {/* Drag and drop zone */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Document File
          </label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all ${
              dragActive
                ? "border-indigo-500 bg-indigo-50/50"
                : file
                ? "border-emerald-300 bg-emerald-50/30"
                : "border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />

            {file ? (
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
                  <FileText className="w-7 h-7" />
                </div>
                <p className="font-semibold text-slate-900 text-sm">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB • Click or drop to replace
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mb-3 group-hover:text-indigo-600">
                  <UploadCloud className="w-7 h-7 text-indigo-600" />
                </div>
                <p className="font-semibold text-slate-800 text-sm">
                  Drag & drop your document here, or <span className="text-indigo-600 font-bold">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1.5 font-medium">
                  PDF (.pdf), Word (.docx), Excel (.xlsx) • Up to 25MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Category Picker */}
        <div>
          <label htmlFor="category" className="block text-sm font-semibold text-slate-700 mb-2">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as FileCategory)}
            className="w-full px-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl shadow-sm shadow-indigo-200 transition flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading & Extracting Text...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>Upload Document</span>
            </>
          )}
        </button>
      </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-50 px-2 text-slate-500 font-medium">Or import from cloud</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {session && (
            <button
              type="button"
              onClick={() => setIsDrivePickerOpen(true)}
              className="w-full sm:w-1/2 py-3 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 87.3 78" fill="none">
                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA" />
                <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44C.4 50 0 51.55 0 53.1h27.5L43.65 25z" fill="#00AC47" />
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z" fill="#EA4335" />
                <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z" fill="#00832D" />
                <path d="M59.8 53.1H27.5L13.75 76.9c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53.1z" fill="#2684FC" />
                <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28.1h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22.1z" fill="#FFBA00" />
              </svg>
              <span>Choose from Google Drive</span>
            </button>
          )}
          <DropboxChooserButton
            buttonText="Select & Import Files from Dropbox"
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2.5 cursor-pointer"
            onSuccess={(msg) => {
              setStatus({ type: "success", message: msg });
            }}
            onError={(err) => {
              setStatus({ type: "error", message: err });
            }}
          />
        </div>
    
      <GoogleDrivePickerModal
        isOpen={isDrivePickerOpen}
        onClose={() => setIsDrivePickerOpen(false)}
        onSuccess={(msg) => setStatus({ type: "success", message: msg })}
        onError={(err) => setStatus({ type: "error", message: err })}
      />
</div>
  );
}

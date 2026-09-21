"use client";

import React, { useState } from "react";
import Script from "next/script";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    Dropbox?: {
      choose: (options: {
        success: (files: Array<{ name: string; link: string; bytes?: number; id?: string }>) => void;
        cancel?: () => void;
        linkType: "direct" | "preview";
        multiselect: boolean;
        extensions?: string[];
      }) => void;
      isBrowserSupported?: () => boolean;
    };
  }
}

interface DropboxChooserButtonProps {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  className?: string;
  buttonText?: string;
}

export function DropboxChooserButton({
  onSuccess,
  onError,
  className = "inline-flex items-center gap-2 px-3.5 py-2.5 bg-white/95 hover:bg-white active:bg-slate-50 disabled:opacity-60 text-slate-700 hover:text-slate-900 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer hover:-translate-y-0.5",
  buttonText = "Choose from Dropbox",
}: DropboxChooserButtonProps) {
  const [loading, setLoading] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY || "mevze5fqhyjzwmo";

  const handleOpenChooser = () => {
    if (typeof window === "undefined" || !window.Dropbox) {
      onError?.("Dropbox Chooser is initializing. Please try again in a second.");
      return;
    }

    window.Dropbox.choose({
      success: async (files) => {
        if (!files || files.length === 0) return;
        setLoading(true);
        try {
          const res = await fetch("/api/dropbox/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Failed to import selected files.");
          }
          onSuccess?.(data.message || `${files.length} files imported.`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error importing from Dropbox.";
          onError?.(msg);
        } finally {
          setLoading(false);
        }
      },
      cancel: () => {
        console.log("Dropbox file picker closed.");
      },
      linkType: "direct",
      multiselect: true,
      extensions: [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".csv"],
    });
  };

  return (
    <>
      <Script
        id="dropboxjs"
        src="https://www.dropbox.com/static/api/2/dropins.js"
        data-app-key={appKey}
        strategy="lazyOnload"
      />
      <button
        type="button"
        onClick={handleOpenChooser}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Importing from Dropbox...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#0061FF">
              <path d="M7.06 1.5L1.76 5.37L6.44 9.17L11.75 5.3L7.06 1.5ZM16.94 1.5L12.25 5.3L17.56 9.17L22.24 5.37L16.94 1.5ZM1.76 12.98L7.06 16.85L11.75 13.05L6.44 9.17L1.76 12.98ZM17.56 9.17L12.25 13.05L16.94 16.85L22.24 12.98L17.56 9.17ZM11.75 13.97L7.06 17.77L5.78 16.85L5.78 17.87L11.75 22.5L17.72 17.87L17.72 16.85L16.44 17.77L11.75 13.97Z" />
            </svg>
            <span>{buttonText}</span>
          </>
        )}
      </button>
    </>
  );
}

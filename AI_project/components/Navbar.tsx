"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Upload,
  FolderKanban,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogOut,
  User,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

function GoogleDriveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" fill="none">
      <path
        d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z"
        fill="#0066DA"
      />
      <path
        d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44C.4 50 0 51.55 0 53.1h27.5L43.65 25z"
        fill="#00AC47"
      />
      <path
        d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z"
        fill="#EA4335"
      />
      <path
        d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2L43.65 25z"
        fill="#00832D"
      />
      <path
        d="M59.8 53.1H27.5L13.75 76.9c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2L59.8 53.1z"
        fill="#2684FC"
      />
      <path
        d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28.1h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22.1z"
        fill="#FFBA00"
      />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [configured, setConfigured] = useState(true);
  const { data: session, status } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  const navLinks = [
    { name: "Documents", href: "/documents", icon: FolderKanban },
    { name: "Upload File", href: "/upload", icon: Upload },
    { name: "AI Chat", href: "/chat", icon: Bot },
  ];

  return (
    <header className="border-b border-slate-200/75 bg-white/85 backdrop-blur-xl shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/documents" className="flex items-center gap-2.5 font-bold text-slate-900 text-lg group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/30 group-hover:scale-105 transition-all">
            <FileText className="w-5 h-5" />
          </div>
          <span className="tracking-tight font-extrabold text-slate-900">Docu<span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Dash</span></span>
        </Link>

        {/* Navigation Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Main Pages Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-50/90 text-indigo-700 shadow-2xs border border-indigo-200/70"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-500"}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Google Drive OAuth Button / Connected Badge */}
          {status === "loading" ? (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              <span>Checking Drive...</span>
            </div>
          ) : session ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50/90 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100/80 transition shadow-2xs cursor-pointer"
                title="Google Drive connected. Click to manage or disconnect."
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <GoogleDriveIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Google Drive Connected</span>
                <span className="sm:hidden">Connected</span>
              </button>

              {/* User dropdown for Google Account & Disconnect */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 space-y-2">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                      {session.user?.image ? (
                        <img
                          src={session.user.image}
                          alt="User"
                          className="w-8 h-8 rounded-full border border-slate-200"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {session.user?.name || "Google User"}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {session.user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Drive Read-Only Access Active
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition font-medium text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect Google Drive</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 shadow-xs transition hover:border-slate-400"
              title="Connect your Google Drive account"
            >
              <GoogleDriveIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Connect Google Drive</span>
            </button>
          )}

          {/* Supabase Status Indicator */}
          <div className="hidden lg:flex items-center pl-3 border-l border-slate-200 text-xs">
            {configured ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Supabase Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-200/70">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Supabase Env Required
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

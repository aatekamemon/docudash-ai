"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Info, Code2 } from "lucide-react";

export function SupabaseBanner() {
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  if (configured) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-amber-900 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>Supabase Setup Needed:</strong> Please set <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">.env.local</code>.
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-md border border-amber-200">
          <Code2 className="w-4 h-4 text-amber-700" />
          <span>Run schema in <code className="font-mono">supabase/schema.sql</code></span>
        </div>
      </div>
    </div>
  );
}

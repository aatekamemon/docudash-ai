"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Bot,
  User,
  FileText,
  Loader2,
  MessageSquare,
  Sparkles,
  ExternalLink,
  FolderOpen,
  ChevronDown,
  Cpu,
  Zap,
  RotateCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ModelProvider = "groq" | "gemini";

interface Source {
  documentId: string;
  fileName: string;
  category: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isError?: boolean;
  model?: ModelProvider;
}

// ── Markdown renderer for AI responses ───────────────────────────────────────
function MarkdownContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (props) => <p className="mb-2 last:mb-0" {...props} />,
        strong: (props) => <strong className="font-semibold" {...props} />,
        em: (props) => <em className="italic" {...props} />,
        ul: (props) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
        ol: (props) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
        li: (props) => <li className="text-sm" {...props} />,
        table: (props) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full text-xs border-collapse" {...props} />
          </div>
        ),
        thead: (props) => <thead className="bg-slate-50 border-b border-slate-200" {...props} />,
        th: (props) => <th className="px-3 py-2 text-left font-semibold text-slate-700 border border-slate-200" {...props} />,
        td: (props) => <td className="px-3 py-2 text-slate-700 border border-slate-200" {...props} />,
        tr: (props) => <tr className="even:bg-slate-50/60" {...props} />,
        code: (props) => (
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
        ),
        pre: (props) => (
          <pre className="bg-slate-100 rounded-lg px-3 py-2 text-xs font-mono my-2 overflow-x-auto" {...props} />
        ),
        blockquote: (props) => (
          <blockquote className="border-l-2 border-indigo-300 pl-3 italic text-slate-600 my-2" {...props} />
        ),
        h1: (props) => <h1 className="text-base font-bold mb-2 mt-3" {...props} />,
        h2: (props) => <h2 className="text-sm font-bold mb-2 mt-3" {...props} />,
        h3: (props) => <h3 className="text-sm font-semibold mb-1 mt-2" {...props} />,
        hr: () => <hr className="my-3 border-slate-200" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Model badge colours ───────────────────────────────────────────────────────
const MODEL_BADGE: Record<
  ModelProvider,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  groq: {
    label: "Groq",
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    icon: <Zap className="w-3 h-3 text-violet-500" />,
  },
  gemini: {
    label: "Gemini",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <Cpu className="w-3 h-3 text-blue-500" />,
  },
};

// ── Category badge colours ────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Finance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  HR: "bg-purple-50 text-purple-700 border-purple-200",
  Legal: "bg-amber-50 text-amber-700 border-amber-200",
  Engineering: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Marketing: "bg-pink-50 text-pink-700 border-pink-200",
  General: "bg-slate-100 text-slate-600 border-slate-200",
};

const SAMPLE_QUESTIONS = [
  "How many documents do we have in total?",
  "List all Finance documents",
  "What is the salary mentioned in the payslip documents?",
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelProvider>("gemini");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (questionText?: string) => {
    const question = (questionText ?? input).trim();
    if (!question || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          model: selectedModel,
          // Send last 10 messages as conversation history (excludes the user msg just added)
          history: messages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to get a response.");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
        model: selectedModel,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: errMsg,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const badge = MODEL_BADGE[selectedModel];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
        {/* Left - branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-violet-200">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              DocuDash AI
            </h1>
            <p className="text-xs text-slate-500">
              Ask questions about your uploaded documents
            </p>
          </div>
        </div>

        {/* Right - model switcher + docs link */}
        <div className="flex items-center gap-3">
          {/* Model Switcher */}
          <div className="relative">
            <button
              id="model-switcher-btn"
              onClick={() => setShowModelMenu((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs hover:shadow-sm ${badge.bg} ${badge.text} ${badge.border}`}
            >
              {badge.icon}
              {badge.label}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${showModelMenu ? "rotate-180" : ""}`}
              />
            </button>

            {showModelMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowModelMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-1.5 space-y-0.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2.5 pt-1.5 pb-1">
                    Select AI Model
                  </p>

                  {/* Groq option */}
                  <button
                    id="model-option-groq"
                    onClick={() => { setSelectedModel("groq"); setShowModelMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                      selectedModel === "groq"
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                      <Zap className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-xs">Groq</p>
                      <p className="text-[10px] text-slate-500">Fast · GPT-OSS 120B</p>
                    </div>
                    {selectedModel === "groq" && (
                      <span className="text-violet-500 text-xs font-bold">✓</span>
                    )}
                  </button>

                  {/* Gemini option */}
                  <button
                    id="model-option-gemini"
                    onClick={() => { setSelectedModel("gemini"); setShowModelMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                      selectedModel === "gemini"
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Cpu className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-xs">Google Gemini</p>
                      <p className="text-[10px] text-slate-500">Gemini Flash Lite</p>
                    </div>
                    {selectedModel === "gemini" && (
                      <span className="text-blue-500 text-xs font-bold">✓</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Clear Chat */}
          {messages.length > 0 && (
            <button
              id="clear-chat-btn"
              onClick={() => setMessages([])}
              title="Start a new conversation"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          )}

          <Link
            href="/documents"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Documents
          </Link>
        </div>
      </div>

      {/* ── Messages Area ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 px-4 py-6 space-y-6">
        {/* Empty State */}
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Ask anything about your documents
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                DocuDash AI searches your uploaded documents using vector similarity and
                answers using only what is in your files. Switch models with the button above.
              </p>
            </div>

            {/* Sample Questions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
                Try asking:
              </p>
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm transition-all group text-sm text-slate-700 font-medium"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0 transition" />
                    <span className="group-hover:text-indigo-700 transition">{q}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-3xl mx-auto flex gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                msg.role === "user"
                  ? "bg-indigo-600"
                  : msg.isError
                  ? "bg-rose-100"
                  : "bg-gradient-to-br from-violet-500 to-indigo-600"
              }`}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot
                  className={`w-4 h-4 ${msg.isError ? "text-rose-500" : "text-white"}`}
                />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`flex-1 max-w-[85%] ${
                msg.role === "user" ? "flex flex-col items-end" : ""
              }`}
            >
              <div
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xs ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : msg.isError
                    ? "bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-sm"
                    : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm"
                }`}
              >
                <MarkdownContent content={msg.content} isUser={msg.role === "user"} />
              </div>

              {/* Model badge on assistant messages */}
              {msg.role === "assistant" && !msg.isError && msg.model && (
                <div className="mt-1.5 flex items-center gap-1">
                  {MODEL_BADGE[msg.model].icon}
                  <span className="text-[10px] text-slate-400 font-medium">
                    {MODEL_BADGE[msg.model].label}
                  </span>
                </div>
              )}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 w-full">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Sources ({msg.sources.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((src) => (
                      <Link
                        key={src.documentId}
                        href="/documents"
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-xs group"
                      >
                        <FileText className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 shrink-0 transition" />
                        <span className="truncate max-w-[180px] text-slate-700 group-hover:text-indigo-700 transition">
                          {src.fileName}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                            CATEGORY_COLORS[src.category] || CATEGORY_COLORS.General
                          }`}
                        >
                          {src.category}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 shrink-0 transition" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="max-w-3xl mx-auto flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-violet-500 to-indigo-600 shadow-xs">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-xs">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>
                  Searching documents via{" "}
                  <span className="font-semibold">{MODEL_BADGE[selectedModel].label}</span>...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your documents..."
                rows={1}
                disabled={isLoading}
                style={{ resize: "none" }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition disabled:opacity-60 min-h-[48px] max-h-32 overflow-auto"
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 128) + "px";
                }}
              />
            </div>
            <button
              id="chat-send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-200 disabled:cursor-not-allowed text-white flex items-center justify-center transition shadow-sm shadow-indigo-200 shrink-0"
              title="Send message (Enter)"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">
              Enter
            </kbd>{" "}
            to send &nbsp;·&nbsp;{" "}
            <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">
              Shift + Enter
            </kbd>{" "}
            for new line
          </p>
        </div>
      </div>
    </div>
  );
}

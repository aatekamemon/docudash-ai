import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { generateEmbedding } from "@/lib/embeddings";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Provider config
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Types
type ModelProvider = "groq" | "gemini";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChunkMatch {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  similarity: number;
}

interface DocRecord {
  id: string;
  file_name: string;
  category: string;
}

// Intent detection for listing/count questions
const LISTING_PATTERNS = [
  /\bhow many (documents?|files?|records?|templates?|payslips?|statements?|invoices?|receipts?|policies|policy)\b/i,
  /\bhow many (finance|hr|legal|engineering|marketing|general)\b/i,
  /\bhow many.*in (total|docudash|the system|database)\b/i,
  /\bhow many.*do we have in total\b/i,
  /\btotal number of (documents?|files?|records?|templates?)\b/i,
  /\bcount of (documents?|files?)\b/i,
  /\bnumber of documents?\b/i,
  /\blist all\b/i,
  /\bshow all\b/i,
  /\ball documents?\b/i,
  /\ball (finance|hr|legal|engineering|marketing|general)\b/i,
  /\b(finance|hr|legal|engineering|marketing|general) documents?\b/i,
  /\bwhat documents? (do we have|are uploaded|are available|are in|exist)\b/i,
  /\bwhich documents? (do we have|are uploaded|are available|are in|exist)\b/i,
];

function detectListingIntent(question: string) {
  const q = question.toLowerCase();
  const isListing = LISTING_PATTERNS.some((p) => p.test(q));
  if (!isListing) return { isListing: false, categoryFilter: null, isCountOnly: false, keywordFilter: null };
  const isCountOnly = /\bhow many\b|\btotal number\b|\bcount\b|\bnumber of\b/.test(q);
  const categoryMatch = q.match(/\b(finance|hr|legal|engineering|marketing|general)\b/i);
  const keywordMatch = q.match(/\b(payslips?|bank statements?|invoices?|receipts?|policies|policy|ledgers?|cash flows?|trial balances?|purchase orders?)\b/i);
  return {
    isListing: true,
    categoryFilter: categoryMatch ? categoryMatch[1] : null,
    isCountOnly,
    keywordFilter: keywordMatch ? keywordMatch[1].replace(/s$/, "") : null,
  };
}

// Pronoun/ambiguity detector - only triggers LLM rewrite when needed.
// Standalone questions ("CSRM hr course") skip rewriting entirely so previous
// conversation context cannot contaminate unrelated vector searches.
const AMBIGUOUS_PATTERNS = [
  /\bit\b|\bits\b/i,
  /\bthat\b/i,
  /\bthis one\b/i,
  /\bthey\b|\btheir\b|\bthem\b/i,
  /\bthe (same|above|previous|first|second|third|last|other|another)\b/i,
  /\bmore about\b/i,
  /\btell me more\b/i,
  /\bwhat about\b/i,
  /\band (what|how|when|where|why)\b/i,
];

function needsRewrite(question: string, history: HistoryMessage[]): boolean {
  if (history.length === 0) return false;
  return AMBIGUOUS_PATTERNS.some((p) => p.test(question));
}

// LLM rewriter: only called when needsRewrite() is true.
async function rewriteQuestion(
  provider: ModelProvider,
  question: string,
  history: HistoryMessage[]
): Promise<string> {
  if (history.length === 0) return question;

  const snippet = history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 400)}`)
    .join("\n");

  const rewritePrompt = [
    "You are a query rewriter. Given a conversation and a follow-up question, rewrite the follow-up as a fully self-contained question.",
    "",
    "Rules:",
    '- Replace pronouns ("it", "that", "its", "they", etc.) with the actual entity from context.',
    "- If the follow-up is already standalone, return it EXACTLY as-is with no changes.",
    "- Return ONLY the rewritten question, nothing else.",
    "",
    "Conversation so far:",
    snippet,
    "",
    "Follow-up question: " + question,
    "",
    "Rewritten standalone question:",
  ].join("\n");

  try {
    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return question;
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      const result = await model.generateContent(rewritePrompt);
      return result.response.text().trim() || question;
    } else {
      const key = process.env.GROQ_API_KEY;
      if (!key) return question;
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: rewritePrompt }],
          temperature: 0,
          max_tokens: 120,
        }),
      });
      if (!res.ok) return question;
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || question;
    }
  } catch {
    return question;
  }
}

// LLM answer callers with conversation history
async function callGroq(
  systemPrompt: string,
  userMessage: string,
  history: HistoryMessage[]
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured in .env.local.");

  const historyTurns = history.slice(-8).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyTurns,
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "I could not generate an answer. Please try again.";
}

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  history: HistoryMessage[]
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured in .env.local.");

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction: systemPrompt });

  const geminiHistory = history.slice(-8).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text().trim() || "I could not generate an answer. Please try again.";
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("too many requests") || msg.toLowerCase().includes("rate limit")) {
      throw new Error("Model limit reached. The daily free-tier quota for Gemini has been exceeded. Please switch to Groq using the model button above, or try again tomorrow.");
    }
    throw err;
  }
}

async function generateAnswer(
  provider: ModelProvider,
  systemPrompt: string,
  userMessage: string,
  history: HistoryMessage[]
): Promise<string> {
  return provider === "gemini"
    ? callGemini(systemPrompt, userMessage, history)
    : callGroq(systemPrompt, userMessage, history);
}

// Main handler
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: "Supabase credentials are not configured." }, { status: 500 });
    }

    const body = await request.json();
    const { question, model: modelParam, history = [] } = body;
    const provider: ModelProvider = modelParam === "groq" ? "groq" : "gemini";
    const conversationHistory: HistoryMessage[] = Array.isArray(history) ? history : [];

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ success: false, error: "Question is required." }, { status: 400 });
    }

    const q = question.trim();

    // Route A: Listing / count - query documents table directly
    const intent = detectListingIntent(q);
    if (intent.isListing) {
      let dbQuery = supabase
        .from("documents")
        .select("id, file_name, category")
        .order("category", { ascending: true })
        .order("file_name", { ascending: true });

      if (intent.categoryFilter) {
        dbQuery = dbQuery.ilike("category", `%${intent.categoryFilter}%`);
      }

      const { data: allDocs, error: dbErr } = await dbQuery;
      if (dbErr) {
        return NextResponse.json({ success: false, error: `Database query failed: ${dbErr.message}` }, { status: 500 });
      }

      let docs: DocRecord[] = allDocs || [];
      if (intent.keywordFilter) {
        const kw = intent.keywordFilter.toLowerCase();
        docs = docs.filter((d) => d.file_name.toLowerCase().replace(/[_-]/g, " ").includes(kw));
      }
      const categoryLabel = intent.categoryFilter ? ` in the "${intent.categoryFilter}" category` : "";

      let listingContext: string;
      if (intent.isCountOnly && !intent.categoryFilter) {
        const byCat: Record<string, number> = {};
        docs.forEach((d) => { byCat[d.category] = (byCat[d.category] || 0) + 1; });
        const breakdown = Object.entries(byCat)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cat, cnt]) => `- ${cat}: ${cnt}`)
          .join("\n");
        listingContext = `Total documents: ${docs.length}\n\nBreakdown by category:\n${breakdown}`;
      } else {
        const grouped: Record<string, string[]> = {};
        docs.forEach((d) => {
          if (!grouped[d.category]) grouped[d.category] = [];
          grouped[d.category].push(d.file_name);
        });
        const sections = Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([cat, files]) => {
            return `**${cat}** (${files.length}):\n${files.map((f) => `  - ${f}`).join("\n")}`;
          })
          .join("\n\n");
        listingContext = `Total documents${categoryLabel}: ${docs.length}\n\n${sections}`;
      }

      const systemPrompt = `You are DocuDash AI. Present the EXACT document inventory data below clearly in natural language. Do NOT add or remove items.\n\nData:\n---\n${listingContext}\n---`;
      const answer = await generateAnswer(provider, systemPrompt, `Question: ${q}`, conversationHistory);
      const sources = docs.slice(0, 20).map((d) => ({ documentId: d.id, fileName: d.file_name, category: d.category }));

      return NextResponse.json({ success: true, answer, sources, routeUsed: "listing" });
    }

    // Route B: RAG - vector search with conditional LLM query rewriting

    // Step 1: Only rewrite if the question contains pronouns or implicit references.
    // Standalone questions skip the LLM call entirely so prior context cannot
    // contaminate unrelated searches.
    let standaloneQuestion = q;
    if (needsRewrite(q, conversationHistory)) {
      standaloneQuestion = await rewriteQuestion(provider, q, conversationHistory);
      console.log(`[chat] rewrite: "${q}" -> "${standaloneQuestion}"`);
    } else {
      console.log(`[chat] standalone (no rewrite): "${q}"`);
    }

    // Step 2: Direct Document Mention Lookup (Hybrid Retrieval)
    // If the question explicitly mentions a document title (e.g. "payslip 04", "invoice 11", "BYOD policy"),
    // fetch that document's chunks directly so they are guaranteed to be in context.
    const { data: allDocsList } = await supabase.from("documents").select("id, file_name, category");
    const normQ = standaloneQuestion.toLowerCase().replace(/[_-]/g, " ");
    const directDocs = (allDocsList || []).filter((d) => {
      const baseName = d.file_name.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      return normQ.includes(baseName) || (baseName.length > 5 && normQ.includes(baseName));
    });

    let directChunks: ChunkMatch[] = [];
    if (directDocs.length > 0) {
      const docIds = directDocs.map((d) => d.id);
      const { data: dChunks } = await supabase
        .from("document_chunks")
        .select("id, document_id, chunk_text, chunk_index")
        .in("document_id", docIds);
      if (dChunks) {
        directChunks = dChunks.map((c) => ({ ...c, similarity: 1.0 }));
      }
    }

    // Step 3: Vector similarity search
    const queryEmbedding = await generateEmbedding(standaloneQuestion);
    const { data: chunks, error: rpcErr } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.1,
      match_count: 6,
    });

    if (rpcErr) {
      return NextResponse.json({ success: false, error: `Similarity search failed: ${rpcErr.message}` }, { status: 500 });
    }

    // Merge direct chunks first, then vector chunks (deduplicated)
    const seenChunkIds = new Set<string>();
    const matchedChunks: ChunkMatch[] = [];
    for (const c of directChunks) {
      if (!seenChunkIds.has(c.id)) {
        seenChunkIds.add(c.id);
        matchedChunks.push(c);
      }
    }
    for (const c of (chunks || [])) {
      if (!seenChunkIds.has(c.id)) {
        seenChunkIds.add(c.id);
        matchedChunks.push(c);
      }
    }

    if (matchedChunks.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "I could not find any relevant information in the uploaded documents to answer your question.",
        sources: [],
        routeUsed: "rag",
      });
    }

    // Step 4: Fetch document metadata
    const documentIds = Array.from(new Set(matchedChunks.map((c) => c.document_id)));
    const { data: docData } = await supabase
      .from("documents")
      .select("id, file_name, category")
      .in("id", documentIds);

    const docMap: Record<string, { file_name: string; category: string }> = {};
    (docData || []).forEach((d) => { docMap[d.id] = { file_name: d.file_name, category: d.category }; });

    // Step 5: Build context
    const context = matchedChunks
      .map((chunk) => `[Document: ${docMap[chunk.document_id]?.file_name ?? "Unknown"}]\n${chunk.chunk_text}`)
      .join("\n\n---\n\n");

    // Step 6: System prompt with conversation memory instruction
    const systemPrompt = [
      "You are DocuDash AI, a helpful document assistant with memory of the current conversation.",
      "",
      "Rules:",
      "- Answer ONLY using the document excerpts provided below.",
      "- Use conversation history to understand follow-up questions and pronouns.",
      "- If the answer is not in the context, say: I could not find that information in the uploaded documents.",
      "- Be concise and cite document names.",
      "- Do NOT invent information.",
      "",
      "Document context:",
      "---",
      context,
      "---",
    ].join("\n");

    // Step 7: Generate answer using the original question (not rewritten) for natural tone,
    // but with full conversation history for context.
    const answer = await generateAnswer(provider, systemPrompt, q, conversationHistory);

    // Step 8: Sources
    const sources = documentIds.map((docId) => ({
      documentId: docId,
      fileName: docMap[docId]?.file_name ?? "Unknown Document",
      category: docMap[docId]?.category ?? "General",
    }));

    return NextResponse.json({
      success: true,
      answer,
      sources,
      routeUsed: "rag",
      ...(standaloneQuestion !== q ? { rewrittenQuestion: standaloneQuestion } : {}),
    });

  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : "Chat request failed.";
    console.error("Chat API error:", err);
    let userMsg = rawMsg;
    if (
      rawMsg.includes("429") ||
      rawMsg.toLowerCase().includes("quota") ||
      rawMsg.toLowerCase().includes("rate limit") ||
      rawMsg.toLowerCase().includes("too many requests")
    ) {
      userMsg = "Model limit reached. The quota for this model has been exceeded - please switch to another model using the selector above or try again later.";
    }
    return NextResponse.json({ success: false, error: userMsg }, { status: 500 });
  }
}

# 📄 DocuDash AI — Intelligent Multi-Document Intelligence & Semantic RAG Platform

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live_Demo-docudash--ai.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://docudash-ai.vercel.app)
[![Next.js 15](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Transformers.js](https://img.shields.io/badge/Transformers.js-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/docs/transformers.js)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini_2.0_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Groq Cloud](https://img.shields.io/badge/Groq_Cloud-Llama_3_70B-F55036?style=for-the-badge&logoColor=white)](https://groq.com)
[![Supabase pgvector](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

**Experience the live application:** [**https://docudash-ai.vercel.app ↗**](https://docudash-ai.vercel.app)

</div>

---

## 🌟 Overview

**DocuDash AI** is a full-stack, enterprise-grade AI document intelligence platform built with **Next.js 15 (App Router)**. It enables users to upload complex documents (PDFs, reports, manuals) and perform high-speed, accurate multi-document synthesis and conversational question-answering with zero hallucinations.

By combining **client-side vector embeddings** via **Transformers.js (`all-MiniLM-L6-v2`)**, **pgvector** for high-dimensional cosine similarity search, and a **hybrid dual-LLM architecture** (Google Gemini 2.0 Flash + Groq Llama-3-70B), DocuDash AI eliminates API embedding latency while delivering sub-second response times.

---

## 🚀 Key Features

- ⚡ **Zero-Latency In-Browser Embeddings**: Embeddings are computed locally using **ONNX Runtime Web / Transformers.js (`all-MiniLM-L6-v2`)**, generating 384-dimensional dense vectors with zero API calls.
- 🧠 **Hybrid Multi-Model Engine**:
  - **Google Gemini 2.0 Flash**: Fast, high-context comprehension and multimodal document extraction.
  - **Groq Llama-3-70B**: Lightning-fast streaming responses (>250 tokens/sec) for conversational Q&A.
- 🔍 **Vector Database with pgvector**: Semantic similarity search and cosine ranking powered by PostgreSQL + **pgvector** on Supabase.
- 📑 **Multi-Document Synthesis**: Cross-reference and extract answers across multiple documents in a single chat session.
- 🎯 **Verifiable Citations**: Every generated response includes direct snippet references and source page citations.
- 🎨 **Modern Minimalist UI**: Sleek dark/light interface built with **Tailwind CSS**, glassmorphic panels, and streaming markdown rendering.

---

## 🏗️ System Architecture

```
                  ┌────────────────────────────────────────┐
                  │          Next.js 15 Client             │
                  │   (Document Upload & Chunk Parser)     │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼
                  ┌────────────────────────────────────────┐
                  │       Transformers.js (ONNX)           │
                  │   (384-dim Dense Vector Embeddings)    │
                  └──────────────────┬─────────────────────┘
                                     │ Vectors & Chunks
                                     ▼
                  ┌────────────────────────────────────────┐
                  │      Supabase / PostgreSQL + pgvector  │
                  │   (Cosine Distance & HNSW Indexing)    │
                  └──────────────────┬─────────────────────┘
                                     │ Retrieved Relevant Chunks
                                     ▼
                  ┌────────────────────────────────────────┐
                  │          Hybrid LLM Router             │
                  │  Gemini 2.0 Flash  │   Groq Llama-3    │
                  └──────────────────┬─────────────────────┘
                                     │ Streaming Tokens
                                     ▼
                  ┌────────────────────────────────────────┐
                  │     Interactive Conversational UI      │
                  └────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
docudash-ai/
├── AI_project/
│   ├── app/                   # Next.js App Router (pages & API routes)
│   │   ├── api/chat/          # Streaming LLM endpoint (Gemini & Groq)
│   │   └── api/embed/         # Vector storage and query endpoints
│   ├── components/            # UI components (ChatBox, DocumentViewer, Sidebar)
│   ├── lib/
│   │   ├── embeddings.ts      # Transformers.js client-side pipeline
│   │   ├── supabase.ts        # Database client & vector queries
│   │   └── ai-providers.ts    # Dual LLM switching logic
│   ├── public/                # Static assets and icons
│   ├── next.config.ts         # ONNX runtime output file tracing configuration
│   └── package.json
└── README.md
```

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18+)
- [npm](https://www.npmjs.com) or [pnpm](https://pnpm.io)
- Supabase account with `pgvector` extension enabled
- Gemini API key and Groq API key

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/aatekamemon/docudash-ai.git
cd docudash-ai/AI_project

# Install dependencies
npm install
```

### 2. Environment Configuration
Create a `.env.local` file inside `AI_project/`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🌐 Deployment
DocuDash AI is configured for automated CI/CD deployment on [Vercel](https://vercel.com).
Live URL: **[https://docudash-ai.vercel.app](https://docudash-ai.vercel.app)**

---

## 🛡️ License
Distributed under the MIT License.

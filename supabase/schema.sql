-- ==============================================================================
-- DocuDash AI - Complete PostgreSQL Database Schema
-- Compatible with Supabase and Standard Self-Hosted PostgreSQL (with pgvector)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    category TEXT,
    storage_path TEXT NOT NULL,
    drive_file_id TEXT,
    extracted_text TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_drive_file_id ON public.documents(drive_file_id);

-- 3. Document Chunks Table (Vector Storage for RAG)
-- Embeddings generated with Xenova/all-MiniLM-L6-v2 (384 dimensions)
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    chunk_index INT NOT NULL,
    embedding vector(384)
);

-- Indexes for document chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON public.document_chunks(chunk_index);

-- Vector similarity search index (IVFFlat for cosine distance)
-- Note: Create after inserting initial data or with lists = 100
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 4. Vector Match Function (Used by /api/chat and /api/documents/search-chunks)
CREATE OR REPLACE FUNCTION public.match_document_chunks (
    query_embedding vector(384),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_text TEXT,
    chunk_index INT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.chunk_text,
        dc.chunk_index,
        (1 - (dc.embedding <=> query_embedding))::float AS similarity
    FROM public.document_chunks dc
    WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 5. Row Level Security (RLS) - Permissive defaults
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on documents"
ON public.documents FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on documents"
ON public.documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on documents"
ON public.documents FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on documents"
ON public.documents FOR DELETE USING (true);

CREATE POLICY "Allow public read access on document_chunks"
ON public.document_chunks FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on document_chunks"
ON public.document_chunks FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on document_chunks"
ON public.document_chunks FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on document_chunks"
ON public.document_chunks FOR DELETE USING (true);

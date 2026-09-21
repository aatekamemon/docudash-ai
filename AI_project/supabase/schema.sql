-- 1. Create the documents table
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

-- Migration steps for existing tables:
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- 2. Indexes for search and fast queries
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON public.documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_drive_file_id ON public.documents(drive_file_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4. Table RLS Policies
CREATE POLICY "Allow public read access on documents"
ON public.documents
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on documents"
ON public.documents
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access on documents"
ON public.documents
FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access on documents"
ON public.documents
FOR DELETE
USING (true);

-- 5. Storage RLS Policies (for "documents" bucket)
CREATE POLICY "Allow public storage insert"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Allow public storage select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'documents');

CREATE POLICY "Allow public storage delete"
ON storage.objects
FOR DELETE
USING (bucket_id = 'documents');

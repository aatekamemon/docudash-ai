export type FileCategory =
  | "Finance"
  | "HR"
  | "Legal"
  | "Engineering"
  | "Marketing"
  | "General";

export interface DocumentItem {
  id: string;
  file_name: string;
  file_type: string;
  category: FileCategory;
  storage_path: string;
  uploaded_at: string;
  drive_file_id?: string | null;
  extracted_text?: string | null;
  chunk_count?: number;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding?: number[];
  created_at: string;
  similarity?: number;
}

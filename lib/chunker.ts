export interface TextChunk {
  chunk_text: string;
  chunk_index: number;
}

/**
 * Splits text into chunks of approximately 300-500 words with ~50 words overlap.
 * Ensures context is preserved across chunk boundaries for semantic vector search.
 */
export function chunkText(
  text: string,
  targetChunkWords: number = 400,
  overlapWords: number = 50
): TextChunk[] {
  if (!text || typeof text !== "string") {
    return [];
  }

  const words = text
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return [];
  }

  if (words.length <= targetChunkWords) {
    return [
      {
        chunk_text: words.join(" "),
        chunk_index: 0,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  const step = Math.max(1, targetChunkWords - overlapWords);
  let chunkIndex = 0;

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + targetChunkWords);
    if (chunkWords.length === 0) break;

    chunks.push({
      chunk_text: chunkWords.join(" "),
      chunk_index: chunkIndex++,
    });

    if (i + targetChunkWords >= words.length) {
      break;
    }
  }

  return chunks;
}

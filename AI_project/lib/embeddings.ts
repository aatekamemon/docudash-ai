// Cache pipeline instance so the model loads once into memory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedderPipeline: any = null;

async function getEmbedder() {
  if (!embedderPipeline) {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false;
    env.useBrowserCache = false;
    if (env.backends && env.backends.onnx) {
      env.backends.onnx.backendPriority = ["wasm"];
      if (env.backends.onnx.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.proxy = false;
      }
    }
    embedderPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedderPipeline;
}

/**
 * Generates a 384-dimensional embedding vector for a single string using Xenova/all-MiniLM-L6-v2.
 * Output is L2-normalized so cosine similarity equals dot product.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const output = await pipe(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

/**
 * Generates 384-dimensional embeddings for a batch of strings.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const vector = await generateEmbedding(text);
    results.push(vector);
  }
  return results;
}

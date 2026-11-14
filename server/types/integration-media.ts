export interface MediaBucket {
  head(key: string): Promise<{ size: number } | null>;
  get(
    key: string,
    options: { range?: { offset: number; length: number } },
  ): Promise<{ body: ReadableStream } | null>;
  put(
    key: string,
    data: Uint8Array,
    options: { httpMetadata: { contentType: string } },
  ): Promise<{ size: number }>;
  delete(key: string): Promise<void>;
}

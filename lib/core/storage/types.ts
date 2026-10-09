/**
 * Where attachment bytes live. ERP code depends on this interface only — swapping
 * Supabase Storage for S3, Azure or a NAS is a new implementation of these three
 * methods, with no change to any business logic or stored metadata format.
 */
export interface StorageProvider {
  readonly name: "supabase" | "local";
  /** Stores bytes under a key the caller chose. Must refuse to overwrite. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

export class StorageUnavailableError extends Error {}


export type StorageProvider = 'local' | 's3';

export interface StorageAdapter {
  upload(
    key: string,
    data: Buffer,
  ): Promise<void>;

  delete(key: string): Promise<void>;

  getPublicUrl(key: string): string | null;
}

export const STORAGE_KEY_PATTERN =
  /^\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f-]{36}\.webp$/;

export function assertStorageKey(key: string): void {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new Error('INVALID_STORAGE_KEY');
  }
}

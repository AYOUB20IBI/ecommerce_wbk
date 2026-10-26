
import { Injectable } from '@nestjs/common';
import {
  mkdir,
  writeFile,
  unlink,
} from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

import {
  StorageAdapter,
  assertStorageKey,
} from './storage.interface';

@Injectable()
export class LocalStorageService implements StorageAdapter {
  private readonly root = resolve(
    process.env.MEDIA_STORAGE_PATH ??
      './storage/uploads',
  );

  private fullPath(key: string): string {
    assertStorageKey(key);
    return join(this.root, key);
  }

  async upload(
    key: string,
    data: Buffer,
  ): Promise<void> {
    const path = this.fullPath(key);

    await mkdir(dirname(path), {
      recursive: true,
    });

    // Never overwrite an existing file.
    await writeFile(path, data, {
      flag: 'wx',
      mode: 0o644,
    });
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.fullPath(key));
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'ENOENT'
      ) {
        throw error;
      }
    }
  }

  getPublicUrl(key: string): string | null {
    assertStorageKey(key);

    const base = process.env.MEDIA_PUBLIC_URL;

    if (!base) return null;

    return `${base.replace(/\/+$/, '')}/${key}`;
  }
}

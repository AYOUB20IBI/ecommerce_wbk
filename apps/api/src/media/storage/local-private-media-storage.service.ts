
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  realpath,
  unlink,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

const KEY_PATTERN =
  /^\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f-]{36}\.(pdf|txt|csv|xls|xlsx|zip|mp4)$/i;

const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error('INVALID_PRIVATE_MEDIA_KEY');
  }
}

@Injectable()
export class LocalPrivateMediaStorageService {
  private readonly root = resolve(
    process.env.MEDIA_PRIVATE_STORAGE_PATH ??
      './storage/private-media',
  );

  constructor() {
    const publicRoot = resolve(
      process.env.MEDIA_STORAGE_PATH ??
        './storage/uploads',
    );

    const relation = relative(publicRoot, this.root);

    // Prevent accidentally placing private files
    // inside a public static directory.
    if (
      relation === '' ||
      (
        !relation.startsWith(`..${sep}`) &&
        relation !== '..' &&
        !isAbsolute(relation)
      )
    ) {
      throw new Error(
        'MEDIA_PRIVATE_STORAGE_PATH must be outside public uploads.',
      );
    }
  }

  private pathFor(key: string): string {
    assertKey(key);
    return join(this.root, key);
  }

  makeKey(extension: string): string {
    const ext = extension.toLowerCase();

    if (
      ![
        'pdf',
        'txt',
        'csv',
        'xls',
        'xlsx',
        'zip',
        'mp4',
      ].includes(ext)
    ) {
      throw new Error('UNSUPPORTED_PRIVATE_EXTENSION');
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0');

    return `${year}/${month}/${randomUUID()}.${ext}`;
  }

  private async checkRoot(): Promise<void> {
    await mkdir(this.root, {
      recursive: true,
      mode: 0o700,
    });

    const actual = await realpath(this.root);

    if (actual !== this.root) {
      throw new InternalServerErrorException(
        'Private storage root must not be a symlink.',
      );
    }
  }

  async put(
    key: string,
    data: Buffer,
  ): Promise<void> {
    assertKey(key);

    if (!Buffer.isBuffer(data) || data.length === 0) {
      throw new Error('INVALID_PRIVATE_MEDIA_DATA');
    }

    await this.checkRoot();

    const target = this.pathFor(key);
    const folder = dirname(target);

    await mkdir(folder, {
      recursive: true,
      mode: 0o700,
    });

    const actualFolder = await realpath(folder);
    const expectedFolder = resolve(folder);

    if (actualFolder !== expectedFolder) {
      throw new InternalServerErrorException(
        'Unsafe private storage directory.',
      );
    }

    const handle = await open(target, 'wx', 0o600);

    try {
      await handle.writeFile(data);
    } catch (error) {
      await handle.close();
      await unlink(target).catch(() => undefined);
      throw error;
    }

    await handle.close();
  }

  async get(key: string): Promise<Buffer> {
    assertKey(key);

    await this.checkRoot();

    const target = this.pathFor(key);
    const folder = dirname(target);

    try {
      const actualFolder = await realpath(folder);

      if (actualFolder !== resolve(folder)) {
        throw new Error('UNSAFE_PRIVATE_DIRECTORY');
      }

      const handle = await open(target, 'r');

      try {
        const stats = await handle.stat();

        if (
          !stats.isFile() ||
          stats.size <= 0 ||
          stats.size > MAX_DOWNLOAD_BYTES
        ) {
          throw new Error('INVALID_PRIVATE_FILE_SIZE');
        }

        return await readFile(handle);
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        throw new NotFoundException({
          success: false,
          message: 'Private media file not found.',
        });
      }

      throw new InternalServerErrorException({
        success: false,
        message: 'Unable to read private media file.',
      });
    }
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.checkRoot();

    const target = this.pathFor(key);

    try {
      const actualFolder = await realpath(
        dirname(target),
      );

      if (actualFolder !== resolve(dirname(target))) {
        throw new Error('UNSAFE_PRIVATE_DIRECTORY');
      }

      await unlink(target);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return;
      }

      throw error;
    }
  }
}

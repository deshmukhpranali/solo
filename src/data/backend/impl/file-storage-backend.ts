// SPDX-License-Identifier: Apache-2.0

import {type StorageBackend} from '../api/storage-backend.js';
import {StorageOperation} from '../api/storage-operation.js';
import {type Stats, statSync, lstatSync, readdirSync, writeFileSync, unlinkSync} from 'node:fs';
import {StorageBackendError} from '../api/storage-backend-error.js';
import {IllegalArgumentError} from '../../../core/errors/illegal-argument-error.js';
import {readFileSync} from 'node:fs';
import {PathEx} from '../../../business/utils/path-ex.js';

/**
 * A file storage backend that operates on files within a specified base path. This backend does not support recursive
 * operations into subfolders and only operates on files contained within the specified base path. All directory entries
 * are ignored.
 */
export class FileStorageBackend implements StorageBackend {
  /**
   * Creates a new file storage backend bound to the specified base path. The basic file storage backend does not support
   * recursive operations into subfolders and only operates on files contained within the specified base path.
   * All directory entries are ignored.
   *
   * @param basePath - The base path to use for all file operations.
   * @throws IllegalArgumentError if the base path is null, undefined, or empty.
   * @throws StorageBackendError if the base path does not exist or is not a directory.
   */
  public constructor(public readonly basePath: string) {
    if (!basePath || basePath.trim().length === 0) {
      throw new IllegalArgumentError('basePath must not be null, undefined or empty');
    }

    let stats: Stats;
    try {
      stats = lstatSync(basePath);
    } catch (error) {
      throw new StorageBackendError('basePath must exist and be valid', error);
    }

    if (!stats || !stats.isDirectory()) {
      throw new StorageBackendError(`basePath must be a valid directory: ${basePath}`);
    }
  }

  public isSupported(op: StorageOperation): boolean {
    switch (op) {
      case StorageOperation.List:
      case StorageOperation.ReadBytes:
      case StorageOperation.WriteBytes:
      case StorageOperation.Delete: {
        return true;
      }
      default: {
        return false;
      }
    }
  }

  public async list(): Promise<string[]> {
    try {
      const entries: string[] = readdirSync(this.basePath, {encoding: 'utf-8', recursive: false});

      if (entries.length === 0) {
        return [];
      }

      return entries.filter(item => statSync(PathEx.join(this.basePath, item))?.isFile());
    } catch (error) {
      throw new StorageBackendError('Error listing files in base path', error);
    }
  }

  public async readBytes(key: string): Promise<Buffer> {
    if (!key || key.trim().length === 0) {
      throw new IllegalArgumentError('key must not be null, undefined or empty');
    }

    const filePath: string = PathEx.join(this.basePath, key);
    try {
      return readFileSync(filePath);
    } catch (error) {
      throw new StorageBackendError(`error reading file: ${filePath}`, error);
    }
  }

  public async writeBytes(key: string, data: Buffer): Promise<void> {
    if (!key || key.trim().length === 0) {
      throw new IllegalArgumentError('key must not be null, undefined or empty');
    }

    if (!data) {
      throw new IllegalArgumentError('data must not be null or undefined');
    }

    const filePath: string = PathEx.join(this.basePath, key);
    try {
      writeFileSync(filePath, data, {flag: 'w'});
    } catch (error) {
      throw new StorageBackendError(`error writing file: ${filePath}`, error);
    }
  }

  public async delete(key: string): Promise<void> {
    if (!key || key.trim().length === 0) {
      throw new IllegalArgumentError('key must not be null, undefined or empty');
    }

    const filePath: string = PathEx.join(this.basePath, key);
    let stats: Stats;
    try {
      stats = statSync(filePath);
    } catch (error) {
      throw new StorageBackendError(`file not found or is not readable: ${filePath}`, error);
    }

    if (!stats) {
      throw new StorageBackendError(`file not found: ${filePath}`);
    }

    if (!stats.isFile()) {
      throw new StorageBackendError(`path is not a file: ${filePath}`);
    }

    try {
      unlinkSync(filePath);
    } catch (error) {
      throw new StorageBackendError(`error deleting file: ${filePath}`, error);
    }
  }
}

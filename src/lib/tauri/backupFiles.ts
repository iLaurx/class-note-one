import { invoke, isTauri } from '@tauri-apps/api/core';
import { BackupOperationError, type BackupErrorCode } from '../../services/backup/errors.ts';

async function fileCommand<T>(
  command: string,
  code: BackupErrorCode,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri())
    throw new Error('Abre ClassNote de escritorio para elegir el archivo de respaldo.');
  try {
    return await invoke<T>(command, args);
  } catch (cause) {
    throw new BackupOperationError(code, cause);
  }
}
export const openBackup = () => fileCommand<string | null>('open_backup', 'file-read');
export const saveBackup = (source: string, previous = false) =>
  fileCommand<boolean>('save_backup', previous ? 'previous-save' : 'file-write', {
    source,
    previous,
  });

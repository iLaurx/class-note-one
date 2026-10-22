import { ClassNoteDatabase } from '../../db/database.ts';
import { requireRule } from '../../domain/validation.ts';
import { parseBackup, TABLE_NAMES, validateRows, type BackupRows } from './validation.ts';
import { asBackupError } from './errors.ts';
import { APP_VERSION } from './version.ts';

// Lazy import keeps the addon and file readers out of ordinary application startup.
const addon = () => import('dexie-export-import');
export type BackupPreview = Omit<ReturnType<typeof parseBackup>, 'rows' | 'payload'>;
function stable(value: unknown): string {
  return JSON.stringify(value, (_, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
}
function stableRows(rows: BackupRows): string {
  return JSON.stringify(
    Object.fromEntries(
      TABLE_NAMES.map((name) => [
        name,
        [...rows[name]].sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key))),
      ]),
    ),
    (_, item: unknown) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
        : item,
  );
}
async function snapshot(db: ClassNoteDatabase): Promise<BackupRows> {
  const rows = Object.fromEntries(
    await Promise.all(TABLE_NAMES.map(async (name) => [name, await db.table(name).toArray()])),
  ) as BackupRows;
  return rows;
}
export class BackupService {
  private readonly db: ClassNoteDatabase;
  constructor(db: ClassNoteDatabase) {
    this.db = db;
  }

  async export(): Promise<string> {
    return (await this.capture()).source;
  }

  private async capture() {
    const { exportDB } = await addon();
    const { blob, rows } = await this.db.transaction('r', this.db.tables, async () => ({
      rows: await snapshot(this.db),
      blob: await exportDB(this.db),
    }));
    const data: unknown = JSON.parse(await blob.text());
    // Only the stable product name is portable; temporary test DB names never enter files.
    recordDatabaseName(data);
    const source = JSON.stringify({
      format: 'classnote-backup',
      formatVersion: 1,
      appVersion: APP_VERSION,
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      data,
    });
    return { source, rows };
  }

  async preview(source: string): Promise<BackupPreview> {
    const { createdAt, appVersion, schemaVersion, formatVersion, counts } =
      await this.validate(source);
    return { createdAt, appVersion, schemaVersion, formatVersion, counts };
  }

  private async validate(source: string) {
    const parsed = parseBackup(source);
    const temporary = new ClassNoteDatabase(`classnote-restore-validation-${crypto.randomUUID()}`);
    let imported: BackupRows;
    try {
      try {
        await temporary.open();
        const { importInto } = await addon();
        await importInto(temporary, new Blob([JSON.stringify(parsed.payload)]), {
          acceptNameDiff: true,
        });
        imported = await temporary.transaction('r', temporary.tables, () => snapshot(temporary));
      } catch (cause) {
        throw asBackupError('temporary-import', cause);
      }
      if (stableRows(imported) !== stableRows(parsed.rows))
        throw asBackupError(
          'invalid-data',
          new Error('La importación no conservó todos los registros.'),
        );
      try {
        validateRows(imported);
      } catch (cause) {
        throw asBackupError('invalid-data', cause);
      }
    } catch (cause) {
      // Only this isolated, newly created staging database is ever deleted.
      try {
        await temporary.delete();
      } catch (cleanupCause) {
        throw asBackupError('temporary-import', cleanupCause);
      }
      throw cause;
    }
    try {
      await temporary.delete();
    } catch (cause) {
      throw asBackupError('temporary-import', cause);
    }
    return { ...parsed, rows: imported };
  }

  async restore(
    source: string,
    confirmed: boolean,
    savePrevious: (source: string) => Promise<boolean>,
  ): Promise<boolean> {
    if (!confirmed) return false;
    const validated = await this.validate(source);
    let previous: Awaited<ReturnType<BackupService['capture']>>;
    try {
      previous = await this.capture();
    } catch (cause) {
      throw asBackupError('previous-export', cause);
    }
    try {
      if (!(await savePrevious(previous.source))) return false;
    } catch (cause) {
      throw asBackupError('previous-save', cause);
    }
    try {
      await this.db.transaction('rw', this.db.tables, async () => {
        requireRule(
          stable(await snapshot(this.db)) === stable(previous.rows),
          'Los datos cambiaron mientras guardabas el respaldo previo. Revisa y vuelve a confirmar la restauración.',
        );
        for (const name of TABLE_NAMES) {
          await this.db.table(name).clear();
          await this.db.table(name).bulkAdd(validated.rows[name]);
        }
      });
    } catch (cause) {
      throw asBackupError('active-write', cause);
    }
    return true;
  }
}

function recordDatabaseName(value: unknown) {
  // The exporter owns this structure; validation of untrusted files is separate.
  const data = value as { data: { databaseName: string } };
  data.data.databaseName = 'classnote';
}

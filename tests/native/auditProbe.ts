import { ClassNoteDatabase } from '../../src/db/database';
import { Repositories } from '../../src/db/repositories';
import { BackupService } from '../../src/services/backup/backupService';

const db = new ClassNoteDatabase('classnote');
const audit = { db, r: new Repositories(db), backup: new BackupService(db) };
declare global {
  interface Window {
    classNoteAudit: typeof audit;
  }
}
window.classNoteAudit = audit;

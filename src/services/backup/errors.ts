export type BackupErrorCode =
  | 'file-read'
  | 'file-write'
  | 'invalid-json'
  | 'incompatible'
  | 'invalid-data'
  | 'temporary-import'
  | 'previous-export'
  | 'previous-save'
  | 'active-write'
  | 'unknown';

export class BackupOperationError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, cause?: unknown) {
    super('La operación de respaldo no se pudo completar.', { cause });
    this.name = 'BackupOperationError';
    this.code = code;
  }
}

export function asBackupError(code: BackupErrorCode, cause: unknown): BackupOperationError {
  return cause instanceof BackupOperationError ? cause : new BackupOperationError(code, cause);
}

export function backupErrorMessage(error: unknown): string {
  const code = error instanceof BackupOperationError ? error.code : 'unknown';
  switch (code) {
    case 'file-read':
      return 'No se pudo leer el archivo seleccionado. Comprueba que el archivo siga disponible y que tengas permiso para abrirlo.';
    case 'file-write':
      return 'No se pudo guardar el archivo de respaldo. Revisa los permisos y el espacio disponible.';
    case 'invalid-json':
      return 'El archivo no contiene un JSON válido o está incompleto. La base no fue modificada.';
    case 'incompatible':
      return 'Este archivo no es compatible con la versión de ClassNote. La base no fue modificada.';
    case 'invalid-data':
      return 'El respaldo contiene tablas, registros o relaciones inválidos. La base no fue modificada.';
    case 'temporary-import':
      return 'ClassNote no pudo comprobar todos los datos del respaldo en una base temporal. La base activa se conserva.';
    case 'previous-export':
      return 'No se pudo preparar un respaldo previo de los datos actuales. La base no fue reemplazada.';
    case 'previous-save':
      return 'No se pudo guardar el respaldo previo. Revisa los permisos y el espacio disponible; la base no fue reemplazada.';
    case 'active-write':
      return 'Falló la restauración y la base activa se conservó sin cambios. Puedes revisar el espacio disponible e intentarlo de nuevo.';
    default:
      return 'Ocurrió un error inesperado al procesar el respaldo. La base activa se conserva.';
  }
}

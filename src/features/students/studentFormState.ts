import type { Student, Enrollment } from '../../domain/models';
export type StudentFormState =
  | { kind: 'new' }
  | { kind: 'edit'; student: Student }
  | { kind: 'dates' | 'leave' | 'reactivate'; enrollment: Enrollment }
  | { kind: 'archive'; student: Student };

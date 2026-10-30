// School Directory API Service
// Connects the admin Subjects, Classes and Teachers screens to the Express API so
// curriculum subjects, class cohorts and faculty records persist to Supabase.
// Writes are server-authoritative: success is only reported once the backend has
// confirmed the record. Reads fall back to the last confirmed local cache when the
// server is unreachable, but never invent records.

import { Subject, ClassGroup, Teacher } from '../types/learner';
import { authService } from './auth-service';
import { appDataStore } from './storage';

export interface SubjectInput {
  name: string;
  code: string;
  topicCount: number;
  description?: string;
  gradeLevels: string[];
}

export interface SubjectUpdates extends Partial<SubjectInput> {}

export interface ClassInput {
  name: string;
  grade: string;
  classTeacherId: string;
  classTeacherName: string;
  room?: string;
  subjectIds: string[];
}

export interface ClassUpdates extends Partial<ClassInput> {}

export interface TeacherInput {
  name: string;
  email: string;
  role: Teacher['role'];
  assignedClasses: string[];
  assignedSubjects: string[];
  password?: string;
}

export interface TeacherUpdates extends Partial<TeacherInput> {
  isActive?: boolean;
}

function getAuthHeader(): Record<string, string> {
  const token = authService.getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Issues a JSON request and extracts the resource from the response, surfacing the
// server's error message for any non-2xx response.
async function send<T>(
  url: string,
  method: 'POST' | 'PUT',
  body: unknown,
  pick: (data: any) => T | undefined,
  fallbackMessage: string
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    const value = pick(data);
    if (value !== undefined && value !== null) return value;
    throw new Error('Invalid response from server.');
  }

  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || fallbackMessage);
}

async function collect<T>(url: string, key: string, apply: (items: T[]) => void): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data[key])) {
        apply(data[key] as T[]);
        return true;
      }
    }
  } catch {
    // Fall back to the locally cached copy.
  }
  return false;
}

// --- SUBJECTS ---

async function fetchSubjects(): Promise<Subject[]> {
  await collect<Subject>('/api/subjects', 'subjects', (items) => appDataStore.setSubjects(items));
  return appDataStore.getSubjects();
}

async function createSubject(input: SubjectInput): Promise<Subject> {
  const created = await send<Subject>('/api/subjects', 'POST', input, (d) => d.subject, 'Failed to save the subject on the server.');
  appDataStore.upsertSubject(created);
  return created;
}

async function updateSubject(id: string, updates: SubjectUpdates): Promise<Subject> {
  const updated = await send<Subject>(
    `/api/subjects/${encodeURIComponent(id)}`,
    'PUT',
    updates,
    (d) => d.subject,
    'Failed to update the subject on the server.'
  );
  appDataStore.upsertSubject(updated);
  return updated;
}

// --- CLASSES / GRADES ---

async function fetchClasses(): Promise<ClassGroup[]> {
  await collect<ClassGroup>('/api/classes', 'classes', (items) => appDataStore.setClasses(items));
  return appDataStore.getClasses();
}

async function createClass(input: ClassInput): Promise<ClassGroup> {
  const created = await send<ClassGroup>('/api/classes', 'POST', input, (d) => d.class, 'Failed to save the class on the server.');
  appDataStore.upsertClass(created);
  return created;
}

async function updateClass(id: string, updates: ClassUpdates): Promise<ClassGroup> {
  const updated = await send<ClassGroup>(
    `/api/classes/${encodeURIComponent(id)}`,
    'PUT',
    updates,
    (d) => d.class,
    'Failed to update the class on the server.'
  );
  appDataStore.upsertClass(updated);
  return updated;
}

// --- TEACHERS / FACULTY ---

async function fetchTeachers(): Promise<Teacher[]> {
  await collect<Teacher>('/api/teachers', 'teachers', (items) => appDataStore.setTeachers(items));
  return appDataStore.getTeachers();
}

async function createTeacher(input: TeacherInput): Promise<Teacher> {
  const created = await send<Teacher>('/api/teachers', 'POST', input, (d) => d.teacher, 'Failed to save the teacher on the server.');
  appDataStore.upsertTeacher(created);
  return created;
}

async function updateTeacher(id: string, updates: TeacherUpdates): Promise<Teacher> {
  const updated = await send<Teacher>(
    `/api/teachers/${encodeURIComponent(id)}`,
    'PUT',
    updates,
    (d) => d.teacher,
    'Failed to update the teacher on the server.'
  );
  appDataStore.upsertTeacher(updated);
  return updated;
}

// Hydrate the whole directory. Subjects and teachers are loaded before classes so
// that class form teachers and curriculum subjects can be resolved by name.
async function hydrateDirectory(): Promise<void> {
  await fetchSubjects();
  await fetchTeachers();
  await fetchClasses();
}

export const directoryApiService = {
  fetchSubjects,
  createSubject,
  updateSubject,
  fetchClasses,
  createClass,
  updateClass,
  fetchTeachers,
  createTeacher,
  updateTeacher,
  hydrateDirectory,
};

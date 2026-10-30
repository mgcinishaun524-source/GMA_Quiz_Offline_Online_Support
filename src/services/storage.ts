// Persistent Application Store (Local Persistence + IndexedDB Sync)
import { Learner, Teacher, ClassGroup, Subject } from '../types/learner';
import { Quiz } from '../types/quiz';
import { Submission } from '../types/submission';
import { cacheQuizOffline } from '../lib/offline-db';

const STORAGE_KEYS = {
  LEARNERS: 'GMA_STORE_LEARNERS',
  TEACHERS: 'GMA_STORE_TEACHERS',
  CLASSES: 'GMA_STORE_CLASSES',
  SUBJECTS: 'GMA_STORE_SUBJECTS',
  QUIZZES: 'GMA_STORE_QUIZZES',
  SUBMISSIONS: 'GMA_STORE_SUBMISSIONS',
  SETTINGS: 'GMA_STORE_SETTINGS',
};

export interface SchoolSettings {
  schoolName: string;
  motto: string;
  academicYear: string;
  currentTerm: string;
  termEndDate: string;
  defaultPassMark: number;
  allowOfflineQuizzes: boolean;
  defaultReleasePolicy: 'manual' | 'automatic';
  autoSyncIntervalSeconds: number;
}

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'Growing Minds Academy',
  motto: 'Cultivating Inquiring Minds, Resilient Hearts',
  academicYear: '2026-2027',
  currentTerm: 'Term 2',
  termEndDate: '2026-12-18',
  defaultPassMark: 60,
  allowOfflineQuizzes: true,
  defaultReleasePolicy: 'manual',
  autoSyncIntervalSeconds: 30,
};

class DataStore {
  private learners: Learner[] = [];
  private teachers: Teacher[] = [];
  private classes: ClassGroup[] = [];
  private subjects: Subject[] = [];
  private quizzes: Quiz[] = [];
  private submissions: Submission[] = [];
  private settings: SchoolSettings = DEFAULT_SETTINGS;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Load whatever is already cached locally. Nothing is seeded: operational
    // records are served from the configured database, never from fixtures.
    this.learners = this.load(STORAGE_KEYS.LEARNERS, []);
    this.teachers = this.load(STORAGE_KEYS.TEACHERS, []);
    this.classes = this.load(STORAGE_KEYS.CLASSES, []);
    this.subjects = this.load(STORAGE_KEYS.SUBJECTS, []);
    this.quizzes = this.load(STORAGE_KEYS.QUIZZES, []);
    this.submissions = this.load(STORAGE_KEYS.SUBMISSIONS, []);
    this.settings = this.load(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

    // Cache previously granted offline quizzes to IndexedDB
    this.quizzes.forEach((quiz) => {
      if (quiz.allowOffline && (quiz.status === 'published' || quiz.status === 'in_progress')) {
        cacheQuizOffline(quiz);
      }
    });
  }

  // Reads the locally cached copy of a collection. Never writes a default into
  // storage, so an empty cache stays empty until real data arrives from the server.
  private load<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Malformed cached payload; fall through to the provided default.
    }
    return fallback;
  }

  private save<T>(key: string, data: T) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.notify();
    } catch (e) {
      console.error('Storage save error:', e);
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // --- LEARNERS ---
  public getLearners(): Learner[] {
    return [...this.learners];
  }

  public getLearnerById(id: string): Learner | undefined {
    return this.learners.find((l) => l.id === id);
  }

  public addLearner(learner: Omit<Learner, 'id' | 'enrolledDate'>): Learner {
    const year = new Date().getFullYear();
    const count = (this.learners.length + 1).toString().padStart(4, '0');
    const newLearner: Learner = {
      ...learner,
      id: `GMA-${year}-${count}`,
      enrolledDate: new Date().toISOString(),
    };
    this.learners.unshift(newLearner);
    this.save(STORAGE_KEYS.LEARNERS, this.learners);
    return newLearner;
  }

  // Replace the learner directory (used when hydrating from the server)
  public setLearners(learners: Learner[]): void {
    this.learners = [...learners];
    this.save(STORAGE_KEYS.LEARNERS, this.learners);
  }

  // Insert or update a single learner record by id
  public upsertLearner(learner: Learner): Learner {
    const idx = this.learners.findIndex((l) => l.id === learner.id);
    if (idx !== -1) {
      this.learners[idx] = { ...this.learners[idx], ...learner };
    } else {
      this.learners.unshift(learner);
    }
    this.save(STORAGE_KEYS.LEARNERS, this.learners);
    return learner;
  }

  public updateLearner(id: string, updates: Partial<Learner>): Learner | null {
    const idx = this.learners.findIndex((l) => l.id === id);
    if (idx === -1) return null;
    this.learners[idx] = { ...this.learners[idx], ...updates };
    this.save(STORAGE_KEYS.LEARNERS, this.learners);
    return this.learners[idx];
  }

  public deleteLearner(id: string): boolean {
    const initialLen = this.learners.length;
    this.learners = this.learners.filter((l) => l.id !== id);
    if (this.learners.length !== initialLen) {
      this.save(STORAGE_KEYS.LEARNERS, this.learners);
      return true;
    }
    return false;
  }

  // --- TEACHERS ---
  public getTeachers(): Teacher[] {
    return [...this.teachers];
  }

  public addTeacher(teacher: Omit<Teacher, 'id' | 'joinedDate'>): Teacher {
    const newTeacher: Teacher = {
      ...teacher,
      id: `t-${Date.now()}`,
      joinedDate: new Date().toISOString(),
    };
    this.teachers.unshift(newTeacher);
    this.save(STORAGE_KEYS.TEACHERS, this.teachers);
    return newTeacher;
  }

  // Replace the teacher directory (used when hydrating from the server)
  public setTeachers(teachers: Teacher[]): void {
    this.teachers = [...teachers];
    this.save(STORAGE_KEYS.TEACHERS, this.teachers);
  }

  // Insert or update a single teacher record by id
  public upsertTeacher(teacher: Teacher): Teacher {
    const idx = this.teachers.findIndex((t) => t.id === teacher.id);
    if (idx !== -1) {
      this.teachers[idx] = { ...this.teachers[idx], ...teacher };
    } else {
      this.teachers.unshift(teacher);
    }
    this.save(STORAGE_KEYS.TEACHERS, this.teachers);
    return teacher;
  }

  public updateTeacher(id: string, updates: Partial<Teacher>): Teacher | null {
    const idx = this.teachers.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.teachers[idx] = { ...this.teachers[idx], ...updates };
    this.save(STORAGE_KEYS.TEACHERS, this.teachers);
    return this.teachers[idx];
  }

  // --- CLASSES ---
  public getClasses(): ClassGroup[] {
    return [...this.classes];
  }

  public addClass(cls: Omit<ClassGroup, 'id' | 'learnerCount'>): ClassGroup {
    const newClass: ClassGroup = {
      ...cls,
      id: `cls-${Date.now()}`,
      learnerCount: 0,
    };
    this.classes.push(newClass);
    this.save(STORAGE_KEYS.CLASSES, this.classes);
    return newClass;
  }

  // Replace the class directory (used when hydrating from the server)
  public setClasses(classes: ClassGroup[]): void {
    this.classes = [...classes];
    this.save(STORAGE_KEYS.CLASSES, this.classes);
  }

  // Insert or update a single class record by id
  public upsertClass(cls: ClassGroup): ClassGroup {
    const idx = this.classes.findIndex((c) => c.id === cls.id);
    if (idx !== -1) {
      this.classes[idx] = { ...this.classes[idx], ...cls };
    } else {
      this.classes.push(cls);
    }
    this.save(STORAGE_KEYS.CLASSES, this.classes);
    return cls;
  }

  public updateClass(id: string, updates: Partial<ClassGroup>): ClassGroup | null {
    const idx = this.classes.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.classes[idx] = { ...this.classes[idx], ...updates };
    this.save(STORAGE_KEYS.CLASSES, this.classes);
    return this.classes[idx];
  }

  // --- SUBJECTS ---
  public getSubjects(): Subject[] {
    return [...this.subjects];
  }

  public addSubject(subject: Omit<Subject, 'id'>): Subject {
    const newSubj: Subject = {
      ...subject,
      id: `subj-${Date.now()}`,
    };
    this.subjects.push(newSubj);
    this.save(STORAGE_KEYS.SUBJECTS, this.subjects);
    return newSubj;
  }

  // Replace the subject directory (used when hydrating from the server)
  public setSubjects(subjects: Subject[]): void {
    this.subjects = [...subjects];
    this.save(STORAGE_KEYS.SUBJECTS, this.subjects);
  }

  // Insert or update a single subject record by id
  public upsertSubject(subject: Subject): Subject {
    const idx = this.subjects.findIndex((s) => s.id === subject.id);
    if (idx !== -1) {
      this.subjects[idx] = { ...this.subjects[idx], ...subject };
    } else {
      this.subjects.push(subject);
    }
    this.save(STORAGE_KEYS.SUBJECTS, this.subjects);
    return subject;
  }

  public updateSubject(id: string, updates: Partial<Subject>): Subject | null {
    const idx = this.subjects.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.subjects[idx] = { ...this.subjects[idx], ...updates };
    this.save(STORAGE_KEYS.SUBJECTS, this.subjects);
    return this.subjects[idx];
  }

  // --- QUIZZES ---
  public getQuizzes(): Quiz[] {
    return [...this.quizzes];
  }

  public getQuizById(id: string): Quiz | undefined {
    return this.quizzes.find((q) => q.id === id);
  }

  public saveQuiz(quiz: Quiz): Quiz {
    const idx = this.quizzes.findIndex((q) => q.id === quiz.id);
    if (idx !== -1) {
      this.quizzes[idx] = quiz;
    } else {
      this.quizzes.unshift(quiz);
    }
    this.save(STORAGE_KEYS.QUIZZES, this.quizzes);

    if (quiz.allowOffline && (quiz.status === 'published' || quiz.status === 'in_progress')) {
      cacheQuizOffline(quiz);
    }
    return quiz;
  }

  public duplicateQuiz(id: string): Quiz | null {
    const orig = this.getQuizById(id);
    if (!orig) return null;
    const duplicated: Quiz = {
      ...orig,
      id: `quiz-${Date.now()}`,
      title: `${orig.title} (Copy)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      publishedAt: undefined,
      closedAt: undefined,
      resultsReleasedAt: undefined,
    };
    this.quizzes.unshift(duplicated);
    this.save(STORAGE_KEYS.QUIZZES, this.quizzes);
    return duplicated;
  }

  public updateQuizStatus(
    id: string,
    status: Quiz['status'],
    releaseNotes?: string
  ): Quiz | null {
    const quiz = this.getQuizById(id);
    if (!quiz) return null;

    const updates: Partial<Quiz> = { status };
    if (status === 'published' || status === 'in_progress') {
      updates.publishedAt = quiz.publishedAt || new Date().toISOString();
    }
    if (status === 'closed') {
      updates.closedAt = new Date().toISOString();
    }
    if (status === 'results_released') {
      updates.resultsReleasedAt = new Date().toISOString();
    }

    const updated = { ...quiz, ...updates };
    return this.saveQuiz(updated);
  }

  // --- SUBMISSIONS ---
  public getSubmissions(): Submission[] {
    return [...this.submissions];
  }

  public getSubmissionsByQuiz(quizId: string): Submission[] {
    return this.submissions.filter((s) => s.quizId === quizId);
  }

  public getSubmissionsByLearner(learnerId: string): Submission[] {
    return this.submissions.filter((s) => s.learnerId === learnerId);
  }

  public saveSubmission(submission: Submission): Submission {
    // Idempotency: match by ID or clientSubmissionHash
    const idx = this.submissions.findIndex(
      (s) => s.id === submission.id || (submission.clientSubmissionHash && s.clientSubmissionHash === submission.clientSubmissionHash)
    );

    if (idx !== -1) {
      this.submissions[idx] = submission;
    } else {
      this.submissions.unshift(submission);
    }
    this.save(STORAGE_KEYS.SUBMISSIONS, this.submissions);
    return submission;
  }

  // --- SETTINGS ---
  public getSettings(): SchoolSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<SchoolSettings>): SchoolSettings {
    this.settings = { ...this.settings, ...updates };
    this.save(STORAGE_KEYS.SETTINGS, this.settings);
    return this.settings;
  }
}

export const appDataStore = new DataStore();

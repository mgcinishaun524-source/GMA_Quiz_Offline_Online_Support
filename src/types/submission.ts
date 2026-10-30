// Submission and Result Types

export type SubmissionStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'saved_offline'
  | 'pending_sync'
  | 'synced'
  | 'marked';

export type SyncStatus = 'synced' | 'pending' | 'offline_queued' | 'sync_error';

export interface AnswerRecord {
  questionId: string;
  response: string; // optionId or boolean string or short text
  isCorrect?: boolean;
  marksAwarded?: number;
  maxMarks?: number;
}

export interface Submission {
  id: string; // Idempotent submission UUID
  quizId: string;
  quizTitle: string;
  subjectName: string;
  learnerId: string;
  learnerName: string;
  classId: string;
  className: string;
  answers: Record<string, string>; // questionId -> response
  answerDetails?: AnswerRecord[];
  score: number;
  totalMarks: number;
  percentage: number;
  status: SubmissionStatus;
  syncStatus: SyncStatus;
  isOfflineSubmission: boolean;
  submittedAt?: string;
  syncedAt?: string;
  teacherFeedback?: string;
  topicsToPractise?: string[];
  clientSubmissionHash: string; // Idempotency key
}

// Quiz and Question Data Models

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizStatus = 'draft' | 'published' | 'in_progress' | 'closed' | 'results_released';
export type ReleasePolicy = 'manual' | 'automatic';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[]; // for multiple choice
  correctAnswer: string; // option id for MCQ, "true"/"false" for TF, text for short answer
  marks: number;
  topic: string;
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  grade: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  topicsCovered: string[];
  learningObjectives?: string;
  difficulty: QuizDifficulty;
  durationMinutes: number;
  instructions?: string;
  questions: Question[];
  status: QuizStatus;
  releasePolicy: ReleasePolicy;
  allowOffline: boolean;
  maxAttempts: number;
  createdAt: string;
  publishedAt?: string;
  closedAt?: string;
  resultsReleasedAt?: string;
  authorId: string;
  authorName: string;
  schoolId?: string;
  isCachedOffline?: boolean;
  dueDate?: string;
}

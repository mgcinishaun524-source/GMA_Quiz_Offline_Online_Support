// AI Quiz Generation Service
// Requests server-side Gemini drafting with batching and deduplication.
//
// There is deliberately NO local/synthetic fallback. If the server cannot produce
// genuine AI-generated questions the caller receives an explicit error, so a
// teacher is never shown synthetic content presented as AI output. Manually
// authored questions remain available separately in the quiz wizard.

import { Question, QuestionType, QuizDifficulty } from '../types/quiz';
import { authService } from '../services/auth-service';

export interface AIGenerateRequest {
  grade: string;
  subject: string;
  topics: string[];
  learningObjectives?: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionType?: QuestionType;
}

export interface GeneratedQuestionItem extends Question {
  isAccepted: boolean;
  isEdited?: boolean;
  generationNote?: string;
}

export interface AIGenerateResponse {
  questions: GeneratedQuestionItem[];
  isPartial?: boolean;
  actualCount?: number;
  requestedCount?: number;
  notice?: string;
}

export async function generateAIQuestions(
  request: AIGenerateRequest
): Promise<AIGenerateResponse> {
  const token = authService.getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch('/api/ai/generate-quiz', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error(
      'AI question generation is unavailable: the server could not be reached. Please check your connection and try again.'
    );
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ||
        'AI question generation is unavailable. Please contact your administrator.'
    );
  }

  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('The AI service returned no questions. Please try again.');
  }

  return {
    questions: data.questions as GeneratedQuestionItem[],
    isPartial: Boolean(data.isPartial),
    actualCount: data.questions.length,
    requestedCount: request.questionCount,
    notice: data.warning || data.notice,
  };
}

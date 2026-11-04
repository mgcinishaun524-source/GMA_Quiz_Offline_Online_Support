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
    const errorMsg = (data as { error?: string }).error || 'AI generation failed';
    console.error('[AI Service] Generation failed:', errorMsg, 'Status:', res.status);
    throw new Error(errorMsg);
  }

  if (!Array.isArray(data.questions) || data.questions.length === 0) {
    console.error('[AI Service] No questions returned. Response:', data);
    throw new Error(
      'The AI service returned no questions. This may be due to: (1) Both Gemini and Groq failing, (2) Rate limits, or (3) Invalid API keys. Check browser console for details and try again.'
    );
  }

  console.log(`[AI Service] ✓ Success: ${data.questions.length} questions received${data.isPartial ? ' (partial)' : ''}`);

  return {
    questions: data.questions as GeneratedQuestionItem[],
    isPartial: Boolean(data.isPartial),
    actualCount: data.questions.length,
    requestedCount: request.questionCount,
    notice: data.warning || data.notice,
  };
}

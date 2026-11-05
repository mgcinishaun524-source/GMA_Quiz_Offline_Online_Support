// AI Quiz Generation Service — browser-first generation.
//
// Questions are drafted directly from the teacher's browser against Gemini
// (primary) and Groq (automatic fallback). The paper is split into small
// chunks so every individual network request finishes well under 30 seconds,
// which lets a teacher generate far more than 20 questions without hitting the
// serverless function timeout.
//
// Provider credentials are handed to an authenticated teacher/admin at runtime
// by GET /api/ai/client-config. The keys live in server-side environment
// variables and are never baked into the client bundle.
//
// There is deliberately NO synthetic/local fallback. If no real provider
// produces usable questions the caller receives an explicit error, and any
// partial result is flagged so a teacher is never shown invented content
// presented as AI output. Manually authored questions remain available
// separately in the quiz wizard.

import { QuestionType, QuizDifficulty } from '../types/quiz';
import { authService } from '../services/auth-service';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  GEMINI_FALLBACK_MODELS,
  GEMINI_RESPONSE_SCHEMA,
  buildBatchPrompt,
  buildSystemInstruction,
  normalizeGeneratedQuestions,
  parseProviderText,
  splitIntoBatches,
} from './ai-quiz-core';
import type { GeneratedQuestionItem, QuizGenParams } from './ai-quiz-core';

// Re-exported so existing consumers (e.g. NewQuizPage) keep a single import
// surface while the type itself is defined once in the shared core.
export type { GeneratedQuestionItem } from './ai-quiz-core';

export interface AIGenerateRequest {
  grade: string;
  subject: string;
  topics: string[];
  learningObjectives?: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionType?: QuestionType;
}

export interface AIGenerateResponse {
  questions: GeneratedQuestionItem[];
  isPartial?: boolean;
  actualCount?: number;
  requestedCount?: number;
  notice?: string;
}

export interface AIProgressInfo {
  /** Questions collected so far across all chunks. */
  completed: number;
  /** Total questions requested. */
  total: number;
  /** Human-readable label of the provider that produced the latest chunk. */
  provider: string;
}

export type AIProgressCallback = (info: AIProgressInfo) => void;

interface ProviderConfig {
  apiKey: string;
  model: string;
}

interface AIClientConfig {
  gemini: ProviderConfig | null;
  groq: ProviderConfig | null;
}

// One provider call per chunk. Kept small so each individual request stays
// short on the free tiers while still allowing >20 question papers.
const CLIENT_BATCH_SIZE = 10;
// Hard ceiling per request so a single provider never stalls the wizard.
const REQUEST_TIMEOUT_MS = 25000;

let cachedClientConfig: AIClientConfig | null | undefined;

/** fetch() that aborts after `timeoutMs` so one slow provider can't hang the wizard. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Provider request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read provider credentials for the current session. Returns null when the
 * server has no providers configured or the caller is not authorised — the
 * caller then falls back to the server-side generation endpoint.
 */
async function fetchClientConfig(): Promise<AIClientConfig | null> {
  if (cachedClientConfig !== undefined) return cachedClientConfig;
  const token = authService.getAuthToken();
  try {
    const res = await fetch('/api/ai/client-config', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      cachedClientConfig = null;
      return null;
    }
    cachedClientConfig = (await res.json()) as AIClientConfig;
    return cachedClientConfig;
  } catch {
    cachedClientConfig = null;
    return null;
  }
}

/** Call one specific Gemini model directly from the browser via the REST API. */
async function callGeminiModel(
  cfg: ProviderConfig,
  model: string,
  systemInstruction: string,
  promptText: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini ${model} ${res.status}: ${body.slice(0, 180)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text || '').join('')
    : '';
  if (!text.trim()) {
    throw new Error(`Gemini ${model} returned an empty response (it may have been blocked by safety filters).`);
  }
  return text;
}

/**
 * Call Gemini directly from the browser, falling through a chain of models.
 * Individual Gemini flash models intermittently return 503 ("high demand") or
 * 404 (retired); trying the next model keeps the chunk generating instead of
 * failing the whole paper. Resolves with the text and the model that answered.
 */
async function callGeminiDirect(
  cfg: ProviderConfig,
  systemInstruction: string,
  promptText: string
): Promise<{ text: string; model: string }> {
  const chain = Array.from(new Set([cfg.model || DEFAULT_GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
  let lastError = '';
  for (const model of chain) {
    try {
      const text = await callGeminiModel(cfg, model, systemInstruction, promptText);
      return { text, model };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[AI Service] Gemini model ${model} failed: ${lastError}`);
    }
  }
  throw new Error(lastError || 'Gemini is unavailable.');
}

/** Call Groq's OpenAI-compatible endpoint directly from the browser. */
async function callGroqDirect(
  cfg: ProviderConfig,
  systemInstruction: string,
  promptText: string
): Promise<string> {
  const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model || DEFAULT_GROQ_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: promptText },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${body.slice(0, 180)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

/**
 * Last-resort fallback: ask the server to attempt the same chunk. Used only
 * when the browser-direct providers are unavailable (no config, CORS, network).
 */
async function generateBatchViaServer(
  params: QuizGenParams,
  count: number,
  excludePrompts: string[]
): Promise<GeneratedQuestionItem[]> {
  const token = authService.getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout('/api/ai/generate-quiz', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...params, questionCount: count, excludePrompts }),
  });

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Server AI generation failed.');
  }
  return Array.isArray(data.questions) ? (data.questions as GeneratedQuestionItem[]) : [];
}

function normalizePromptKey(prompt: string): string {
  return String(prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function generateAIQuestions(
  request: AIGenerateRequest,
  onProgress?: AIProgressCallback
): Promise<AIGenerateResponse> {
  const total = Math.max(1, Math.min(200, Math.floor(Number(request.questionCount) || 1)));
  const params: QuizGenParams = {
    grade: request.grade,
    subject: request.subject,
    topics: request.topics,
    learningObjectives: request.learningObjectives,
    difficulty: request.difficulty,
    questionType: request.questionType,
  };

  const systemInstruction = buildSystemInstruction();
  const clientConfig = await fetchClientConfig();

  const usedPromptKeys = new Set<string>();
  const collected: GeneratedQuestionItem[] = [];
  let isPartial = false;
  let notice: string | undefined;
  let lastError = '';

  // Keep asking until the paper is complete. Providers routinely return fewer
  // items than requested (and drop near-duplicates), so a fixed one-shot-per-
  // batch loop can finish short — re-requesting just the remainder tops the
  // paper up. The attempt cap and consecutive-empty guard keep it bounded.
  const nominalBatches = splitIntoBatches(total, CLIENT_BATCH_SIZE).length;
  const maxAttempts = Math.max(nominalBatches * 3, 4);
  let attempts = 0;
  let consecutiveEmpty = 0;

  while (collected.length < total && attempts < maxAttempts) {
    attempts++;
    const size = Math.min(CLIENT_BATCH_SIZE, total - collected.length);
    const existingPrompts = collected.map((q) => q.prompt);
    const promptText = buildBatchPrompt(params, size, existingPrompts);

    // Run the full provider chain once: Gemini direct → Groq direct → server.
    const runChunk = async (): Promise<{
      added: GeneratedQuestionItem[];
      provider: string;
      error: string;
    }> => {
      let added: GeneratedQuestionItem[] = [];
      let provider = 'AI';
      let error = '';

      // ── Preferred path: call the provider directly from the browser ──────
      if (clientConfig?.gemini) {
        try {
          const { text, model } = await callGeminiDirect(
            clientConfig.gemini,
            systemInstruction,
            promptText
          );
          added = normalizeGeneratedQuestions(parseProviderText(text), {
            params,
            batchIndex: attempts - 1,
            providerLabel: `Gemini ${model}`,
            usedPromptKeys,
          });
          if (added.length > 0) provider = 'Gemini';
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          console.warn(`[AI Service] Gemini direct attempt ${attempts} failed: ${error}`);
        }
      }

      if (added.length === 0 && clientConfig?.groq) {
        try {
          const text = await callGroqDirect(clientConfig.groq, systemInstruction, promptText);
          added = normalizeGeneratedQuestions(parseProviderText(text), {
            params,
            batchIndex: attempts - 1,
            providerLabel: `Groq ${clientConfig.groq.model || DEFAULT_GROQ_MODEL}`,
            usedPromptKeys,
          });
          if (added.length > 0) provider = 'Groq';
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          console.warn(`[AI Service] Groq direct attempt ${attempts} failed: ${error}`);
        }
      }

      // ── Fallback path: let the server attempt the same chunk ─────────────
      if (added.length === 0) {
        try {
          const serverQuestions = await generateBatchViaServer(params, size, existingPrompts);
          added = serverQuestions.filter((q) => {
            const key = normalizePromptKey(q.prompt);
            if (!key || usedPromptKeys.has(key)) return false;
            usedPromptKeys.add(key);
            return true;
          });
          if (added.length > 0) provider = 'Server';
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          console.warn(`[AI Service] Server fallback attempt ${attempts} failed: ${error}`);
        }
      }

      return { added, provider, error };
    };

    const { added, provider: providerLabel, error } = await runChunk();
    if (error) lastError = error;

    if (added.length === 0) {
      consecutiveEmpty++;
      console.warn(
        `[AI Service] Attempt ${attempts} produced nothing (streak ${consecutiveEmpty}).`
      );
      if (collected.length === 0 && consecutiveEmpty >= 2) {
        throw new Error(
          lastError
            ? `AI question generation failed: ${lastError}`
            : 'AI question generation returned no usable questions. Check that a valid GEMINI_API_KEY or GROQ_API_KEY is configured, then try again.'
        );
      }
      if (consecutiveEmpty >= 3) {
        isPartial = true;
        notice = `Generated ${collected.length} of ${total} questions. Providers stopped returning usable questions.`;
        break;
      }
      continue;
    }

    consecutiveEmpty = 0;
    collected.push(...added);
    onProgress?.({ completed: collected.length, total, provider: providerLabel });
  }

  if (collected.length < total && !isPartial) {
    isPartial = true;
    notice = `Generated ${collected.length} of ${total} questions after ${attempts} attempt(s).`;
  }

  console.log(
    `[AI Service] ✓ ${collected.length}/${total} questions received${isPartial ? ' (partial)' : ''}`
  );

  return {
    questions: collected,
    isPartial,
    actualCount: collected.length,
    requestedCount: total,
    notice,
  };
}

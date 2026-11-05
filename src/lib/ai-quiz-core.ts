// Shared AI quiz-generation primitives.
//
// These helpers are used by BOTH the server endpoint (server.ts) and the
// browser-side generator (src/lib/ai-service.ts). Keeping the prompt, the
// response schema and the response normalisation in a single module guarantees
// that Gemini and Groq are parsed identically no matter where the provider call
// originates, and that a change to one provider is picked up everywhere.

import type { Schema } from '@google/genai';
import { Question, QuestionOption, QuestionType, QuizDifficulty } from '../types/quiz';

export const MAX_BATCH_SIZE = 10;
// The gemini-3.x flash models are frequently 503 ("high demand"); 2.5-flash is
// GA and consistently available. The chain lets a single model outage (503/429/
// 404) fall through to the next model instead of failing the whole paper.
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-3.1-flash-lite'];
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';

export interface QuizGenParams {
  grade: string;
  subject: string;
  topics: string[];
  learningObjectives?: string;
  difficulty: QuizDifficulty;
  questionType?: QuestionType;
}

export interface GeneratedQuestionItem extends Question {
  isAccepted: boolean;
  isEdited?: boolean;
  generationNote?: string;
}

export interface NormalizeContext {
  params: QuizGenParams;
  batchIndex: number;
  providerLabel: string;
  /** Lower-cased prompt keys already used. Mutated in place so callers dedupe across batches. */
  usedPromptKeys: Set<string>;
}

/** Split a total question count into provider-sized batches (one API call each). */
export function splitIntoBatches(total: number, maxBatchSize: number = MAX_BATCH_SIZE): number[] {
  const batches: number[] = [];
  let remaining = Math.max(0, Math.floor(total));
  while (remaining > 0) {
    const size = Math.min(remaining, maxBatchSize);
    batches.push(size);
    remaining -= size;
  }
  return batches;
}

export function buildSystemInstruction(): string {
  return `You are a senior primary school educator and curriculum assessment author for Growing Minds Academy.
Your task is to draft high quality assessment questions aligned with the requested grade level, subject, and curriculum topics.
Questions must be clear, unambiguous, age-appropriate, and contain an accurate answer key and pedagogical explanation.
For multiple-choice questions, provide exactly 4 distinct options with one clearly correct answer.
Option IDs must be 'opt-1', 'opt-2', 'opt-3', 'opt-4', and correctAnswer must match the correct option id.
For true_false questions, correctAnswer must be 'true' or 'false'.
For short_answer questions, correctAnswer must be a concise, standard string (e.g. '1/4' or 'Gravity').
Respond with ONLY a single JSON object of the shape { "questions": [ ... ] }. Every element of the array MUST be a JSON object (never a bare string) with exactly these keys:
{ "type": "multiple_choice", "prompt": "...", "options": [{ "id": "opt-1", "text": "..." }, { "id": "opt-2", "text": "..." }, { "id": "opt-3", "text": "..." }, { "id": "opt-4", "text": "..." }], "correctAnswer": "opt-1", "marks": 2, "topic": "...", "explanation": "..." }
Do not wrap the JSON in markdown fences and do not add commentary.`;
}

/** Prompt for one batch, including the deduplication list of prompts already generated. */
export function buildBatchPrompt(
  params: QuizGenParams,
  batchSize: number,
  existingPrompts: string[]
): string {
  const { grade, subject, topics, learningObjectives, difficulty, questionType } = params;
  const dedup =
    existingPrompts.length > 0
      ? `\nCRITICAL DEDUPLICATION RULE: The following ${existingPrompts.length} questions have already been generated for this exam paper. DO NOT duplicate, rephrase, or overlap these concepts:\n${existingPrompts
          .slice(-10)
          .map((p) => `- ${p}`)
          .join('\n')}`
      : '';

  return `CRITICAL COUNT REQUIREMENT: You MUST generate EXACTLY ${batchSize} complete question items. Do not stop at 4 or 5.

Generate ${batchSize} unique curriculum assessment questions for:
Grade: ${grade}
Subject: ${subject}
Topics: ${topics.join(', ')}
${learningObjectives ? `Learning Objectives: ${learningObjectives}` : ''}
Difficulty Tier: ${difficulty}
${questionType ? `Forced Question Type: ${questionType}` : 'Question Type: prioritize multiple_choice with optional true_false and short_answer'}
${dedup}`.trim();
}

/**
 * Gemini structured-output schema. An OBJECT root containing a "questions"
 * array is used because an ARRAY root is not reliably supported across models.
 * parseProviderText() unwraps either shape, so Groq can return the same object.
 *
 * The type names are the literal Gemini enum values ('OBJECT', 'ARRAY', …) so
 * the browser bundle does not need to pull in the @google/genai runtime.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING' },
          prompt: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { id: { type: 'STRING' }, text: { type: 'STRING' } },
              required: ['id', 'text'],
            },
          },
          correctAnswer: { type: 'STRING' },
          marks: { type: 'INTEGER' },
          topic: { type: 'STRING' },
          explanation: { type: 'STRING' },
        },
        required: ['type', 'prompt', 'correctAnswer', 'marks', 'topic'],
      },
    },
  },
  required: ['questions'],
} as unknown as Schema;

const PROMPT_KEYS = ['prompt', 'question', 'questionText', 'question_text', 'text', 'stem', 'title'];
const ANSWER_KEYS = ['correctAnswer', 'correct_answer', 'answer', 'correctOption', 'correct_option', 'correct', 'answerText'];
const OPTIONS_KEYS = ['options', 'choices', 'answers', 'answerOptions', 'answer_options'];
const TYPE_KEYS = ['type', 'questionType', 'question_type'];
const MARKS_KEYS = ['marks', 'points', 'mark', 'score', 'weight'];
const TOPIC_KEYS = ['topic', 'topicTitle', 'topic_title', 'subtopic'];
const EXPLANATION_KEYS = ['explanation', 'rationale', 'reason', 'solution', 'justification'];

function firstDefined(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function toOptions(rawOptions: unknown): QuestionOption[] | undefined {
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) return undefined;
  const mapped: QuestionOption[] = [];
  rawOptions.forEach((opt, idx) => {
    if (typeof opt === 'string') {
      if (opt.trim()) mapped.push({ id: `opt-${idx + 1}`, text: opt });
      return;
    }
    if (opt && typeof opt === 'object') {
      const record = opt as Record<string, unknown>;
      const text = firstDefined(record, ['text', 'label', 'value', 'option', 'content']);
      const id = firstDefined(record, ['id', 'key']);
      if (text !== undefined && String(text).trim()) {
        mapped.push({ id: String(id ?? `opt-${idx + 1}`), text: String(text) });
      }
    }
  });
  return mapped.length > 0 ? mapped : undefined;
}

/**
 * Extract the question array from a raw provider response. Tolerates markdown
 * fences, prose wrapped around the JSON, a bare array, or an object wrapper
 * ({ questions: [...] }, { items: [...] }, or any first array-valued property).
 */
export function parseProviderText(text: string): unknown[] {
  const cleaned = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));
    if (start === -1 || end <= start) return [];
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
  }

  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.questions)) return record.questions;
    if (Array.isArray(record.items)) return record.items;
    const nested = Object.values(record).find((value) => Array.isArray(value));
    if (Array.isArray(nested)) return nested;
    if (firstDefined(record, PROMPT_KEYS) !== undefined) return [record];
  }
  return [];
}

/**
 * Convert raw provider items into validated question objects.
 *
 * Field-name aliasing means a provider that answers with `question`/`choices`/
 * `answer` instead of `prompt`/`options`/`correctAnswer` is still parsed, which
 * is what previously caused "provider returned N but 0 arrived".
 *
 * Items without a usable prompt are skipped, and multiple-choice items without
 * real options are dropped rather than filled with invented placeholders.
 */
export function normalizeGeneratedQuestions(raw: unknown[], ctx: NormalizeContext): GeneratedQuestionItem[] {
  const { params, batchIndex, providerLabel, usedPromptKeys } = ctx;
  const out: GeneratedQuestionItem[] = [];
  if (!Array.isArray(raw)) return out;

  for (const item of raw) {
    // Some providers (notably Groq's gpt-oss models) occasionally return an
    // array of bare question strings instead of objects. Those are still real
    // AI-authored questions, so keep them as short-answer drafts rather than
    // discarding the whole batch — the answer key is flagged as needing review.
    if (typeof item === 'string') {
      const promptStr = item.trim();
      if (!promptStr) continue;
      const normKey = promptStr.toLowerCase().replace(/\s+/g, ' ');
      if (usedPromptKeys.has(normKey)) continue;
      usedPromptKeys.add(normKey);
      out.push({
        id: `ai-live-${Date.now()}-${out.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'short_answer',
        prompt: promptStr,
        correctAnswer: '',
        marks: 2,
        topic: params.topics[0] ?? 'Curriculum',
        explanation: `Derived from ${params.grade} syllabus standards.`,
        isAccepted: true,
        generationNote: `${providerLabel} returned this question without an answer key — add the expected answer before publishing. (Batch ${batchIndex + 1})`,
      });
      continue;
    }

    if (!item || typeof item !== 'object') continue;

    const promptStr = String(firstDefined(item, PROMPT_KEYS) ?? '').trim();
    if (!promptStr) continue;
    const normKey = promptStr.toLowerCase().replace(/\s+/g, ' ');
    if (usedPromptKeys.has(normKey)) continue;

    const typeRaw = String(firstDefined(item, TYPE_KEYS) ?? '').toLowerCase();
    const type: QuestionType = typeRaw.includes('true')
      ? 'true_false'
      : typeRaw.includes('short')
      ? 'short_answer'
      : 'multiple_choice';

    const options = toOptions(firstDefined(item, OPTIONS_KEYS));
    if (type === 'multiple_choice' && (!options || options.length < 2)) {
      // Never fabricate options — skip so the caller can top the batch up.
      continue;
    }

    const rawAnswer = String(firstDefined(item, ANSWER_KEYS) ?? '').trim();
    let correctAnswer = rawAnswer;
    if (type === 'true_false') {
      correctAnswer = /^true$/i.test(rawAnswer) ? 'true' : /^false$/i.test(rawAnswer) ? 'false' : 'true';
    } else if (type === 'multiple_choice') {
      const matched = options!.find(
        (opt) => opt.id === rawAnswer || opt.text.toLowerCase() === rawAnswer.toLowerCase()
      );
      correctAnswer = matched ? matched.id : options![0].id;
    }

    usedPromptKeys.add(normKey);
    const marks = Number(firstDefined(item, MARKS_KEYS));

    out.push({
      id: `ai-live-${Date.now()}-${out.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      prompt: promptStr,
      options: type === 'multiple_choice' ? options : undefined,
      correctAnswer,
      marks: Number.isFinite(marks) && marks > 0 ? marks : 2,
      topic: String(firstDefined(item, TOPIC_KEYS) ?? params.topics[0] ?? 'Curriculum'),
      explanation: String(
        firstDefined(item, EXPLANATION_KEYS) ?? `Derived from ${params.grade} syllabus standards.`
      ),
      isAccepted: true,
      generationNote: `Generated by ${providerLabel} (Batch ${batchIndex + 1}). Verified server-side.`,
    });
  }

  return out;
}

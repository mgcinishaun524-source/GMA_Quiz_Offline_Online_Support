import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PrimaryButton, SecondaryButton, OutlineButton, DangerButton } from '../../../components/ui/Buttons';
import { FormField, InputField, SelectField, TextareaField } from '../../../components/ui/FormControls';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { appDataStore } from '../../../services/storage';
import { quizApiService } from '../../../services/quiz-api';
import { generateAIQuestions, GeneratedQuestionItem } from '../../../lib/ai-service';
import { Quiz, Question, QuestionType, QuizDifficulty, ReleasePolicy } from '../../../types/quiz';
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Eye,
  CheckCircle2,
  AlertTriangle,
  MoveUp,
  MoveDown,
  Save,
  HelpCircle,
  RefreshCw,
  Printer,
} from 'lucide-react';

export const NewQuizPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAIModeParam = searchParams.get('mode') === 'ai';
  const editQuizId = searchParams.get('edit') || searchParams.get('id');

  const [step, setStep] = useState<number>(isAIModeParam ? 3 : 1);
  const classes = appDataStore.getClasses();
  const subjects = appDataStore.getSubjects();

  // Step 1: Details — the wizard starts empty; all content is authored by the
  // teacher or generated from a real Gemini key. No sample quiz is pre-filled.
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('Grade 3');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [topicInput, setTopicInput] = useState('');
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  const [learningObjectives, setLearningObjectives] = useState('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState<string>('');

  // Step 2 & 3: Questions — authored manually or accepted from real AI output.
  const [questions, setQuestions] = useState<Question[]>([]);

  // Load existing draft if editing
  useEffect(() => {
    if (editQuizId) {
      const existing = appDataStore.getQuizById(editQuizId);
      if (existing) {
        setTitle(existing.title);
        setGrade(existing.grade);
        setClassId(existing.classId);
        setSubjectId(existing.subjectId);
        setTopicsCovered(existing.topicsCovered || []);
        setLearningObjectives(existing.learningObjectives || '');
        setDifficulty(existing.difficulty);
        setDurationMinutes(existing.durationMinutes);
        setInstructions(existing.instructions || '');
        if (Array.isArray(existing.questions) && existing.questions.length > 0) {
          setQuestions(existing.questions);
        }
        setReleasePolicy(existing.releasePolicy || 'manual');
        setAllowOffline(existing.allowOffline !== undefined ? existing.allowOffline : true);
        setMaxAttempts(existing.maxAttempts || 1);
        if (existing.dueDate) setDueDate(existing.dueDate);
      }
    }
  }, [editQuizId]);

  // AI Assistant Panel State
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGeneratedItems, setAiGeneratedItems] = useState<GeneratedQuestionItem[]>([]);
  const [aiGenCount, setAiGenCount] = useState(5);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [incompleteInfo, setIncompleteInfo] = useState<{ requested: number; generated: number; missing: number } | null>(null);

  // Step 5: Publication Settings
  const [releasePolicy, setReleasePolicy] = useState<ReleasePolicy>('manual');
  const [allowOffline, setAllowOffline] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);

  // Validation
  const [errors, setErrors] = useState<string[]>([]);

  const selectedClass = classes.find((c) => c.id === classId) || classes[0];
  const selectedSubject = subjects.find((s) => s.id === subjectId) || subjects[0];

  const handleAddTopic = () => {
    if (topicInput.trim() && !topicsCovered.includes(topicInput.trim())) {
      setTopicsCovered([...topicsCovered, topicInput.trim()]);
      setTopicInput('');
    }
  };

  const handleRemoveTopic = (t: string) => {
    setTopicsCovered(topicsCovered.filter((item) => item !== t));
  };

  // Question Management in Step 2
  const handleAddManualQuestion = (type: QuestionType = 'multiple_choice') => {
    const newQ: Question = {
      id: `q-man-${Date.now()}`,
      type,
      prompt: 'Enter question prompt here...',
      options:
        type === 'multiple_choice'
          ? [
              { id: 'opt-1', text: 'Option A' },
              { id: 'opt-2', text: 'Option B' },
              { id: 'opt-3', text: 'Option C' },
              { id: 'opt-4', text: 'Option D' },
            ]
          : undefined,
      correctAnswer: type === 'true_false' ? 'true' : 'opt-1',
      marks: 2,
      topic: topicsCovered[0] || 'General',
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...questions];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setQuestions(reordered);
  };

  // AI Question Generation (Step 3)
  const handleTriggerAIGeneration = async () => {
    setIsGeneratingAI(true);
    setAiNotice(null);
    try {
      const targetCount = Math.min(Math.max(1, aiGenCount || 5), 50);
      const res = await generateAIQuestions({
        grade,
        subject: selectedSubject?.name || 'General',
        topics: topicsCovered.length > 0 ? topicsCovered : ['Fractions'],
        difficulty,
        questionCount: targetCount,
      });

      setAiGeneratedItems(res.questions);
      if (res.isPartial) {
        const genCount = res.actualCount || res.questions.length;
        const missing = Math.max(0, targetCount - genCount);
        setIncompleteInfo({
          requested: targetCount,
          generated: genCount,
          missing,
        });
        setAiNotice(`Partial generation complete: Generated ${genCount} of ${targetCount} requested questions. You can generate the remaining items below without losing work.`);
      } else {
        setIncompleteInfo(null);
        if (res.notice) {
          setAiNotice(res.notice);
        } else {
          setAiNotice(`Draft questions (${res.questions.length} items) generated based on curriculum standards. Please review answer keys before accepting.`);
        }
      }
    } catch (err: unknown) {
      setAiNotice(err instanceof Error ? err.message : 'Failed to generate draft questions.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleGenerateMissingQuestions = async () => {
    if (!incompleteInfo || incompleteInfo.missing <= 0) return;
    setIsGeneratingAI(true);
    setAiNotice(null);
    try {
      const res = await generateAIQuestions({
        grade,
        subject: selectedSubject?.name || 'General',
        topics: topicsCovered.length > 0 ? topicsCovered : ['Fractions'],
        difficulty,
        questionCount: incompleteInfo.missing,
      });

      setAiGeneratedItems((prev) => [...prev, ...res.questions]);
      if (res.isPartial) {
        const newlyGenerated = res.actualCount || res.questions.length;
        const stillMissing = Math.max(0, incompleteInfo.missing - newlyGenerated);
        setIncompleteInfo({
          requested: incompleteInfo.missing,
          generated: newlyGenerated,
          missing: stillMissing,
        });
        setAiNotice(`Additional batch generated: ${newlyGenerated} questions added. ${stillMissing > 0 ? `${stillMissing} questions still missing.` : 'All requested questions generated!'}`);
      } else {
        setIncompleteInfo(null);
        setAiNotice(`Successfully generated remaining ${res.questions.length} questions. Now reviewing ${aiGeneratedItems.length + res.questions.length} total draft questions.`);
      }
    } catch (err: unknown) {
      setAiNotice(err instanceof Error ? err.message : 'Failed to generate remaining questions.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePrintDraft = () => {
    const draftQuiz: Quiz = {
      id: editQuizId || `quiz-${Date.now()}`,
      title: title.trim() || 'Untitled Assessment',
      grade,
      classId,
      className: selectedClass?.name || 'Assigned Class',
      subjectId,
      subjectName: selectedSubject?.name || 'Subject',
      topicsCovered,
      learningObjectives,
      difficulty,
      durationMinutes,
      instructions,
      questions,
      status: 'draft',
      releasePolicy,
      allowOffline,
      maxAttempts,
      dueDate: dueDate || undefined,
      createdAt: new Date().toISOString(),
      authorId: user?.id || '',
      authorName: user?.name || '',
    };

    appDataStore.saveQuiz(draftQuiz);
    navigate(`/teacher/quizzes/${draftQuiz.id}/print`);
  };

  const handleAcceptAIQuestion = (item: GeneratedQuestionItem) => {
    setQuestions([...questions, item]);
    setAiGeneratedItems(aiGeneratedItems.filter((q) => q.id !== item.id));
  };

  const handleAcceptAllAI = () => {
    setQuestions([...questions, ...aiGeneratedItems]);
    setAiGeneratedItems([]);
  };

  // Save as Draft
  const handleSaveDraft = () => {
    const draftQuiz: Quiz = {
      id: editQuizId || `quiz-${Date.now()}`,
      title: title.trim() || 'Untitled Assessment',
      grade,
      classId,
      className: selectedClass?.name || 'Assigned Class',
      subjectId,
      subjectName: selectedSubject?.name || 'Subject',
      topicsCovered,
      learningObjectives,
      difficulty,
      durationMinutes,
      instructions,
      questions,
      status: 'draft',
      releasePolicy,
      allowOffline,
      maxAttempts,
      dueDate: dueDate || undefined,
      createdAt: new Date().toISOString(),
      authorId: user?.id || '',
      authorName: user?.name || '',
    };

    quizApiService.createQuiz(draftQuiz).catch((err) => {
      console.warn('[Draft Save Network Sync]', err);
    });
    navigate('/teacher/quizzes?tab=drafts');
  };

  // Publish
  const handlePublishAssessment = () => {
    const publishedQuiz: Quiz = {
      id: editQuizId || `quiz-${Date.now()}`,
      title: title.trim() || 'Untitled Assessment',
      grade,
      classId,
      className: selectedClass?.name || 'Assigned Class',
      subjectId,
      subjectName: selectedSubject?.name || 'Subject',
      topicsCovered,
      learningObjectives,
      difficulty,
      durationMinutes,
      instructions,
      questions,
      status: 'in_progress',
      releasePolicy,
      allowOffline,
      maxAttempts,
      dueDate: dueDate || undefined,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      authorId: user?.id || '',
      authorName: user?.name || '',
      isCachedOffline: allowOffline,
    };

    quizApiService.createQuiz(publishedQuiz).catch((err) => {
      console.warn('[Publish Network Sync]', err);
    });
    setIsPublishConfirmOpen(false);
    navigate('/teacher/quizzes?tab=in_progress');
  };

  // Step Validation Check
  const validateStep = (currentStep: number): boolean => {
    const errs: string[] = [];
    if (currentStep === 1) {
      if (!title.trim()) errs.push('Quiz title is required.');
      if (topicsCovered.length === 0) errs.push('At least one topic must be specified.');
    } else if (currentStep === 2) {
      if (questions.length === 0) errs.push('At least one question is required.');
      questions.forEach((q, idx) => {
        if (!q.prompt.trim()) errs.push(`Question #${idx + 1} has an empty prompt.`);
        if (q.type === 'multiple_choice' && (!q.options || q.options.length < 2)) {
          errs.push(`Question #${idx + 1} must have at least 2 options.`);
        }
      });
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Creation Wizard"
        subtitle="Design curriculum-aligned quizzes with manual question authoring and AI topic drafting."
        actions={
          <div className="flex gap-2">
            <OutlineButton onClick={handleSaveDraft} icon={<Save size={14} />}>
              Save as Draft
            </OutlineButton>
            {questions.length > 0 && (
              <OutlineButton
                onClick={handlePrintDraft}
                icon={<Printer size={14} />}
                title="Preview and export printable question paper"
              >
                Print / Export Paper
              </OutlineButton>
            )}
          </div>
        }
      />

      {/* Step Indicator — Rectangular & Strict Brand Colours */}
      <div className="bg-white border border-[#CBD5E1] p-3 shadow-xs">
        <div className="grid grid-cols-5 gap-2 text-center text-xs">
          {[
            { num: 1, label: '1. Assessment Details' },
            { num: 2, label: '2. Question Authoring' },
            { num: 3, label: '3. AI Generation' },
            { num: 4, label: '4. Learner Preview' },
            { num: 5, label: '5. Publication Settings' },
          ].map((item) => (
            <button
              key={item.num}
              onClick={() => {
                if (validateStep(step)) setStep(item.num);
              }}
              className={`py-2 px-1 text-xs font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                step === item.num
                  ? 'bg-[#1C2C5B] text-white border-[#1C2C5B]'
                  : step > item.num
                  ? 'bg-[#E8F3FC] text-[#1C2C5B] border-[#6CABDD]/40'
                  : 'bg-[#F5F8FC] text-[#64748B] border-[#CBD5E1]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-3 bg-[#FEE2E2] border border-[#B91C1C]/40 text-[#B91C1C] text-xs font-semibold space-y-1">
          {errors.map((e, idx) => (
            <div key={idx}>• {e}</div>
          ))}
        </div>
      )}

      {/* STEP 1: Assessment Details */}
      {step === 1 && (
        <div className="bg-white border border-[#CBD5E1] p-6 shadow-xs space-y-5">
          <div className="pb-3 border-b border-[#CBD5E1]">
            <h3 className="text-base font-bold uppercase tracking-wider text-[#1C2C5B]">
              Step 1: Assessment Configuration & Topics
            </h3>
            <p className="text-xs text-[#64748B]">
              Specify cohort, curriculum discipline, weekly topics and learning objectives
            </p>
          </div>

          <FormField label="Assessment Title" required>
            <InputField
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Assessment: Fractions & Number Patterns"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Grade Level" required>
              <SelectField value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="Grade 3">Grade 3</option>
                <option value="Grade 4">Grade 4</option>
                <option value="Grade 5">Grade 5</option>
                <option value="Grade 6">Grade 6</option>
              </SelectField>
            </FormField>

            <FormField label="Target Class Group" required>
              <SelectField value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classes.length === 0 && <option value="">No classes available</option>}
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.grade})
                  </option>
                ))}
              </SelectField>
            </FormField>

            <FormField label="Subject Area" required>
              <SelectField value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.length === 0 && <option value="">No subjects available</option>}
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </SelectField>
            </FormField>
          </div>

          {/* Topics Covered */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B] mb-1.5">
              Curriculum Topics Covered This Week <span className="text-[#B91C1C]">*</span>
            </label>
            <div className="flex gap-2 mb-2">
              <InputField
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                placeholder="Enter topic name (e.g. Fractions) and press Add..."
                className="text-xs"
              />
              <OutlineButton type="button" onClick={handleAddTopic} icon={<Plus size={14} />}>
                Add Topic
              </OutlineButton>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topicsCovered.map((topic) => (
                <span
                  key={topic}
                  className="bg-[#E8F3FC] text-[#1C2C5B] text-xs font-medium px-2.5 py-1 border border-[#6CABDD]/40 flex items-center gap-1.5"
                >
                  <span>{topic}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(topic)}
                    className="hover:text-[#B91C1C] cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <FormField label="Learning Objectives (Benchmarking Standard)">
            <TextareaField
              rows={2}
              value={learningObjectives}
              onChange={(e) => setLearningObjectives(e.target.value)}
              placeholder="State what learners are expected to demonstrate..."
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Difficulty Tier">
              <SelectField
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as QuizDifficulty)}
              >
                <option value="easy">Easy (Foundational & Recall)</option>
                <option value="medium">Medium (Application & Problem Solving)</option>
                <option value="hard">Hard (Extension & Multi-step Logic)</option>
              </SelectField>
            </FormField>

            <FormField label="Allocated Duration (Minutes)">
              <InputField
                type="number"
                min={5}
                max={120}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </FormField>
          </div>

          <FormField label="Learner Instructions & Guidance">
            <TextareaField
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Special instructions displayed prior to quiz start..."
            />
          </FormField>
        </div>
      )}

      {/* STEP 2: Question Creation */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white border border-[#CBD5E1] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider text-[#1C2C5B]">
                Step 2: Question Bank ({questions.length} Items)
              </h3>
              <p className="text-xs text-[#64748B]">
                Author multiple-choice, true/false, or short-answer questions. Set keys and mark allocations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <OutlineButton
                onClick={() => handleAddManualQuestion('multiple_choice')}
                icon={<Plus size={13} />}
                className="text-xs"
              >
                + Multiple Choice
              </OutlineButton>
              <OutlineButton
                onClick={() => handleAddManualQuestion('true_false')}
                icon={<Plus size={13} />}
                className="text-xs"
              >
                + True / False
              </OutlineButton>
              <OutlineButton
                onClick={() => handleAddManualQuestion('short_answer')}
                icon={<Plus size={13} />}
                className="text-xs"
              >
                + Short Answer
              </OutlineButton>
            </div>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white border border-[#CBD5E1] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#CBD5E1]/60">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#1C2C5B] bg-[#E8F3FC] px-2 py-0.5 border border-[#6CABDD]/30">
                    Question #{idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-[#64748B] uppercase">
                    {q.type.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-[#64748B] hover:text-[#1C2C5B] disabled:opacity-30 cursor-pointer"
                    title="Move Question Up"
                  >
                    <MoveUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(idx, 'down')}
                    disabled={idx === questions.length - 1}
                    className="p-1 text-[#64748B] hover:text-[#1C2C5B] disabled:opacity-30 cursor-pointer"
                    title="Move Question Down"
                  >
                    <MoveDown size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(idx)}
                    className="p-1 text-[#64748B] hover:text-[#B91C1C] cursor-pointer"
                    title="Delete Question"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Prompt */}
              <FormField label="Question Prompt" required>
                <InputField
                  type="text"
                  value={q.prompt}
                  onChange={(e) => handleUpdateQuestion(idx, { prompt: e.target.value })}
                  placeholder="Enter the question prompt here..."
                />
              </FormField>

              {/* Options for MCQ */}
              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B]">
                    Multiple Choice Options (Select Radio Button for Correct Answer)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = q.correctAnswer === opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2.5 p-2 border ${
                            isCorrect ? 'border-[#1C2C5B] bg-[#E8F3FC]' : 'border-[#CBD5E1] bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={isCorrect}
                            onChange={() => handleUpdateQuestion(idx, { correctAnswer: opt.id })}
                            className="accent-[#1C2C5B] cursor-pointer"
                          />
                          <InputField
                            type="text"
                            value={opt.text}
                            onChange={(e) => {
                              const newOpts = [...(q.options || [])];
                              newOpts[optIdx] = { ...newOpts[optIdx], text: e.target.value };
                              handleUpdateQuestion(idx, { options: newOpts });
                            }}
                            className="text-xs py-1"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* True / False */}
              {q.type === 'true_false' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#1C2C5B] mb-2">
                    Correct Answer
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name={`tf-${q.id}`}
                        checked={q.correctAnswer === 'true'}
                        onChange={() => handleUpdateQuestion(idx, { correctAnswer: 'true' })}
                        className="accent-[#1C2C5B]"
                      />
                      <span>TRUE</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name={`tf-${q.id}`}
                        checked={q.correctAnswer === 'false'}
                        onChange={() => handleUpdateQuestion(idx, { correctAnswer: 'false' })}
                        className="accent-[#1C2C5B]"
                      />
                      <span>FALSE</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Short Answer */}
              {q.type === 'short_answer' && (
                <FormField label="Exact Correct Answer Key (Case-Insensitive Match)">
                  <InputField
                    type="text"
                    value={q.correctAnswer}
                    onChange={(e) => handleUpdateQuestion(idx, { correctAnswer: e.target.value })}
                    placeholder="e.g. 1/4"
                  />
                </FormField>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#CBD5E1]/40">
                <FormField label="Marks Awarded">
                  <InputField
                    type="number"
                    min={1}
                    max={10}
                    value={q.marks}
                    onChange={(e) => handleUpdateQuestion(idx, { marks: Number(e.target.value) })}
                    className="text-xs"
                  />
                </FormField>

                <FormField label="Curriculum Topic Tag">
                  <InputField
                    type="text"
                    value={q.topic}
                    onChange={(e) => handleUpdateQuestion(idx, { topic: e.target.value })}
                    placeholder="e.g. Fractions"
                    className="text-xs"
                  />
                </FormField>

                <FormField label="Pedagogical Explanation">
                  <InputField
                    type="text"
                    value={q.explanation || ''}
                    onChange={(e) => handleUpdateQuestion(idx, { explanation: e.target.value })}
                    placeholder="Shown after marks are released..."
                    className="text-xs"
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STEP 3: AI-Assisted Generation */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-[#1C2C5B] text-white p-6 shadow-xs border border-[#1C2C5B]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/20">
              <div>
                <span className="text-xs font-bold text-[#6CABDD] uppercase tracking-wider block">
                  AI Question Assistant
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Curriculum Topic Synthesizer
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Drafting questions for <strong className="text-white">{grade}</strong> •{' '}
                  <strong className="text-white">{selectedSubject?.name}</strong> • Topics:{' '}
                  <strong className="text-[#6CABDD]">{topicsCovered.join(', ') || 'General'}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-300 uppercase font-semibold mr-1">Count:</span>
                  {[5, 10, 15, 25, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAiGenCount(preset)}
                      className={`px-2 py-1 text-xs font-semibold border transition-colors ${
                        aiGenCount === preset
                          ? 'bg-[#6CABDD] text-[#1C2C5B] border-[#6CABDD]'
                          : 'bg-[#0F172A] text-slate-300 border-white/20 hover:border-[#6CABDD]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <div className="flex items-center ml-1 border border-white/20 bg-[#0F172A] px-2 py-1">
                    <span className="text-[11px] text-slate-400 mr-1.5">Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={aiGenCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setAiGenCount(Math.min(50, Math.max(1, val)));
                        }
                      }}
                      className="w-12 bg-transparent text-white text-xs font-mono text-center outline-none border-b border-[#6CABDD]"
                      title="Enter custom question count (1 to 50)"
                    />
                  </div>
                </div>

                <PrimaryButton
                  onClick={handleTriggerAIGeneration}
                  isLoading={isGeneratingAI}
                  icon={<Sparkles size={14} />}
                >
                  Generate {aiGenCount} Questions
                </PrimaryButton>
              </div>
            </div>

            {/* AI generation status */}
            <div className="mt-4 text-[11px] text-slate-300 flex items-center justify-between">
              <span>
                Questions are generated live by the Gemini API. If AI generation is unavailable, an explicit error is shown. Every item requires teacher verification.
              </span>
              <span className="text-[#6CABDD] font-semibold">Ready to generate</span>
            </div>
          </div>

          {aiNotice && (
            <div className="p-3 bg-[#E8F3FC] border border-[#6CABDD] text-[#1C2C5B] text-xs font-semibold">
              {aiNotice}
            </div>
          )}

          {incompleteInfo && incompleteInfo.missing > 0 && (
            <div className="p-3 bg-[#FFFBEB] border border-[#F59E0B] text-[#92400E] text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div>
                <strong className="block font-bold">Incomplete Generation Detected</strong>
                <span>Generated {incompleteInfo.generated} of {incompleteInfo.requested} requested items ({incompleteInfo.missing} missing due to provider batch size limits).</span>
              </div>
              <PrimaryButton
                onClick={handleGenerateMissingQuestions}
                isLoading={isGeneratingAI}
                className="text-xs py-1 px-3 bg-[#B45309] hover:bg-[#92400E]"
                icon={<RefreshCw size={12} />}
              >
                Generate Remaining {incompleteInfo.missing} Questions
              </PrimaryButton>
            </div>
          )}

          {/* Generated Questions List */}
          {aiGeneratedItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-wider text-[#1C2C5B]">
                  Generated AI Drafts ({aiGeneratedItems.length})
                </h4>
                <PrimaryButton onClick={handleAcceptAllAI} className="text-xs py-1 px-3">
                  Accept All Drafts ({aiGeneratedItems.length})
                </PrimaryButton>
              </div>

              {aiGeneratedItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#CBD5E1] p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#CBD5E1]/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold bg-[#E8F3FC] text-[#1C2C5B] px-2 py-0.5 border border-[#6CABDD]/40">
                        AI Draft
                      </span>
                      <span className="text-xs font-semibold text-[#64748B]">{item.topic}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAiGeneratedItems(aiGeneratedItems.filter((q) => q.id !== item.id))
                        }
                        className="text-xs font-medium text-[#64748B] hover:text-[#B91C1C] px-2 py-1"
                      >
                        Reject
                      </button>
                      <PrimaryButton
                        onClick={() => handleAcceptAIQuestion(item)}
                        className="text-xs py-1 px-2.5"
                        icon={<CheckCircle2 size={13} />}
                      >
                        Accept Question
                      </PrimaryButton>
                    </div>
                  </div>

                  <p className="text-sm font-bold text-[#0F172A]">{item.prompt}</p>

                  {item.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {item.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={`p-2 border ${
                            item.correctAnswer === opt.id
                              ? 'bg-[#E8F3FC] border-[#1C2C5B] font-bold text-[#1C2C5B]'
                              : 'bg-[#F5F8FC] border-[#CBD5E1] text-[#0F172A]'
                          }`}
                        >
                          <span>{opt.text}</span>
                          {item.correctAnswer === opt.id && (
                            <span className="ml-2 text-[10px] text-[#6CABDD] uppercase font-bold">
                              (Correct Key)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-[#64748B] bg-[#F5F8FC] p-2 border border-[#CBD5E1]/60">
                    <strong>Explanation:</strong> {item.explanation}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current Question Count in Quiz */}
          <div className="p-4 bg-white border border-[#CBD5E1] flex items-center justify-between text-xs">
            <span>
              Current Quiz Bank: <strong className="text-[#1C2C5B]">{questions.length} Questions</strong> accepted
            </span>
            <OutlineButton onClick={() => setStep(2)}>Review Current Questions in Step 2</OutlineButton>
          </div>
        </div>
      )}

      {/* STEP 4: Learner Preview */}
      {step === 4 && (
        <div className="bg-white border border-[#CBD5E1] p-6 shadow-xs space-y-6">
          <div className="pb-3 border-b border-[#CBD5E1] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6CABDD] block">
                Learner Preview Mode
              </span>
              <h3 className="text-lg font-bold text-[#1C2C5B]">{title}</h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Exact appearance as rendered on school tablets during active taking
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#1C2C5B] bg-[#E8F3FC] px-3 py-1 border border-[#6CABDD]/40">
              Duration: {durationMinutes} mins
            </span>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            {questions.map((q, idx) => (
              <div key={q.id} className="p-5 border border-[#CBD5E1] bg-[#F5F8FC]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-[#1C2C5B] uppercase">
                    Question {idx + 1} of {questions.length}
                  </span>
                  <span className="text-xs text-[#64748B]">{q.marks} Marks</span>
                </div>
                <h4 className="text-sm font-bold text-[#0F172A] mb-4">{q.prompt}</h4>

                {q.type === 'multiple_choice' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="p-3 bg-white border border-[#CBD5E1] text-xs font-medium text-[#0F172A] hover:border-[#6CABDD] cursor-pointer"
                      >
                        {opt.text}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white border border-[#CBD5E1] text-xs font-bold text-center hover:border-[#6CABDD] cursor-pointer">
                      TRUE
                    </div>
                    <div className="p-3 bg-white border border-[#CBD5E1] text-xs font-bold text-center hover:border-[#6CABDD] cursor-pointer">
                      FALSE
                    </div>
                  </div>
                )}

                {q.type === 'short_answer' && (
                  <InputField
                    type="text"
                    disabled
                    placeholder="Learner will type short response here..."
                    className="bg-white text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 5: Publication Settings */}
      {step === 5 && (
        <div className="bg-white border border-[#CBD5E1] p-6 shadow-xs space-y-6">
          <div className="pb-3 border-b border-[#CBD5E1]">
            <h3 className="text-base font-bold uppercase tracking-wider text-[#1C2C5B]">
              Step 5: Availability & Release Policy Rules
            </h3>
            <p className="text-xs text-[#64748B]">
              Configure submission synchronization, offline tablet permissions, and result visibility
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <FormField
                label="Result Release Policy"
                required
                helperText="Controls when marks become visible on learner tablets"
              >
                <SelectField
                  value={releasePolicy}
                  onChange={(e) => setReleasePolicy(e.target.value as ReleasePolicy)}
                >
                  <option value="manual">Manual Release (Teacher reviews and explicitly releases)</option>
                  <option value="automatic">Automatic Release (Releases once cohort submits)</option>
                </SelectField>
              </FormField>

              <FormField
                label="Offline Tablet Caching"
                required
                helperText="Allows learners to take assessment without continuous internet connection"
              >
                <SelectField
                  value={allowOffline ? 'true' : 'false'}
                  onChange={(e) => setAllowOffline(e.target.value === 'true')}
                >
                  <option value="true">Enabled (Downloaded to tablet IndexedDB)</option>
                  <option value="false">Disabled (Enforce active internet connection)</option>
                </SelectField>
              </FormField>

              <FormField label="Maximum Attempt Policy">
                <SelectField
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(Number(e.target.value))}
                >
                  <option value={1}>1 Attempt Only (Standard Formal Assessment)</option>
                  <option value={2}>2 Attempts (Revision Mode)</option>
                </SelectField>
              </FormField>

              <FormField
                label="Assessment Deadline / Due Date (Optional)"
                helperText="Submissions after this deadline will be rejected by the server"
              >
                <InputField
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs"
                />
              </FormField>
            </div>

            <div className="p-5 bg-[#F5F8FC] border border-[#CBD5E1] space-y-3 text-xs">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#1C2C5B]">
                Publication Summary Check
              </h4>
              <div className="flex justify-between py-1 border-b border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Assigned Cohort:</span>
                <span className="font-bold text-[#0F172A]">{selectedClass?.name} ({grade})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Question Count:</span>
                <span className="font-bold text-[#0F172A]">{questions.length} Items</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Total Marks:</span>
                <span className="font-bold text-[#1C2C5B]">
                  {questions.reduce((sum, q) => sum + q.marks, 0)} Marks
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#CBD5E1]/60">
                <span className="text-[#64748B]">Release Visibility:</span>
                <span className="font-semibold text-[#1C2C5B] uppercase">{releasePolicy}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#64748B]">Offline Support:</span>
                <span className="font-semibold text-[#0F172A]">
                  {allowOffline ? 'Active (Pre-cached)' : 'Online Only'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#E8F3FC] border border-[#6CABDD]/50 text-xs text-[#1C2C5B]">
            <p className="font-bold">Honest Architectural Confirmation</p>
            <p className="mt-0.5 text-[#0F172A]">
              Saving a draft does not expose questions to learners. Clicking "Publish Assessment" immediately enables tablet downloading and assessment taking.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Footer Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-[#CBD5E1]">
        <div>
          {step > 1 ? (
            <OutlineButton onClick={handlePrevStep} icon={<ArrowLeft size={14} />}>
              Previous Step
            </OutlineButton>
          ) : (
            <OutlineButton onClick={() => navigate('/teacher/quizzes')}>Cancel</OutlineButton>
          )}
        </div>

        <div className="flex items-center gap-3">
          <OutlineButton onClick={handleSaveDraft} icon={<Save size={14} />}>
            Save as Draft
          </OutlineButton>

          {step < 5 ? (
            <PrimaryButton onClick={handleNextStep}>
              Next Step <ArrowRight size={14} className="ml-1 inline" />
            </PrimaryButton>
          ) : (
            <PrimaryButton
              onClick={() => setIsPublishConfirmOpen(true)}
              icon={<CheckCircle2 size={14} />}
            >
              Publish Assessment
            </PrimaryButton>
          )}
        </div>
      </div>

      {/* Publish Dialog */}
      <ConfirmDialog
        isOpen={isPublishConfirmOpen}
        title="Confirm Assessment Publication"
        message={`Publish "${title}" to ${selectedClass?.name}? The quiz will be cached for offline tablet attempts and immediately accessible to enrolled learners.`}
        confirmLabel="Confirm & Publish"
        onConfirm={handlePublishAssessment}
        onCancel={() => setIsPublishConfirmOpen(false)}
      />
    </div>
  );
};

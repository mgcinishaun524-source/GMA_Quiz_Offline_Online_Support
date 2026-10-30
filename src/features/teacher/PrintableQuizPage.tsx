import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthContext';
import { appDataStore } from '../../services/storage';
import { authService } from '../../services/auth-service';
import { Quiz } from '../../types/quiz';
import { Printer, ArrowLeft, ShieldCheck, AlertCircle, FileText, CheckCircle2, Download } from 'lucide-react';
import { PrimaryButton, OutlineButton } from '../../components/ui/Buttons';

interface PaperData {
  institution: string;
  motto: string;
  documentType: string;
  quizId: string;
  title: string;
  grade: string;
  classId?: string;
  className?: string;
  subjectName?: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  instructions: string;
  questions: Array<{
    number: number;
    id: string;
    type: string;
    prompt: string;
    marks: number;
    topic: string;
    options?: Array<{ id: string; text: string }>;
  }>;
}

interface AnswerKeyData {
  institution: string;
  isConfidential: boolean;
  confidentialityNotice: string;
  documentType: string;
  quizId: string;
  title: string;
  grade: string;
  className?: string;
  subjectName?: string;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  releasePolicy: string;
  authorName?: string;
  questions: Array<{
    number: number;
    id: string;
    type: string;
    prompt: string;
    marks: number;
    topic: string;
    options?: Array<{ id: string; text: string }>;
    correctAnswer: string;
    explanation?: string;
  }>;
}

export const PrintableQuizPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();

  const isStaff = role === 'teacher' || role === 'admin';
  const initialMode = searchParams.get('mode') === 'answer_key' && isStaff ? 'answer_key' : 'paper';
  const [viewMode, setViewMode] = useState<'paper' | 'answer_key'>(initialMode);

  const [paper, setPaper] = useState<PaperData | null>(null);
  const [answerKey, setAnswerKey] = useState<AnswerKeyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Paper and (if staff) Answer Key
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);

    const token = authService.getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const loadData = async () => {
      try {
        // 1. Fetch Candidate Question Paper
        const paperRes = await fetch(`/api/quizzes/${id}/paper`, { headers });
        if (paperRes.ok) {
          const data = await paperRes.json();
          setPaper(data.paper);
        } else {
          // Local fallback from appDataStore
          const localQuiz = appDataStore.getQuizById(id);
          if (localQuiz) {
            setPaper({
              institution: 'Growing Minds Academy',
              motto: 'Excellence • Integrity • Curiosity',
              documentType: 'Official Assessment Examination Paper',
              quizId: localQuiz.id,
              title: localQuiz.title,
              grade: localQuiz.grade,
              className: localQuiz.className,
              subjectName: localQuiz.subjectName,
              durationMinutes: localQuiz.durationMinutes,
              totalMarks: localQuiz.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0),
              questionCount: localQuiz.questions.length,
              instructions: localQuiz.instructions || 'Read all questions carefully. Answer all questions clearly.',
              questions: localQuiz.questions.map((q, idx) => ({
                number: idx + 1,
                id: q.id,
                type: q.type,
                prompt: q.prompt,
                marks: q.marks,
                topic: q.topic,
                options: q.options ? q.options.map((o) => ({ id: o.id, text: o.text })) : undefined,
              })),
            });
          } else {
            setErrorMessage('Unable to load assessment paper.');
          }
        }

        // 2. If staff, fetch Answer Key
        if (isStaff) {
          const keyRes = await fetch(`/api/quizzes/${id}/answer-key`, { headers });
          if (keyRes.ok) {
            const keyData = await keyRes.json();
            setAnswerKey(keyData.answerKey);
          } else {
            // Local fallback for staff only
            const localQuiz = appDataStore.getQuizById(id);
            if (localQuiz) {
              setAnswerKey({
                institution: 'Growing Minds Academy',
                isConfidential: true,
                confidentialityNotice: 'CONFIDENTIAL — FOR AUTHORIZED TEACHING STAFF ONLY. STRICTLY PROHIBITED FROM STUDENT ACCESS.',
                documentType: 'Official Teacher Answer Key & Mark Scheme',
                quizId: localQuiz.id,
                title: localQuiz.title,
                grade: localQuiz.grade,
                className: localQuiz.className,
                subjectName: localQuiz.subjectName,
                durationMinutes: localQuiz.durationMinutes,
                totalMarks: localQuiz.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0),
                questionCount: localQuiz.questions.length,
                releasePolicy: localQuiz.releasePolicy,
                authorName: localQuiz.authorName,
                questions: localQuiz.questions.map((q, idx) => ({
                  number: idx + 1,
                  id: q.id,
                  type: q.type,
                  prompt: q.prompt,
                  marks: q.marks,
                  topic: q.topic,
                  options: q.options,
                  correctAnswer: q.correctAnswer,
                  explanation: q.explanation || 'Verified curriculum standard answer.',
                })),
              });
            }
          }
        }
      } catch (err) {
        console.warn('Network error loading printable quiz:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id, isStaff]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportDocx = () => {
    const isAnswerKey = viewMode === 'answer_key';
    const targetTitle = isAnswerKey
      ? `${(answerKey?.title || 'Assessment').replace(/[^a-zA-Z0-9_-]/g, '_')}_Staff_Answer_Key`
      : `${(paper?.title || 'Assessment').replace(/[^a-zA-Z0-9_-]/g, '_')}_Question_Paper`;

    let bodyHtml = '';
    if (isAnswerKey && answerKey) {
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; color: #1C2C5B; margin: 20px;">
          <h1 style="text-align: center; margin-bottom: 2px;">GROWING MINDS ACADEMY</h1>
          <h3 style="text-align: center; color: #DC2626; margin-top: 0;">CONFIDENTIAL TEACHER ANSWER KEY & MARK SCHEME</h3>
          <p style="text-align: center; font-size: 10pt; color: #DC2626; font-weight: bold;">FOR AUTHORIZED TEACHING STAFF ONLY • STRICTLY PROHIBITED FROM STUDENT ACCESS</p>
          <hr style="border: 1px solid #1C2C5B; margin: 15px 0;" />
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt;">
            <tr><td><strong>Assessment:</strong> ${answerKey.title}</td><td><strong>Cohort:</strong> ${answerKey.grade} (${answerKey.className || 'All'})</td></tr>
            <tr><td><strong>Subject:</strong> ${answerKey.subjectName || 'General'}</td><td><strong>Total Marks:</strong> ${answerKey.totalMarks} Marks</td></tr>
            <tr><td><strong>Duration:</strong> ${answerKey.durationMinutes} Minutes</td><td><strong>Questions:</strong> ${answerKey.questionCount} Questions</td></tr>
          </table>
          <hr style="border: 0.5px solid #CBD5E1; margin-bottom: 20px;" />
          ${answerKey.questions
            .map(
              (q) => `
            <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
              <p><strong>Question ${q.number}</strong> [${q.marks} Marks] <em>(Topic: ${q.topic})</em></p>
              <p style="font-size: 11pt; margin-left: 15px;">${q.prompt}</p>
              ${
                q.options
                  ? `
                <ul style="list-style-type: none; padding-left: 20px;">
                  ${q.options
                    .map(
                      (opt, i) => `
                    <li style="margin-bottom: 4px; ${opt.id === q.correctAnswer ? 'font-weight: bold; color: #1C2C5B; background-color: #E8F3FC; padding: 4px;' : ''}">
                      [${['A', 'B', 'C', 'D', 'E'][i] || i + 1}] ${opt.text} ${opt.id === q.correctAnswer ? '<strong>(CORRECT KEY)</strong>' : ''}
                    </li>
                  `
                    )
                    .join('')}
                </ul>
              `
                  : ''
              }
              ${q.type === 'true_false' ? `<p style="margin-left: 20px; font-weight: bold; color: #1C2C5B;">CORRECT KEY: ${String(q.correctAnswer).toUpperCase()}</p>` : ''}
              ${q.type === 'short_answer' ? `<p style="margin-left: 20px; font-weight: bold; color: #1C2C5B;">ACCEPTED KEY: "${q.correctAnswer}"</p>` : ''}
              ${q.explanation ? `<p style="font-size: 10pt; color: #475569; margin-left: 20px;"><strong>Marking Guide & Explanation:</strong> ${q.explanation}</p>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } else if (paper) {
      bodyHtml = `
        <div style="font-family: Arial, sans-serif; color: #0F172A; margin: 20px;">
          <h1 style="text-align: center; color: #1C2C5B; margin-bottom: 2px;">GROWING MINDS ACADEMY</h1>
          <p style="text-align: center; font-size: 10pt; color: #64748B; margin-top: 0; text-transform: uppercase;">Excellence • Integrity • Curiosity</p>
          <h2 style="text-align: center; margin-top: 4px; border-top: 2px solid #1C2C5B; padding-top: 8px;">OFFICIAL ASSESSMENT EXAMINATION PAPER</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10.5pt;">
            <tr><td><strong>Assessment:</strong> ${paper.title}</td><td><strong>Cohort:</strong> ${paper.grade} (${paper.className || 'All'})</td></tr>
            <tr><td><strong>Subject:</strong> ${paper.subjectName || 'General'}</td><td><strong>Duration:</strong> ${paper.durationMinutes} Minutes</td></tr>
            <tr><td><strong>Total Marks:</strong> ${paper.totalMarks} Marks</td><td><strong>Questions:</strong> ${paper.questionCount} Questions</td></tr>
          </table>

          <table style="width: 100%; border: 2px solid #1C2C5B; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td colspan="2" style="background-color: #F8FAFC; padding: 6px; font-weight: bold; border-bottom: 1px solid #CBD5E1;">CANDIDATE IDENTIFICATION DETAILS</td></tr>
            <tr>
              <td style="padding: 8px; width: 50%;">Candidate Name: ___________________________________</td>
              <td style="padding: 8px; width: 50%;">Candidate ID: ___________________________________</td>
            </tr>
            <tr>
              <td style="padding: 8px;">Date of Exam: ____________________</td>
              <td style="padding: 8px;">Room / Desk: ____________________</td>
            </tr>
          </table>

          <div style="background-color: #F8FAFC; border: 1px solid #CBD5E1; padding: 10px; font-size: 9.5pt; margin-bottom: 20px;">
            <strong>Instructions to Candidates:</strong><br/>
            1. Ensure all candidate details above are completed clearly in ink.<br/>
            2. For Multiple Choice questions, mark [X] in the box corresponding to your chosen option.<br/>
            3. For True/False questions, tick either TRUE or FALSE.<br/>
            4. For Short Answer questions, write your clear answer on the lines provided.<br/>
            5. Hand this question paper to your examiner when time expires.
          </div>

          <hr style="border: 1px solid #1C2C5B; margin-bottom: 20px;" />

          ${paper.questions
            .map(
              (q) => `
            <div style="margin-bottom: 24px; page-break-inside: avoid;">
              <p style="margin-bottom: 4px;">
                <strong>Question ${q.number}.</strong> 
                <span style="font-size: 9.5pt; color: #64748B;">[${q.marks} ${q.marks === 1 ? 'Mark' : 'Marks'}] (Topic: ${q.topic})</span>
              </p>
              <p style="font-size: 11pt; margin-top: 4px; margin-left: 10px;">${q.prompt}</p>
              ${
                q.options
                  ? `
                <table style="width: 100%; margin-left: 20px; margin-top: 8px; border-collapse: collapse;">
                  ${q.options
                    .map(
                      (opt, i) => `
                    <tr>
                      <td style="padding: 4px; width: 40px;"><strong>[ &nbsp; ] ${['A', 'B', 'C', 'D', 'E'][i] || i + 1}.</strong></td>
                      <td style="padding: 4px;">${opt.text}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </table>
              `
                  : ''
              }
              ${
                q.type === 'true_false'
                  ? `
                <div style="margin-left: 20px; margin-top: 8px;">
                  [ &nbsp; ] TRUE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] FALSE
                </div>
              `
                  : ''
              }
              ${
                q.type === 'short_answer'
                  ? `
                <div style="margin-left: 20px; margin-top: 10px;">
                  Candidate Answer:<br/><br/>
                  __________________________________________________________________________________________<br/><br/>
                  __________________________________________________________________________________________
                </div>
              `
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    const docFile = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${targetTitle}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + docFile], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetTitle}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleModeChange = (newMode: 'paper' | 'answer_key') => {
    setViewMode(newMode);
    setSearchParams({ mode: newMode });
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-white border border-[#CBD5E1] p-12 text-center">
        <div>
          <div className="w-8 h-8 border-3 border-[#6CABDD] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-[#1C2C5B]">Preparing Examination Print Layout...</p>
        </div>
      </div>
    );
  }

  if (errorMessage || (!paper && !answerKey)) {
    return (
      <div className="bg-white border border-[#CBD5E1] p-10 text-center space-y-4">
        <AlertCircle size={36} className="mx-auto text-[#DC2626]" />
        <h3 className="text-base font-bold text-[#1C2C5B]">Examination Document Unavailable</h3>
        <p className="text-xs text-[#64748B] max-w-md mx-auto">{errorMessage || 'The requested assessment could not be formatted for print export.'}</p>
        <OutlineButton onClick={() => navigate(-1)} icon={<ArrowLeft size={13} />}>
          Go Back
        </OutlineButton>
      </div>
    );
  }

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="space-y-6">
      {/* Print Controls Bar - strictly hidden in @media print */}
      <div className="no-print bg-[#1C2C5B] text-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#6CABDD]">
            Print & PDF Export Utility
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <div className="flex items-center bg-[#0F172A] border border-white/20 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleModeChange('paper')}
                className={`px-3 py-1 font-semibold transition-colors flex items-center gap-1.5 ${
                  viewMode === 'paper' ? 'bg-[#6CABDD] text-[#1C2C5B]' : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText size={12} /> Candidate Paper
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('answer_key')}
                className={`px-3 py-1 font-semibold transition-colors flex items-center gap-1.5 ${
                  viewMode === 'answer_key' ? 'bg-[#6CABDD] text-[#1C2C5B]' : 'text-slate-300 hover:text-white'
                }`}
              >
                <ShieldCheck size={12} /> Staff Answer Key (Confidential)
              </button>
            </div>
          )}

          <OutlineButton
            onClick={handleExportDocx}
            icon={<Download size={14} />}
            className="text-white border-white/30 hover:border-white bg-[#0F172A]"
            title="Download clean, editable Word document"
          >
            Export Word (.doc)
          </OutlineButton>

          <PrimaryButton onClick={handlePrint} icon={<Printer size={14} />}>
            Print / Save as PDF
          </PrimaryButton>
        </div>
      </div>

      {/* Printable Sheet Viewport Container */}
      <div className="printable-document bg-white border border-[#CBD5E1] p-8 md:p-12 shadow-sm max-w-4xl mx-auto text-[#0F172A]">
        {/* Style tag injected for clean print-specific media query behavior */}
        <style>{`
          @media print {
            body {
              background: #ffffff !important;
              color: #000000 !important;
              font-size: 11pt !important;
            }
            .no-print, header, nav, aside, footer {
              display: none !important;
            }
            .printable-document {
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
              box-shadow: none !important;
            }
            .page-break-avoid {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            @page {
              margin: 15mm;
              size: A4 portrait;
            }
          }
        `}</style>

        {/* ---------------- MODE 1: CANDIDATE QUESTION PAPER ---------------- */}
        {viewMode === 'paper' && paper && (
          <div className="space-y-6">
            {/* Formal Examination Header */}
            <div className="border-b-2 border-[#1C2C5B] pb-4 text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl font-black tracking-widest text-[#1C2C5B] uppercase">
                  {paper.institution}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-[#64748B] tracking-wider uppercase">
                {paper.motto}
              </p>
              <div className="inline-block bg-[#1C2C5B] text-white text-xs font-bold px-3 py-0.5 tracking-wider uppercase mt-1">
                {paper.documentType}
              </div>
            </div>

            {/* Assessment Metadata Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] border border-[#CBD5E1] p-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">Subject</span>
                <span className="font-bold text-[#1C2C5B]">{paper.subjectName || 'General'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">Cohort / Grade</span>
                <span className="font-bold text-[#1C2C5B]">{paper.grade} ({paper.className || 'All'})</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">Time Allowed</span>
                <span className="font-bold text-[#1C2C5B]">{paper.durationMinutes} Minutes</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">Total Marks</span>
                <span className="font-bold text-[#1C2C5B]">{paper.totalMarks} Marks Available</span>
              </div>
            </div>

            {/* Candidate Identification Box */}
            <div className="border-2 border-[#1C2C5B] p-4 bg-white space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1C2C5B] block border-b border-[#CBD5E1] pb-1">
                Candidate Identification Details (Please Print In Ink)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#64748B] font-semibold block mb-1">Student Full Name:</span>
                  <div className="border-b border-[#0F172A] h-6 flex items-end">
                    <span className="text-[11px] text-slate-400 italic">Surname, First Name</span>
                  </div>
                </div>
                <div>
                  <span className="text-[#64748B] font-semibold block mb-1">Candidate / Student ID:</span>
                  <div className="border-b border-[#0F172A] h-6 flex items-end">
                    <span className="text-[11px] text-slate-400 italic">e.g. GMA-2026-XXXX</span>
                  </div>
                </div>
                <div>
                  <span className="text-[#64748B] font-semibold block mb-1">Examination Date:</span>
                  <div className="border-b border-[#0F172A] h-6" />
                </div>
                <div>
                  <span className="text-[#64748B] font-semibold block mb-1">Room / Desk Number:</span>
                  <div className="border-b border-[#0F172A] h-6" />
                </div>
              </div>
            </div>

            {/* Candidate Instructions */}
            <div className="bg-[#F8FAFC] border border-[#CBD5E1] p-3 text-[11px] text-[#334155] space-y-1">
              <strong className="text-[#1C2C5B] uppercase block">Instructions to Candidates:</strong>
              <p>1. Check that your question paper contains all <strong>{paper.questionCount} numbered questions</strong> before beginning.</p>
              <p>2. For Multiple Choice questions: Mark your chosen response by shading or ticking the corresponding box [A], [B], [C], or [D].</p>
              <p>3. For True/False questions: Tick either [ &nbsp; ] TRUE or [ &nbsp; ] FALSE.</p>
              <p>4. For Short Answer questions: Write your concise answer clearly on the dotted lines provided.</p>
              <p>5. Hand in this entire paper to the invigilator when finished.</p>
            </div>

            {/* Assessment Title Header */}
            <div className="pt-2 pb-1 border-b border-[#CBD5E1] flex justify-between items-baseline">
              <h2 className="text-base font-bold text-[#1C2C5B]">{paper.title}</h2>
              <span className="text-xs font-semibold text-[#64748B]">{paper.questionCount} Questions</span>
            </div>

            {/* Questions Sequence */}
            <div className="space-y-6 pt-2">
              {paper.questions.map((q) => (
                <div
                  key={q.id}
                  className="page-break-avoid border-b border-[#CBD5E1] pb-5 pt-1 space-y-3"
                >
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#1C2C5B]">
                        Question {q.number}.
                      </span>
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Topic: {q.topic}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#1C2C5B] bg-[#F1F5F9] px-2 py-0.5 border border-[#CBD5E1]">
                      [{q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}]
                    </span>
                  </div>

                  {/* Prompt */}
                  <p className="text-sm text-[#0F172A] font-medium leading-relaxed pl-1">
                    {q.prompt}
                  </p>

                  {/* Multiple Choice Options */}
                  {q.type === 'multiple_choice' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-3 pt-1">
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={opt.id}
                          className="flex items-center gap-2.5 p-2 border border-[#CBD5E1] bg-[#FAFAFA]"
                        >
                          <div className="w-5 h-5 border-2 border-[#1C2C5B] flex items-center justify-center font-bold text-[10px] text-[#1C2C5B]">
                            {optionLetters[optIdx] || optIdx + 1}
                          </div>
                          <span className="text-xs text-[#0F172A]">{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* True / False Checkboxes */}
                  {q.type === 'true_false' && (
                    <div className="flex items-center gap-6 pl-3 pt-1">
                      <div className="flex items-center gap-2 border border-[#CBD5E1] px-4 py-2 bg-[#FAFAFA]">
                        <div className="w-5 h-5 border-2 border-[#1C2C5B]" />
                        <span className="text-xs font-bold text-[#1C2C5B]">TRUE</span>
                      </div>
                      <div className="flex items-center gap-2 border border-[#CBD5E1] px-4 py-2 bg-[#FAFAFA]">
                        <div className="w-5 h-5 border-2 border-[#1C2C5B]" />
                        <span className="text-xs font-bold text-[#1C2C5B]">FALSE</span>
                      </div>
                    </div>
                  )}

                  {/* Short Answer Lined Area */}
                  {q.type === 'short_answer' && (
                    <div className="pl-3 pt-2 space-y-3">
                      <div className="text-[11px] font-semibold text-[#64748B]">
                        Candidate Answer:
                      </div>
                      <div className="border-b border-dotted border-[#0F172A] h-6" />
                      <div className="border-b border-dotted border-[#0F172A] h-6" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Document Footer */}
            <div className="pt-6 text-center text-[10px] text-[#64748B] border-t border-[#CBD5E1] flex justify-between">
              <span>Growing Minds Academy • Assessment Examinations</span>
              <span>End of Examination Paper</span>
            </div>
          </div>
        )}

        {/* ---------------- MODE 2: STAFF ANSWER KEY (CONFIDENTIAL) ---------------- */}
        {viewMode === 'answer_key' && answerKey && (
          <div className="space-y-6">
            {/* Header */}
            <div className="border-b-2 border-[#DC2626] pb-4 text-center space-y-1">
              <span className="text-xl font-black tracking-widest text-[#1C2C5B] uppercase block">
                {answerKey.institution}
              </span>
              <div className="inline-block bg-[#DC2626] text-white text-xs font-bold px-3 py-1 tracking-wider uppercase">
                {answerKey.documentType}
              </div>
              <p className="text-[11px] font-bold text-[#DC2626] tracking-wider uppercase mt-1">
                {answerKey.confidentialityNotice}
              </p>
            </div>

            {/* Metadata Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FEF2F2] border border-[#DC2626]/30 p-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#991B1B] block">Subject & Cohort</span>
                <span className="font-bold text-[#0F172A]">{answerKey.subjectName} • {answerKey.className}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#991B1B] block">Assessment Title</span>
                <span className="font-bold text-[#0F172A]">{answerKey.title}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#991B1B] block">Total Questions</span>
                <span className="font-bold text-[#0F172A]">{answerKey.questionCount} Questions</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-[#991B1B] block">Total Marks Available</span>
                <span className="font-bold text-[#0F172A]">{answerKey.totalMarks} Marks</span>
              </div>
            </div>

            {/* Answer Key Question List */}
            <div className="space-y-5 pt-2">
              {answerKey.questions.map((q) => (
                <div
                  key={q.id}
                  className="page-break-avoid border border-[#CBD5E1] p-4 bg-[#FAFAFA] space-y-2 text-xs"
                >
                  <div className="flex justify-between items-baseline border-b border-[#CBD5E1] pb-1.5">
                    <span className="font-bold text-[#1C2C5B]">
                      Question #{q.number} ({q.type.replace('_', ' ').toUpperCase()})
                    </span>
                    <span className="font-semibold text-[#64748B]">
                      {q.marks} Marks • Topic: {q.topic}
                    </span>
                  </div>

                  <p className="font-semibold text-[#0F172A] text-sm pt-0.5">{q.prompt}</p>

                  {/* MCQ answer key */}
                  {q.type === 'multiple_choice' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correctAnswer === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2 border flex items-center justify-between ${
                              isCorrect
                                ? 'bg-[#E8F3FC] border-[#1C2C5B] font-bold text-[#1C2C5B]'
                                : 'bg-white border-[#CBD5E1] text-[#64748B]'
                            }`}
                          >
                            <span>
                              <strong>{optionLetters[optIdx]}.</strong> {opt.text}
                            </span>
                            {isCorrect && (
                              <span className="flex items-center gap-1 text-[10px] text-[#1C2C5B] font-extrabold uppercase">
                                <CheckCircle2 size={12} className="text-[#1C2C5B]" /> Correct Key
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True/False answer key */}
                  {q.type === 'true_false' && (
                    <div className="p-2.5 bg-[#E8F3FC] border border-[#1C2C5B] inline-block font-extrabold text-[#1C2C5B]">
                      Verified Key: {String(q.correctAnswer).toUpperCase()}
                    </div>
                  )}

                  {/* Short Answer key */}
                  {q.type === 'short_answer' && (
                    <div className="p-2.5 bg-[#E8F3FC] border border-[#1C2C5B] inline-block font-mono font-bold text-[#1C2C5B]">
                      Accepted Key: "{q.correctAnswer}"
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="pt-1.5 text-[11px] text-[#475569] border-t border-[#CBD5E1]/60 mt-2">
                      <strong className="text-[#1C2C5B]">Marking Guide & Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Confidential Footer */}
            <div className="pt-6 text-center text-[10px] text-[#DC2626] font-bold border-t border-[#DC2626]/30 flex justify-between">
              <span>CONFIDENTIAL MARK SCHEME</span>
              <span>STAFF ACCESS ONLY • DO NOT DUPLICATE FOR LEARNERS</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

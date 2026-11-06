// Tracks the in-flight (and last) learner submission so the confirmation screen
// can show live status. The learner is navigated to the receipt immediately on
// submit and the receipt flips from 'saving' to the real outcome once the server
// answers, instead of the learner waiting on the network with no feedback.
//
// This is deliberately honest: 'saved' is only shown after the server confirms,
// a rejected attempt shows the real reason, and an unreachable server resolves to
// the durable offline queue — never to a fabricated success.
//
// The last receipt is mirrored into sessionStorage so a page refresh (or the
// learner reopening the receipt tab) keeps showing the true outcome instead of
// resetting to a default.

export type ReceiptStatus = 'saving' | 'saved' | 'offline' | 'rejected';

export interface SubmissionReceipt {
  submissionId: string;
  quizId?: string;
  quizTitle: string;
  status: ReceiptStatus;
  error?: string;
}

const STORAGE_KEY = 'gma.submissionReceipt';

function readStored(): SubmissionReceipt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SubmissionReceipt) : null;
  } catch {
    return null;
  }
}

function writeStored(receipt: SubmissionReceipt | null): void {
  try {
    if (receipt) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(receipt));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable (private mode / no DOM) — live state still works.
  }
}

class SubmissionReceiptStore {
  private current: SubmissionReceipt | null = readStored();
  private listeners: Set<() => void> = new Set();

  public get(): SubmissionReceipt | null {
    return this.current;
  }

  public set(receipt: SubmissionReceipt | null): void {
    this.current = receipt;
    writeStored(receipt);
    this.listeners.forEach((fn) => fn());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const submissionReceiptStore = new SubmissionReceiptStore();

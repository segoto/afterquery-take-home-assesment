'use client';

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { Button, Spinner } from '@/components/ui';
import { VoiceRecorder } from './VoiceRecorder';
import { TranscriptView } from './TranscriptView';
import { DecisionPanel } from '@/components/DecisionPanel';
import type {
  Job,
  InterviewRoomState,
  InterviewRoomAction,
  PostSessionResponse,
  PostInterviewSuccessResponse,
} from '@/types';

const INITIAL_QUESTION =
  'Welcome! Please start by telling me about yourself and your background.';

const initialState: InterviewRoomState = {
  phase: 'session_creating',
  sessionId: null,
  currentQuestion: '',
  turns: [],
  turnNumber: 0,
  errorMessage: null,
  interimTranscript: '',
  retryCount: 0,
  decisionState: null,
};

function interviewReducer(
  state: InterviewRoomState,
  action: InterviewRoomAction
): InterviewRoomState {
  switch (action.type) {
    case 'SESSION_CREATED':
      return {
        ...state,
        phase: 'awaiting_recording',
        sessionId: action.sessionId,
        currentQuestion: INITIAL_QUESTION,
        errorMessage: null,
      };
    case 'SESSION_ERROR':
      return {
        ...state,
        phase: 'session_error',
        errorMessage: action.message,
      };
    case 'RECORDING_STARTED':
      return { ...state, phase: 'recording' };
    case 'INTERIM_TRANSCRIPT':
      return { ...state, interimTranscript: action.text };
    case 'FINAL_TRANSCRIPT':
      return {
        ...state,
        phase: 'processing',
        interimTranscript: '',
        turns: [
          ...state.turns,
          {
            id: crypto.randomUUID(),
            speaker: 'AI' as const,
            content: action.currentQuestion,
            createdAt: new Date(),
          },
          {
            id: crypto.randomUUID(),
            speaker: 'USER' as const,
            content: action.transcript,
            createdAt: new Date(),
          },
        ],
      };
    case 'TURN_SAVED':
      if (action.isComplete) {
        return {
          ...state,
          phase: 'complete',
          turnNumber: state.turnNumber + 1,
          currentQuestion: action.nextQuestion,
          decisionState: action.decisionState,
        };
      }
      return {
        ...state,
        phase: 'awaiting_recording',
        turnNumber: state.turnNumber + 1,
        currentQuestion: action.nextQuestion,
        errorMessage: null,
        decisionState: action.decisionState,
      };
    case 'API_ERROR':
      return {
        ...state,
        phase: 'api_error',
        errorMessage: action.message,
      };
    case 'RETRY_SESSION':
      return {
        ...state,
        phase: 'session_creating',
        retryCount: state.retryCount + 1,
      };
    case 'RETRY_TURN':
      return { ...state, phase: 'processing' };
    default:
      return state;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

interface InterviewRoomProps {
  job: Job;
}

export function InterviewRoom({ job }: InterviewRoomProps) {
  const [state, dispatch] = useReducer(interviewReducer, initialState);
  // Tracks the retryCount for which session creation was last initiated.
  // Prevents React Strict Mode's double-invocation from creating two sessions.
  const sessionCreatedForRetryRef = useRef<number | null>(null);
  // Prevents duplicate turn submissions from Strict Mode double-invocation.
  const turnSubmittingRef = useRef<boolean>(false);

  const speakQuestion = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } catch {
      // TTS failure is non-blocking
    }
  }, []);

  // Session creation effect — re-runs whenever retryCount changes
  useEffect(() => {
    if (state.phase !== 'session_creating') return;
    if (sessionCreatedForRetryRef.current === state.retryCount) return;
    sessionCreatedForRetryRef.current = state.retryCount;
    let cancelled = false;
    async function createSession() {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: job.id }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          dispatch({
            type: 'SESSION_ERROR',
            message: data.error ?? 'Failed to start session.',
          });
          return;
        }
        const data = (await res.json()) as PostSessionResponse;
        dispatch({ type: 'SESSION_CREATED', sessionId: data.id });
        speakQuestion(INITIAL_QUESTION);
      } catch {
        if (!cancelled)
          dispatch({
            type: 'SESSION_ERROR',
            message: 'Network error. Please check your connection.',
          });
      }
    }
    createSession();
    return () => {
      cancelled = true;
    };
  }, [state.retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Turn submission effect — fires whenever phase changes to 'processing'
  useEffect(() => {
    if (state.phase !== 'processing' || !state.sessionId) return;
    if (turnSubmittingRef.current) return;
    turnSubmittingRef.current = true;
    let cancelled = false;
    const userAnswer = state.turns[state.turns.length - 1]?.content ?? '';
    async function submitTurn() {
      try {
        const res = await fetch('/api/interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.sessionId,
            userAnswer,
            currentQuestion: state.currentQuestion,
          }),
        });
        if (cancelled) return;
        if (res.status === 404) {
          dispatch({ type: 'API_ERROR', message: 'Session not found.' });
          return;
        }
        if (res.status === 409) {
          dispatch({
            type: 'API_ERROR',
            message: 'Your session has already ended.',
          });
          return;
        }
        if (!res.ok) {
          dispatch({
            type: 'API_ERROR',
            message: 'Failed to save your answer. Please try again.',
          });
          return;
        }
        const data = (await res.json()) as PostInterviewSuccessResponse;
        if (cancelled) return;
        dispatch({
          type: 'TURN_SAVED',
          nextQuestion: data.nextQuestion,
          isComplete: data.isComplete,
          decisionState: data.decisionState ?? null,
        });
        speakQuestion(data.nextQuestion);
      } catch {
        if (!cancelled)
          dispatch({
            type: 'API_ERROR',
            message: 'Failed to save your answer. Please try again.',
          });
      } finally {
        turnSubmittingRef.current = false;
      }
    }
    submitTurn();
    return () => {
      cancelled = true;
    };
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetryTurn = useCallback(() => {
    dispatch({ type: 'RETRY_TURN' });
  }, []);

  // ── Render: session_creating ─────────────────────────────────────────────────
  if (state.phase === 'session_creating') {
    return (
      <div className="flex flex-col items-center justify-center min-h-48 gap-4">
        <Spinner aria-label="Starting your interview…" />
        <p className="text-zinc-500 text-sm">Starting your interview&hellip;</p>
      </div>
    );
  }

  // ── Render: session_error ────────────────────────────────────────────────────
  if (state.phase === 'session_error') {
    return (
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="bg-zinc-800 rounded-xl p-6">
          <p className="text-red-400 text-sm mb-4">{state.errorMessage}</p>
          <Button onClick={() => dispatch({ type: 'RETRY_SESSION' })}>Retry</Button>
        </div>
      </div>
    );
  }

  // ── Render: complete ─────────────────────────────────────────────────────────
  if (state.phase === 'complete') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <p className="text-zinc-700">Interview complete.</p>
        <DecisionPanel decisionState={state.decisionState} isLoading={false} />
      </div>
    );
  }

  // ── Render: awaiting_recording | recording | processing | api_error ──────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
      <div className="flex flex-col gap-6">
        {/* Job title */}
        <h1 className="text-white text-xl font-semibold">{job.title}</h1>

        {/* Question panel */}
        <div className="bg-zinc-800 rounded-xl p-4">
          <p className="text-zinc-400 text-xs mb-1">Current question</p>
          <p className="text-white font-medium">{state.currentQuestion}</p>
          {state.phase === 'recording' && state.interimTranscript && (
            <p className="text-zinc-400 italic text-sm mt-2">{state.interimTranscript}</p>
          )}
        </div>

        {/* Transcript */}
        <TranscriptView turns={state.turns} variant="dark" />

        {/* Voice recorder */}
        {(state.phase === 'awaiting_recording' || state.phase === 'recording') && (
          <VoiceRecorder
            disabled={state.phase !== 'awaiting_recording'}
            onStart={() => dispatch({ type: 'RECORDING_STARTED' })}
            onInterim={(text) => dispatch({ type: 'INTERIM_TRANSCRIPT', text })}
            onTranscript={(transcript) =>
              dispatch({ type: 'FINAL_TRANSCRIPT', transcript, currentQuestion: state.currentQuestion })
            }
            onError={(message) => dispatch({ type: 'API_ERROR', message })}
          />
        )}

        {/* Processing indicator */}
        {state.phase === 'processing' && (
          <div className="flex items-center gap-3">
            <Spinner aria-label="AI is thinking" />
            <span className="text-zinc-400">Thinking&hellip;</span>
          </div>
        )}

        {/* API error */}
        {state.phase === 'api_error' && (
          <div className="bg-zinc-800 rounded-xl p-4">
            <p className="text-red-400 text-sm mb-2">{state.errorMessage}</p>
            <Button variant="secondary" onClick={handleRetryTurn}>Retry</Button>
          </div>
        )}
      </div>

      <DecisionPanel
        decisionState={state.decisionState}
        isLoading={state.phase === 'processing'}
      />
    </div>
  );
}

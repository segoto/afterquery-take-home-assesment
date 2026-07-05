'use client';

import { useReducer, useEffect, useCallback } from 'react';
import { Card, Button } from '@/components/ui';
import { VoiceRecorder } from './VoiceRecorder';
import { TranscriptView } from './TranscriptView';
import type {
  Job,
  InterviewRoomState,
  InterviewRoomAction,
  PostSessionResponse,
  PostInterviewResponse,
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
        };
      }
      return {
        ...state,
        phase: 'awaiting_recording',
        turnNumber: state.turnNumber + 1,
        currentQuestion: action.nextQuestion,
        errorMessage: null,
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

interface InterviewRoomProps {
  job: Job;
}

export function InterviewRoom({ job }: InterviewRoomProps) {
  const [state, dispatch] = useReducer(interviewReducer, initialState);

  const speakQuestion = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch {
      // TTS failure is non-blocking — question is shown in UI regardless
    }
  }, []);

  // Session creation effect — re-runs whenever retryCount changes
  useEffect(() => {
    if (state.phase !== 'session_creating') return;
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
            turnNumber: state.turnNumber,
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
        const data = (await res.json()) as PostInterviewResponse;
        dispatch({
          type: 'TURN_SAVED',
          nextQuestion: data.nextQuestion,
          isComplete: data.isComplete,
        });
        speakQuestion(data.nextQuestion);
      } catch {
        if (!cancelled)
          dispatch({
            type: 'API_ERROR',
            message: 'Failed to save your answer. Please try again.',
          });
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
        <svg
          className="h-8 w-8 animate-spin text-zinc-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-zinc-500 text-sm">Starting your interview&hellip;</p>
      </div>
    );
  }

  // ── Render: session_error ────────────────────────────────────────────────────
  if (state.phase === 'session_error') {
    return (
      <Card>
        <p className="text-red-600 text-sm mb-4">{state.errorMessage}</p>
        <Button onClick={() => dispatch({ type: 'RETRY_SESSION' })}>
          Retry
        </Button>
      </Card>
    );
  }

  // ── Render: complete ─────────────────────────────────────────────────────────
  if (state.phase === 'complete') {
    return <p className="text-zinc-700">Interview complete.</p>;
  }

  // ── Render: awaiting_recording | recording | processing | api_error ──────────
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-sm text-zinc-500 mb-1">Current question</p>
        <p className="text-zinc-900 font-medium">{state.currentQuestion}</p>
        {state.phase === 'recording' && state.interimTranscript && (
          <p className="text-zinc-400 italic text-sm mt-2">
            {state.interimTranscript}
          </p>
        )}
      </Card>
      <TranscriptView turns={state.turns} />
      {state.phase === 'processing' && (
        <p className="text-zinc-500 text-sm">Thinking&hellip;</p>
      )}
      {state.phase === 'api_error' && (
        <Card>
          <p className="text-red-600 text-sm mb-2">{state.errorMessage}</p>
          <Button onClick={handleRetryTurn}>Retry</Button>
        </Card>
      )}
      {(state.phase === 'awaiting_recording' ||
        state.phase === 'recording') && (
        <VoiceRecorder
          disabled={state.phase !== 'awaiting_recording'}
          onStart={() => dispatch({ type: 'RECORDING_STARTED' })}
          onInterim={(text) =>
            dispatch({ type: 'INTERIM_TRANSCRIPT', text })
          }
          onTranscript={(transcript) =>
            dispatch({
              type: 'FINAL_TRANSCRIPT',
              transcript,
              currentQuestion: state.currentQuestion,
            })
          }
          onError={(message) => dispatch({ type: 'API_ERROR', message })}
        />
      )}
    </div>
  );
}

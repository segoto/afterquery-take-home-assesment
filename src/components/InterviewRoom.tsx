'use client';

import { useReducer, useEffect, useCallback, useState, useRef } from 'react';
import { Button, VideoTile, CallTimer } from '@/components/ui';
import { VoiceRecorder } from './VoiceRecorder';
import { TranscriptView } from './TranscriptView';
import type {
  Job,
  InterviewRoomState,
  InterviewRoomAction,
  PostSessionResponse,
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

// ── Module-level SVG constants ───────────────────────────────────────────────

const AIAvatarSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    width="80"
    height="80"
    aria-hidden="true"
  >
    {/* Robot/person outline — simple geometric shapes */}
    <rect x="16" y="20" width="32" height="24" rx="6" fill="#52525b" />
    <circle cx="24" cy="30" r="4" fill="#a1a1aa" />
    <circle cx="40" cy="30" r="4" fill="#a1a1aa" />
    <rect x="22" y="38" width="20" height="3" rx="1.5" fill="#a1a1aa" />
    <rect x="28" y="8" width="8" height="12" rx="4" fill="#52525b" />
    <circle cx="32" cy="8" r="3" fill="#a1a1aa" />
  </svg>
);

const UserSilhouetteSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    fill="none"
    width="80"
    height="80"
    aria-hidden="true"
  >
    <circle cx="32" cy="22" r="12" fill="#52525b" />
    <path
      d="M8 56c0-13.255 10.745-24 24-24s24 10.745 24 24"
      fill="#52525b"
    />
  </svg>
);

const SpinnerSvg = (
  <svg
    className="h-8 w-8 animate-spin text-zinc-400"
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
);

// ── Component ────────────────────────────────────────────────────────────────

interface InterviewRoomProps {
  job: Job;
}

export function InterviewRoom({ job }: InterviewRoomProps) {
  const [state, dispatch] = useReducer(interviewReducer, initialState);

  // Component-level state (NOT reducer fields)
  const [isAISpeaking, setIsAISpeaking] = useState<boolean>(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [cameraGranted, setCameraGranted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const speakQuestion = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsAISpeaking(true);
      utterance.onend = () => setIsAISpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      // TTS failure is non-blocking
    }
  }, []); // setIsAISpeaking is a stable setter, no dep change needed

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
        if (!res.body) {
          dispatch({ type: 'API_ERROR', message: 'Failed to read AI response.' });
          return;
        }
        let accumulated = '';
        try {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            if (cancelled) return;
          }
        } catch {
          if (!cancelled) {
            dispatch({ type: 'API_ERROR', message: 'Failed to read AI response.' });
          }
          return;
        }
        const SENTINEL = '[INTERVIEW_COMPLETE]';
        const isComplete = accumulated.includes(SENTINEL);
        const nextQuestion = accumulated.replace(SENTINEL, '').trim();
        dispatch({ type: 'TURN_SAVED', nextQuestion, isComplete, decisionState: null });
        speakQuestion(nextQuestion);
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

  // Camera request effect — runs once when session enters an active phase.
  // No cleanup return here: tracks are stopped by the unmount-only effect below,
  // so the cameraStreamRef.current guard is never invalidated by a phase change.
  useEffect(() => {
    if (state.phase === 'session_creating' || state.phase === 'session_error') return;
    if (cameraStreamRef.current) return; // already requested
    async function requestCamera() {
      try {
        if (!navigator.mediaDevices) return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = stream;
        setCameraGranted(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        // Denied or unavailable — silently show placeholder, interview continues
      }
    }
    requestCamera();
  }, [state.phase]);

  // Unmount-only cleanup: stops camera tracks exactly once when the component unmounts.
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  // callStartedAt effect — set once when session enters awaiting_recording.
  // Calling setCallStartedAt synchronously here is intentional: we need the
  // epoch to reach CallTimer on the same render that shows the active phase.
  useEffect(() => {
    if (state.phase !== 'awaiting_recording') return;
    if (callStartedAt !== null) return; // already set, prevent reset on re-renders
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCallStartedAt(Date.now());
  }, [state.phase, callStartedAt]);

  const handleRetryTurn = useCallback(() => {
    dispatch({ type: 'RETRY_TURN' });
  }, []);

  // ── Render: session_creating ─────────────────────────────────────────────────
  if (state.phase === 'session_creating') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        {SpinnerSvg}
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
      <div className="flex flex-col items-center justify-center flex-1">
        <p className="text-white">Interview complete.</p>
      </div>
    );
  }

  // ── Render: awaiting_recording | recording | processing | api_error ──────────
  return (
    <div className="flex flex-col flex-1">

      {/* Header bar */}
      <div className="bg-zinc-900 px-6 py-3 flex items-center justify-between">
        <span className="text-white font-semibold text-lg">{job.title}</span>
        <CallTimer startedAt={callStartedAt} />
      </div>

      {/* Tile grid */}
      <div className="grid md:grid-cols-2 grid-cols-1 gap-4 p-6">
        <VideoTile name="AI Interviewer" isActive={isAISpeaking}>
          {AIAvatarSvg}
        </VideoTile>
        <VideoTile name="You">
          {cameraGranted ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            UserSilhouetteSvg
          )}
        </VideoTile>
      </div>

      {/* Question panel */}
      <div className="bg-zinc-800 rounded-xl mx-6 p-4">
        <p className="text-zinc-400 text-xs mb-1">Current question</p>
        <p className="text-white font-medium">{state.currentQuestion}</p>
        {state.phase === 'recording' && state.interimTranscript && (
          <p className="text-zinc-400 italic text-sm mt-2">{state.interimTranscript}</p>
        )}
      </div>

      {/* Transcript */}
      <div className="mx-6 mt-4 mb-4">
        <TranscriptView turns={state.turns} variant="dark" />
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-6 py-6 mt-auto">
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
        {state.phase === 'processing' && (
          <div className="flex items-center gap-3">
            {SpinnerSvg}
            <span className="text-zinc-400">Thinking&hellip;</span>
          </div>
        )}
        {state.phase === 'api_error' && (
          <div className="bg-zinc-800 rounded-xl mx-6 p-4 w-full max-w-md">
            <p className="text-red-400 text-sm mb-2">{state.errorMessage}</p>
            <Button variant="secondary" onClick={handleRetryTurn}>Retry</Button>
          </div>
        )}
      </div>

    </div>
  );
}

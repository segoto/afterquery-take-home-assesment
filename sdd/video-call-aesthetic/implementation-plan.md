# Implementation Plan: Video Call Aesthetic

## Overview

Transform the interview room UI from a light card-based layout into a full-viewport dark video-call interface, adding webcam preview, AI avatar with speaking indicator, an elapsed-time timer, and circular call-action buttons — while leaving all audio logic, SpeechRecognition settings, API calls, and the `interviewReducer` untouched.

The approach creates three new reusable UI primitives (`VideoTile`, `CallTimer`, `IconButton`), updates two existing components (`TranscriptView`, `VoiceRecorder`) to support the new aesthetic, replaces the entire render layer of `InterviewRoom` with a dark layout, and adjusts the interview page wrapper — all tasks are pure frontend with no backend changes.

## Prerequisites

None. No migrations, env vars, or seed changes are required. All changes are purely frontend.

## Task Graph

| Task | Wave | Type     | Description                                              | Depends on       |
|------|------|----------|----------------------------------------------------------|------------------|
| T1   | 1    | frontend | Create `VideoTile` reusable UI primitive                 | —                |
| T2   | 1    | frontend | Create `CallTimer` reusable UI primitive                 | —                |
| T3   | 1    | frontend | Create `IconButton` reusable UI primitive                | —                |
| T4   | 1    | frontend | Add `variant` prop to `TranscriptView`                   | —                |
| T5   | 2    | frontend | Update `ui/index.ts` to export new primitives            | T1, T2, T3       |
| T6   | 2    | frontend | Refactor `VoiceRecorder` with Stop button and lifecycle  | T3               |
| T7   | 3    | frontend | Overhaul `InterviewRoom` with dark video-call layout     | T1, T2, T4, T5, T6 |
| T8   | 4    | frontend | Update interview page wrapper to full-viewport dark      | T7               |

Wave 1 tasks share no dependencies and run in parallel. Wave 2 starts when Wave 1 is complete. Wave 3 starts when Wave 2 is complete. Wave 4 starts when Wave 3 is complete.

## Task Details

---

### T1: Create `VideoTile` reusable UI primitive

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/VideoTile.tsx` — new file; the self-contained tile container for both AI and user participants

- **Implementation notes**:

  Add `'use client'` directive at the top.

  Props interface:
  ```ts
  interface VideoTileProps {
    name: string;
    isActive?: boolean;
    children: React.ReactNode;
  }
  ```

  Outer container: `relative bg-zinc-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center`.

  When `isActive === true`, render a sibling `div` (absolutely positioned, centred via `absolute inset-0 flex items-center justify-center pointer-events-none`) that contains an inner `div` with classes `animate-ping inline-flex h-24 w-24 rounded-full border-4 border-white opacity-30`. This ring element must have `aria-label="AI is speaking"` and `role="status"` so screen readers announce the speaking state. The `pointer-events-none` on the parent ensures the overlay never intercepts click events.

  Name label: `absolute bottom-2 left-2 text-white text-xs font-medium bg-black/50 rounded px-2 py-0.5`. Renders `{name}`.

  The `children` prop renders inside the outer container (the tile content: either a `<video>` element or an SVG avatar).

- **Testing**:
  - Unit: In a new file `src/__tests__/VideoTile.test.tsx`, verify: (1) renders `name` label text; (2) when `isActive={false}` (or omitted), the element with `aria-label="AI is speaking"` is not in the document; (3) when `isActive={true}`, the element with `aria-label="AI is speaking"` is in the document; (4) `children` is rendered inside the tile.
  - Integration: Covered by T7's InterviewRoom integration tests.
  - Manual: In the browser, open an interview session, confirm that the AI tile shows the pulsing white ring while TTS is speaking, and the ring disappears when TTS finishes.

---

### T2: Create `CallTimer` reusable UI primitive

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/CallTimer.tsx` — new file; a self-clocking elapsed-time display

- **Implementation notes**:

  Add `'use client'` directive at the top.

  Props interface:
  ```ts
  interface CallTimerProps {
    startedAt: number | null; // epoch ms, null before session is active
  }
  ```

  Internal state: `const [elapsed, setElapsed] = useState<number>(0)`.

  `useEffect` watching `startedAt`:
  - If `startedAt` is null, set `elapsed` to 0 and return (no interval).
  - Otherwise, immediately compute `setElapsed(Math.floor((Date.now() - startedAt) / 1000))`, then start a `setInterval` of 1000 ms that repeats the same computation.
  - Return a cleanup function that calls `clearInterval`.

  Format helpers (local constants, not extracted to lib):
  ```ts
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  const formatted = `${minutes}:${seconds}`;
  ```

  Render:
  ```tsx
  <time
    aria-label="Elapsed interview time"
    dateTime={formatted}
    className="text-zinc-400 text-sm font-mono"
  >
    {formatted}
  </time>
  ```

  When `startedAt` is null, `elapsed` stays 0, so the rendered output is `"00:00"`.

  The interval must live entirely inside `CallTimer` — do not move it to `InterviewRoom` — so that only the `<time>` element re-renders every second, not the entire interview room.

- **Testing**:
  - Unit: In a new file `src/__tests__/CallTimer.test.tsx`, use `jest.useFakeTimers()`. Verify: (1) when `startedAt={null}`, renders `"00:00"`; (2) when `startedAt` is set to `Date.now() - 65000`, renders `"01:05"` (or equivalent computed value after one tick); (3) the interval updates elapsed on each 1-second tick. Use `act` from `@testing-library/react` to advance fake timers. Restore real timers in `afterEach`.
  - Integration: Covered by T7 manual testing.
  - Manual: Open an interview session; confirm the timer shows `"00:00"` during the spinner phase and begins counting up in `MM:SS` format as soon as the question appears.

---

### T3: Create `IconButton` reusable UI primitive

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/ui/IconButton.tsx` — new file; a circular call-action button

- **Implementation notes**:

  Add `'use client'` directive at the top.

  Props interface:
  ```ts
  interface IconButtonProps {
    icon: React.ReactNode;
    label: string;
    variant?: 'mic' | 'stop' | 'default';
    disabled?: boolean;
    onClick?: () => void;
  }
  ```

  Base classes (always applied): `flex items-center justify-center rounded-full w-14 h-14 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950`.

  Variant classes:
  - `'mic'` and `'default'`: `bg-zinc-700 hover:bg-zinc-600 focus:ring-zinc-500 text-white`
  - `'stop'`: `bg-red-600 hover:bg-red-500 focus:ring-red-500 text-white`

  Disabled classes (appended when `disabled === true`): `opacity-50 cursor-not-allowed pointer-events-none`.

  Render:
  ```tsx
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={[base, variantClass, disabled ? disabledClass : ''].filter(Boolean).join(' ')}
  >
    {icon}
  </button>
  ```

  The `disabled` prop is passed to the native `<button>` element as well (in addition to the visual classes), so that `expect(button).toBeDisabled()` works in tests and screen readers announce the state correctly.

- **Testing**:
  - Unit: In a new file `src/__tests__/IconButton.test.tsx`, verify: (1) `aria-label` equals the `label` prop; (2) variant `'mic'` applies `bg-zinc-700`; (3) variant `'stop'` applies `bg-red-600`; (4) when `disabled={true}`, the button element has `disabled` attribute and `opacity-50` class; (5) `onClick` is called when clicked and not disabled; (6) `onClick` is not called when `disabled={true}` (pointer-events-none prevents click, but also verify `disabled` attribute blocks it).
  - Integration: Covered by T6 (VoiceRecorder) tests.
  - Manual: In the browser, confirm the mic button is circular/grey and the stop button is circular/red; tab-focus shows a visible ring on dark background.

---

### T4: Add `variant` prop to `TranscriptView`

- **Type**: frontend
- **Wave**: 1
- **Files to create or modify**:
  - `src/components/TranscriptView.tsx` — modify to accept `variant` prop

- **Implementation notes**:

  Update the props interface:
  ```ts
  interface TranscriptViewProps {
    turns: TranscriptTurn[];
    variant?: 'light' | 'dark'; // default: 'light'
  }
  ```

  Destructure with default: `{ turns, variant = 'light' }`.

  The turn content `<p>` currently renders `className="text-zinc-900 text-sm"`. Change to:
  ```ts
  const textClass = variant === 'dark' ? 'text-zinc-200 text-sm' : 'text-zinc-900 text-sm';
  ```
  Apply `textClass` as the `className` of each turn's content `<p>`.

  The empty-state `<p className="text-zinc-400 text-sm">The interview will appear here.</p>` is already `text-zinc-400` which is readable on both light and dark backgrounds — leave it unchanged.

  Badge rendering is unchanged for both variants (`Badge` component handles its own colours internally).

  All existing usages of `<TranscriptView turns={...} />` (without `variant`) continue to use the `'light'` default — no other call sites need updating.

- **Testing**:
  - Unit: In `src/__tests__/TranscriptView.test.tsx`, add two new tests: (1) when `variant="dark"`, the turn content `<p>` element has class `text-zinc-200`; (2) when `variant="light"` (or omitted), the turn content `<p>` element has class `text-zinc-900`. Keep all existing tests green — they do not pass `variant`, so they use the `'light'` default and remain unaffected.
  - Integration: Covered by T7 manual testing.
  - Manual: In the interview room, confirm transcript items show light-grey text on the dark background.

---

### T5: Update `ui/index.ts` to export new primitives

- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/components/ui/index.ts` — add three new named exports

- **Implementation notes**:

  Append to the existing exports:
  ```ts
  export { VideoTile } from './VideoTile';
  export { CallTimer } from './CallTimer';
  export { IconButton } from './IconButton';
  ```

  Preserve the existing four exports exactly as they are. Do not reorder or remove any existing export.

- **Testing**:
  - Unit: No dedicated test needed — import correctness is verified by TypeScript compilation and by T7's tests which import from `@/components/ui`.
  - Manual: Run `npx tsc --noEmit` and confirm zero type errors after this task.

---

### T6: Refactor `VoiceRecorder` with Stop button and lifecycle fixes

- **Type**: frontend
- **Wave**: 2
- **Files to create or modify**:
  - `src/components/VoiceRecorder.tsx` — significant modifications (Stop button, interim tracking ref, abort cleanup, dark styling, IconButton usage)
  - `src/__tests__/VoiceRecorder.test.tsx` — update existing tests and add new Stop button tests

- **Implementation notes**:

  **New imports**: Add `useEffect` to the React import. Add `IconButton` from `@/components/ui`. Remove the `Button` import (no longer used in VoiceRecorder).

  **New local state and refs** (add alongside existing `isRecording` and `recognitionRef`/`finalReceivedRef`):
  ```ts
  const [currentInterim, setCurrentInterim] = useState<string>('');
  const stopWithNoInterimRef = useRef<boolean>(false);
  ```

  **Unmount cleanup `useEffect`** (add after existing hooks):
  ```ts
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);
  ```
  This prevents `onend` from firing on an unmounted component when the phase changes and `VoiceRecorder` is removed from the tree mid-recording.

  **Update `recognition.onresult`** inside `handleStart`: in the `else` (interim) branch, after calling `props.onInterim(result[0].transcript)`, also call `setCurrentInterim(result[0].transcript)`. In the `isFinal` branch, after calling `props.onTranscript(...)`, reset `currentInterim` is not strictly required (onend resets it), but adding `setCurrentInterim('')` here is safe and makes the flow explicit.

  **Update `recognition.onend`**: change the guard from `!finalReceivedRef.current` to `!finalReceivedRef.current && !stopWithNoInterimRef.current`. After the guard check (regardless of whether onError was called), reset `stopWithNoInterimRef.current = false` and `setCurrentInterim('')`.

  Full updated `onend`:
  ```ts
  recognition.onend = () => {
    setIsRecording(false);
    if (!finalReceivedRef.current && !stopWithNoInterimRef.current) {
      props.onError('Recording ended without a result. Please try again.');
    }
    stopWithNoInterimRef.current = false;
    setCurrentInterim('');
  };
  ```

  **Add `handleStop` function** (defined after `handleStart` inside the component body):
  ```ts
  function handleStop() {
    if (finalReceivedRef.current) return; // already submitted, no-op
    if (currentInterim.trim().length > 0) {
      finalReceivedRef.current = true;
      props.onTranscript(currentInterim);
      recognitionRef.current?.stop();
    } else {
      stopWithNoInterimRef.current = true;
      props.onError('Please say something before submitting.');
      recognitionRef.current?.stop();
    }
  }
  ```

  **Inline SVG definitions** (define as local constants at module scope, outside the component function, for referential stability):

  `MicSvg` — recognisable microphone shape inline SVG, `aria-hidden="true"`, width/height 24:
  ```tsx
  const MicSvg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width="24"
      height="24"
      aria-hidden="true"
    >
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.92V21h3v2H8v-2h3v-2.08A7 7 0 0 1 5 12z" />
    </svg>
  );
  ```

  `StopSvg` — filled square representing "stop":
  ```tsx
  const StopSvg = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width="24"
      height="24"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
  ```

  **Updated render** (replace the existing `return` block for the supported-browser case):
  ```tsx
  return (
    <div className="flex items-center gap-4">
      <IconButton
        variant="mic"
        label="Start recording"
        icon={MicSvg}
        disabled={props.disabled || isRecording}
        onClick={handleStart}
      />
      {isRecording && (
        <IconButton
          variant="stop"
          label="Stop recording"
          icon={StopSvg}
          onClick={handleStop}
        />
      )}
    </div>
  );
  ```

  **Updated unsupported-browser render** (replace the existing `role="alert"` div):
  ```tsx
  return (
    <div
      role="alert"
      className="bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-xl p-4"
    >
      Voice interviews require Chrome or Edge. Please switch browsers to continue.
    </div>
  );
  ```

  **`src/__tests__/VoiceRecorder.test.tsx` updates**:

  The existing `MockSpeechRecognition` class needs `abort = jest.fn()` added alongside `start` and `stop`.

  Existing tests remain valid because `aria-label="Start recording"` is still present on the Start `IconButton` (queried via `{ name: /start recording/i }`), and the start button is still native-disabled when `props.disabled=true` (IconButton passes `disabled` to the `<button>` element).

  Add these new test cases to the existing `describe('VoiceRecorder')` block:

  1. **Stop button absent before recording starts**: render with SpeechRecognition available, assert `queryByRole('button', { name: /stop recording/i })` is null.
  2. **Stop button appears when recording is active**: click Start to trigger `handleStart`, then assert Stop button is in the document.
  3. **Stop with non-empty interim submits interim as transcript**: simulate a `recognition.onresult` event with `isFinal=false` (interim) text, click Stop, assert `props.onTranscript` called with the interim text and `props.onError` not called.
  4. **Stop with empty interim calls onError**: click Start, do not fire any `onresult` event, click Stop, assert `props.onError` called with `'Please say something before submitting.'`.
  5. **onend does not call onError when stopWithNoInterimRef is set**: click Start, click Stop with empty interim (sets `stopWithNoInterimRef`), fire `recognition.onend`, assert `props.onError` was called exactly once (by handleStop directly) and not again by `onend`.

- **Testing**:
  - Unit: As described above in implementation notes.
  - Integration: Covered by T7.
  - Manual: In the browser, start recording, say a few words, click Stop — confirm the answer is submitted. Start recording without speaking, click Stop — confirm error message "Please say something before submitting." appears.

---

### T7: Overhaul `InterviewRoom` with dark video-call layout

- **Type**: frontend
- **Wave**: 3
- **Files to create or modify**:
  - `src/components/InterviewRoom.tsx` — extensive changes to the UI render layer; `interviewReducer` function body and all its `case` branches must not change
  - `src/__tests__/InterviewRoom.test.tsx` — update mocks and add tests for new layout states

- **Implementation notes**:

  **Import changes**: Add `useState, useRef` to the React import (already has `useReducer, useEffect, useCallback`). Add `VideoTile, CallTimer` to the `@/components/ui` import (keep `Button`; `Card` is no longer used in active phases but keep it for now or remove if all usages are replaced). Import `TranscriptView` remains unchanged.

  **New component-level state** (add after the `useReducer` call — these are NOT reducer fields):
  ```ts
  const [isAISpeaking, setIsAISpeaking] = useState<boolean>(false);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [cameraGranted, setCameraGranted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  ```

  **Update `speakQuestion`** (add `utterance.onstart`/`utterance.onend` callbacks; do not change what is spoken, the TTS invocation, or the existing guard):
  ```ts
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
  ```

  **Camera `useEffect`** (add after the existing session-creation and turn-submission effects):
  ```ts
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
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  ```

  Note: The cleanup stops tracks on unmount. The `cameraStreamRef.current` guard prevents double-requesting. The `videoRef` assignment inside the async callback is safe because by the time `getUserMedia` resolves, the component may have re-rendered but `videoRef.current` still points to the video element (refs are stable).

  **`callStartedAt` `useEffect`** (add as a separate effect):
  ```ts
  useEffect(() => {
    if (state.phase !== 'awaiting_recording') return;
    if (callStartedAt !== null) return; // already set, prevent reset on re-renders
    setCallStartedAt(Date.now());
  }, [state.phase, callStartedAt]);
  ```

  **AI avatar SVG** (define as a module-level constant outside the component function):
  ```tsx
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
  ```

  **User silhouette SVG** (define as a module-level constant):
  ```tsx
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
  ```

  **Spinner SVG** (define as a module-level constant, reused in session_creating and processing states):
  ```tsx
  const SpinnerSvg = (
    <svg
      className="h-8 w-8 animate-spin text-zinc-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
  ```

  **Updated render phases**:

  *`session_creating`*:
  ```tsx
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4">
      {SpinnerSvg}
      <p className="text-zinc-500 text-sm">Starting your interview&hellip;</p>
    </div>
  );
  ```
  (The `flex-1` allows this to fill the flex column of the dark `<main>` from T8.)

  *`session_error`*:
  ```tsx
  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <div className="bg-zinc-800 rounded-xl p-6">
        <p className="text-red-400 text-sm mb-4">{state.errorMessage}</p>
        <Button onClick={() => dispatch({ type: 'RETRY_SESSION' })}>Retry</Button>
      </div>
    </div>
  );
  ```

  *`complete`*:
  ```tsx
  return (
    <div className="flex flex-col items-center justify-center flex-1">
      <p className="text-white">Interview complete.</p>
    </div>
  );
  ```

  *Active phases (`awaiting_recording | recording | processing | api_error`)*:
  ```tsx
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
  ```

  **Constraint reminder**: The `interviewReducer` function and all its `switch` cases must remain exactly as they are. Only the component body's local state, effects, `speakQuestion`, and the render return blocks change.

  **`src/__tests__/InterviewRoom.test.tsx` updates**:

  1. Update the `SpeechSynthesisUtterance` mock to support `onstart` and `onend` properties:
     ```ts
     Object.defineProperty(window, 'SpeechSynthesisUtterance', {
       value: class MockSpeechSynthesisUtterance {
         text: string;
         onstart: (() => void) | null = null;
         onend: (() => void) | null = null;
         constructor(text: string) { this.text = text; }
       },
       writable: true,
       configurable: true,
     });
     ```

  2. Mock `navigator.mediaDevices` to return a rejected promise (simulating denial) so the camera effect is exercised without jsdom failing. Add to `beforeEach`:
     ```ts
     Object.defineProperty(navigator, 'mediaDevices', {
       value: { getUserMedia: jest.fn().mockRejectedValue(new DOMException('Permission denied')) },
       writable: true,
       configurable: true,
     });
     ```

  3. All existing test cases must remain green — verify text expectations still hold:
     - `"Starting your interview…"` text still appears in `session_creating`.
     - `"Thinking…"` text still appears in `processing` phase (note: it is now inside `<span>` not `<p>`, but the text node content is the same and `getByText` matches).
     - `"Interview complete."` text still appears in `complete` phase.
     - The Retry button is still rendered in `session_error`.
     - The INITIAL_QUESTION text appears after session creation.

  4. Add a new test verifying that the job title appears in the header bar after session creation:
     ```ts
     it('renders job title in header bar after session creation', async () => { ... });
     ```

  5. Add a test verifying `CallTimer` renders `"00:00"` initially (before session creation completes) and that the element with `aria-label="Elapsed interview time"` is present after session creation.

- **Testing**:
  - Unit: As described above.
  - Integration: Run `npm test` to confirm all existing tests plus new tests pass.
  - Manual: Complete end-to-end check: dark background visible, tiles side-by-side on desktop, AI ring animates during TTS, timer counts up, Stop button appears during recording, clicking Stop submits partial transcript.

---

### T8: Update interview page wrapper to full-viewport dark layout

- **Type**: frontend
- **Wave**: 4
- **Files to create or modify**:
  - `src/app/interview/[jobId]/page.tsx` — change `<main>` classes and remove `<h1>` element

- **Implementation notes**:

  The page is a React Server Component. No `'use client'` directive needed.

  **Change the `<main>` element classes** from:
  ```
  flex min-h-screen flex-col p-8 max-w-2xl mx-auto
  ```
  to:
  ```
  min-h-screen bg-zinc-950 text-white flex flex-col
  ```
  This removes the padding, max-width constraint, and margin, making the page full-viewport and dark for the interview experience.

  **Remove the `<h1>` element** (`{job.title} Interview`) entirely from the page. The job title is now rendered inside `InterviewRoom`'s header bar (implemented in T7). If the `<h1>` remains, the title would appear twice.

  **Keep the error/not-found branches unchanged** (the `prisma.job.findUnique` failure and the `!job` guard). These branches do not render `InterviewRoom` and are outside the scope of the video-call aesthetic. Their existing `<main>` class (`flex min-h-screen flex-col items-center justify-center p-8`) and link elements are left as-is.

  **The page after changes**:
  ```tsx
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <InterviewRoom job={jobForClient} />
    </main>
  );
  ```

  The `<InterviewRoom>` component renders a `flex flex-col flex-1` container for the active UI, so it fills the remaining space inside the flex-column `<main>`.

- **Testing**:
  - Unit: No server-component unit test is needed — the page is a thin wrapper. The existing `InterviewRoom` tests exercise the component in isolation.
  - Integration: Run `npm run build` to verify no TypeScript or compilation errors introduced by removing the `<h1>` and changing the `<main>` class.
  - Manual: Navigate to `/interview/[any-job-id]`; confirm: (1) the entire viewport is `bg-zinc-950` dark grey with no white flash; (2) the `max-w-2xl` centred card is gone; (3) no `<h1>` heading above the interview tiles; (4) the job title appears inside the header bar rendered by `InterviewRoom`.

---

## Data migrations

No Prisma schema changes required. No migration command to run.

## API documentation updates

No new or changed API endpoints. `docs/openapi.yaml` does not need updating.

## Cross-cutting concerns

- **SVG icons** (`MicSvg`, `StopSvg`, `AIAvatarSvg`, `UserSilhouetteSvg`, `SpinnerSvg`): defined as module-level constants (JSX, not components) in the files that use them (`VoiceRecorder.tsx` for Mic/Stop; `InterviewRoom.tsx` for AI avatar, silhouette, and spinner). They are not shared across files — each file owns its own SVG constants. No extraction to a shared icon library is needed.
- **`cameraStreamRef` vs `cameraGranted`**: The stream ref (`useRef`) tracks the live `MediaStream` object for cleanup; the `cameraGranted` state (`useState`) triggers a re-render so the `<video>` element is mounted before `srcObject` is assigned. Both are necessary. The `videoRef` (`useRef`) points to the `<video>` DOM element and is used in the async callback of `getUserMedia` to assign `srcObject`.
- **`interviewReducer` immutability**: The reducer function, its type signatures (`InterviewRoomState`, `InterviewRoomAction` from `@/types`), and all `case` branches must not be modified. All new state lives in `useState` hooks inside the component body.
- **Tailwind dark-mode classes**: This feature uses explicit dark-coloured class names (e.g., `bg-zinc-950`, `bg-zinc-800`) rather than Tailwind's `dark:` variant, since the interview page is intentionally always dark regardless of system preference.

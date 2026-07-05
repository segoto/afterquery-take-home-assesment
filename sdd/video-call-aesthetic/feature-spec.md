# Feature Spec: Video Call Aesthetic

## Overview

Transform the interview room from a plain form-like layout into a video-call-style interface that feels like a real face-to-face interview. The user sees two participant tiles (one for themselves showing a live webcam preview, one for the AI interviewer showing an avatar), an elapsed-time timer, a question/transcript panel, and prominent call-action buttons for starting and stopping voice capture. All audio logic (SpeechRecognition / SpeechSynthesis) remains unchanged; only the visual layer is replaced.

## Scope

**Included:**
- Full-viewport dark video-call layout replacing the current light card layout
- Live webcam preview tile (video only, no audio capture, nothing stored)
- Camera permission denial graceful fallback (placeholder avatar)
- AI avatar tile with animated speaking indicator driven by SpeechSynthesis events
- Elapsed interview timer (MM:SS) counting from session creation
- Participant name labels on each tile
- Start Recording button restyled as a circular call-action mic `IconButton`
- Explicit Stop Recording button (circular red `IconButton`) rendered by `VoiceRecorder` during recording phase, submitting interim transcript when available
- Dark-themed question panel, transcript panel, and error/processing states
- Three new reusable UI primitives: `VideoTile`, `CallTimer`, `IconButton`
- `TranscriptView` gains a `variant` prop (`'light' | 'dark'`) for dark-mode support
- Updated `VoiceRecorder` to render both Start and Stop buttons and handle explicit stop with interim-transcript submission
- Updated interview page wrapper to support full-viewport dark layout
- Adding `utterance.onstart` and `utterance.onend` lifecycle callbacks to `speakQuestion` solely for driving the AI tile speaking animation (does not alter what is spoken, the TTS invocation sequence, recognition settings, or the API call flow)

**Explicitly OUT of scope:**
- Recording, transmitting, or storing any video data
- Changing SpeechRecognition settings (`continuous`, `interimResults`, `lang`), what is spoken via TTS, or the AI prompting / API layers
- Adding new backend endpoints or Prisma schema changes
- Picture-in-picture mode, screen sharing, or multi-participant tiles beyond two
- Results page or any page other than `/interview/[jobId]`

## User Stories

- As a candidate, I want to see my own webcam feed during the interview so that I feel I am in a real video call.
- As a candidate, I want the interface to still function if I deny camera access so that I can complete the interview without a webcam.
- As a candidate, I want to see a visual indicator on the AI tile when the AI is speaking so that I know when to listen.
- As a candidate, I want to see elapsed interview time so that I can pace my answers.
- As a candidate, I want a clearly labelled Stop button during recording so that I can explicitly end my answer rather than waiting for silence detection.
- As a candidate, I want my partial speech to be submitted when I click Stop (if any was detected) so that short answers are not lost.
- As a candidate, I want the Start button to look like a call-action mic button so that the interaction model is clear.
- As a candidate, I want name labels on both tiles so that I can easily identify the AI and myself.
- As a candidate, I want processing and error states styled consistently with the dark layout so that there are no jarring light flashes.

## Functional Requirements

1. The interview page (`/interview/[jobId]`) must render a full-viewport dark background (`bg-zinc-950`) that removes the existing light container and max-width constraint on the main element for this page only.

2. The `InterviewRoom` component must render a two-column video tile grid containing an AI tile on the left and a user camera tile on the right, each occupying equal width on desktop (at or above the `md` breakpoint, 768 px) and stacking vertically (AI above user) on mobile (below `md`).

3. The user camera tile must request webcam access via `navigator.mediaDevices.getUserMedia({ video: true, audio: false })` inside a `useEffect` in `InterviewRoom` that runs once when the session first enters an active phase (any phase other than `session_creating`). Audio must not be captured.

4. The camera stream must be assigned to a `<video>` element's `srcObject` property with the `autoPlay`, `playsInline`, and `muted` HTML attributes set. The `useEffect` that requests the camera must clean up by calling `track.stop()` on every track of the stream when the component unmounts.

5. If `navigator.mediaDevices` is undefined, or if `getUserMedia` rejects for any reason (including user denial), the user tile must silently display a grey placeholder containing a centred silhouette SVG avatar icon. No error message is shown to the user for camera issues. The interview continues normally.

6. The AI tile must display a static circular avatar using an inline SVG (robot or person outline), centred within the tile. No external image assets are used.

7. When the AI is speaking (a `SpeechSynthesisUtterance` is active), the AI tile must display an animated pulsing ring around the avatar to indicate activity. The ring animation must stop when the utterance's `onend` event fires.

8. Each tile must show a name label overlaid at the bottom of the tile: `"AI Interviewer"` for the AI tile and `"You"` for the user tile. The label must have white or near-white text on a semi-transparent black scrim (`bg-black/50`) to meet WCAG AA contrast requirements.

9. A `CallTimer` component must be displayed in the interview header bar. It must start counting from zero when `SESSION_CREATED` is dispatched (i.e., the session enters `awaiting_recording`) and display elapsed time formatted as `MM:SS`. The timer must use a 1-second `setInterval` internally and must clear the interval on unmount.

10. The header bar must display the job title left-aligned and the `CallTimer` right-aligned, on a `bg-zinc-900` row spanning the full width of the interview layout, with `px-6 py-3` padding.

11. The current AI question must be displayed in a dark panel (`bg-zinc-800 rounded-xl mx-6 p-4`) below the tile grid. The panel shows a label `"Current question"` in `text-zinc-400 text-xs mb-1` and the question text in `text-white font-medium`. While `phase === 'recording'`, the latest interim transcript must appear below the question text in `text-zinc-400 italic text-sm mt-2`.

12. The transcript history (`TranscriptView`) must be displayed below the question panel with a `mx-6 mt-4` wrapper. `TranscriptView` must be rendered with `variant="dark"` so its text colours are appropriate for the dark background.

13. A call-controls bar must be rendered at the bottom of the layout as a `flex items-center justify-center gap-6 py-6` row. When `phase === 'awaiting_recording'` or `phase === 'recording'`, the bar renders the `<VoiceRecorder>` component, which is responsible for rendering both the Start and Stop `IconButton` elements. When `phase === 'processing'`, the bar renders a spinner and "Thinking…" text instead. When `phase === 'api_error'`, the bar renders an error panel (see FR 22) instead. `InterviewRoom` does not render standalone Start or Stop buttons outside of `VoiceRecorder` in any phase.

14. The `VoiceRecorder` component must render a Start `IconButton` (variant `'mic'`) that is enabled only when `props.disabled === false` and `isRecording === false`. The button must have `aria-label="Start recording"`. Within `VoiceRecorder`, the Start button must always be rendered (never conditionally omitted) so that the controls bar maintains a consistent layout whenever `VoiceRecorder` is mounted. Note: `VoiceRecorder` itself is only mounted in `awaiting_recording` and `recording` phases (see UI Behaviour); the "always rendered" constraint applies within those phases.

15. The `VoiceRecorder` component must render a Stop `IconButton` (variant `'stop'`) that is visible and clickable only when `isRecording === true`. When `isRecording === false`, the Stop button must not be rendered (conditionally absent, not merely disabled), so the controls bar does not show it at rest.

16. When the Stop `IconButton` is clicked while `isRecording === true`:
    a. If `currentInterim` (see FR 17) is non-empty and `finalReceivedRef.current === false`: set `finalReceivedRef.current = true`, call `props.onTranscript(currentInterim)`, then call `recognitionRef.current.stop()`.
    b. If `currentInterim` is empty and `finalReceivedRef.current === false`: set `stopWithNoInterimRef.current = true` (see FR 17b), call `props.onError("Please say something before submitting.")` immediately, then call `recognitionRef.current.stop()`. This direct call to `props.onError` ensures the correct message is delivered before `onend` fires.
    c. If `finalReceivedRef.current === true` (a final result was already received): clicking Stop is a no-op.

17. `VoiceRecorder` must maintain the following local state and refs in addition to the existing ones:
    a. `currentInterim` — `useState<string>('')`. Updated to the latest interim text inside `recognition.onresult` (alongside the existing `props.onInterim` call) and reset to `''` inside `recognition.onend`.
    b. `stopWithNoInterimRef` — `useRef<boolean>(false)`. Set to `true` in FR 16(b) before calling `recognition.stop()`. The `onend` handler must guard its own `props.onError` call: only call `props.onError("Recording ended without a result. Please try again.")` when BOTH `!finalReceivedRef.current` AND `!stopWithNoInterimRef.current` are true. Reset `stopWithNoInterimRef.current = false` inside `onend` after the guard check.

18. `VoiceRecorder` must add a `useEffect` that returns a cleanup function calling `recognitionRef.current?.abort()` when the component unmounts. This cancels any in-flight recognition without triggering the `onend` error path.

19. `TranscriptView` must accept a new optional prop `variant?: 'light' | 'dark'` defaulting to `'light'`. When `variant === 'dark'`, transcript item text renders as `text-zinc-200 text-sm` (instead of `text-zinc-900 text-sm`). Badge components remain unchanged regardless of variant.

20. The unsupported browser warning rendered by `VoiceRecorder` must be restyled to `bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-xl p-4` while retaining its `role="alert"` accessibility attribute and its text content.

21. Processing state (`phase === 'processing'`) in the controls bar area must display an animate-spin SVG spinner alongside the text `"Thinking…"` in `text-zinc-400`. Because `VoiceRecorder` is not mounted during this phase (see FR 13), neither the Start nor the Stop `IconButton` is rendered.

22. API error state (`phase === 'api_error'`) must display a dark panel (`bg-zinc-800 rounded-xl mx-6 p-4`) with the error message in `text-red-400 text-sm mb-2` and a Retry button using the existing `Button` primitive (variant `'secondary'`).

23. Session error state (`phase === 'session_error'`) must render a dark centred card (`bg-zinc-800 rounded-xl p-6`) with error text (`text-red-400`) and a Retry button. Session-creating state must show a centred spinner with text `"Starting your interview…"` in `text-zinc-400` on the dark background.

24. Complete state (`phase === 'complete'`) must display the text `"Interview complete."` in `text-white` centred on the dark background, consistent with the overall dark layout.

25. Three new reusable primitives must be created in `src/components/ui/`:
    a. **`VideoTile`** — Props: `name: string`, `isActive?: boolean`, `children: React.ReactNode`. Renders a `relative bg-zinc-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center` container. When `isActive === true`, renders an `animate-ping` border ring around the children. Name label: `absolute bottom-2 left-2 text-white text-xs font-medium bg-black/50 rounded px-2 py-0.5`. Requires `'use client'` directive.
    b. **`CallTimer`** — Props: `startedAt: number | null`. Renders a `<time>` element with `aria-label="Elapsed interview time"` and `dateTime={formattedString}`. Uses a 1-second `setInterval` in `useEffect`. When `startedAt` is null, displays `"00:00"`. Displays elapsed seconds formatted as `MM:SS`. Requires `'use client'` directive.
    c. **`IconButton`** — Props: `icon: React.ReactNode`, `label: string`, `variant?: 'mic' | 'stop' | 'default'` (default: `'default'`), `disabled?: boolean`, `onClick?: () => void`. Renders `<button type="button" aria-label={label}>`. Base: `flex items-center justify-center rounded-full w-14 h-14 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950`. `mic`/`default` variant: `bg-zinc-700 hover:bg-zinc-600 focus:ring-zinc-500 text-white`. `stop` variant: `bg-red-600 hover:bg-red-500 focus:ring-red-500 text-white`. Disabled: `opacity-50 cursor-not-allowed pointer-events-none`. Requires `'use client'` directive.

26. `src/components/ui/index.ts` must be updated to export `VideoTile`, `CallTimer`, and `IconButton`.

27. `isAISpeaking` must be a `useState<boolean>(false)` in `InterviewRoom` (not a reducer action or state field). The `speakQuestion` function must attach `utterance.onstart = () => setIsAISpeaking(true)` and `utterance.onend = () => setIsAISpeaking(false)` on the `SpeechSynthesisUtterance` instance before calling `window.speechSynthesis.speak(utterance)`.

28. `callStartedAt` must be a `useState<number | null>(null)` in `InterviewRoom` (not a `useRef`). Using `useState` ensures that `InterviewRoom` re-renders when the epoch is set, immediately propagating it to `CallTimer`. A `useEffect` watching `state.phase` must call `setCallStartedAt(Date.now())` exactly once when `state.phase === 'awaiting_recording'` is first observed (guard: `if (callStartedAt !== null) return`). This value is passed as `startedAt` to the `CallTimer` component.

29. The microphone icon used in the Start `IconButton` must be an inline SVG (no external library). It must be a recognisable microphone shape. The stop icon used in the Stop `IconButton` must be an inline SVG filled square (representing "stop recording").

30. The `InterviewRoom` component must pass `disabled={state.phase !== 'awaiting_recording'}` to `VoiceRecorder`. This single prop controls Start button enable/disable. No additional props are added to `VoiceRecorder`.

## Non-Functional Requirements

- **Performance**: The camera `useEffect` must use a ref or guard so the stream is requested at most once per component lifecycle. The `CallTimer`'s `setInterval` must run inside `CallTimer` itself (not in `InterviewRoom`) to avoid re-rendering the parent every second.
- **Security**: No video frames, video data, or audio data may be sent to any server. `getUserMedia` constraints must be exactly `{ video: true, audio: false }`.
- **Browser support**: SpeechRecognition remains Chrome/Edge only (existing constraint, existing warning preserved). `getUserMedia` is supported in all modern evergreen browsers; denial or unavailability must degrade silently. The dark layout must render correctly in all evergreen browsers (Chrome, Edge, Firefox, Safari).
- **Accessibility**: All interactive controls must have `aria-label` attributes. The pulsing speaking ring on the AI tile must include `aria-label="AI is speaking"` or an equivalent `aria-live` region. The elapsed timer `<time>` element must have `aria-label="Elapsed interview time"`. The `role="alert"` on the unsupported browser message must be preserved. Colour contrast for overlay label text must meet WCAG AA (4.5:1 ratio minimum).
- **Responsive design**: The tile grid uses `grid-cols-2` at `md+` and `grid-cols-1` below `md`. The controls bar and header must be legible and tappable on mobile viewports (minimum 44 × 44 px touch target for `IconButton` at `w-14 h-14`).

## Data Model Changes

No data model changes required.

## API Contracts

No new or modified API endpoints.

## UI Behaviour

### Interview Page (`/interview/[jobId]`)
- The `<main>` element's classes must change to `min-h-screen bg-zinc-950 text-white flex flex-col` (remove existing `p-8 max-w-2xl mx-auto`). No `<h1>` heading is rendered by the page — the job title moves into `InterviewRoom`'s header bar.
- `<InterviewRoom job={jobForClient} />` fills the remaining area.

### InterviewRoom — video-call layout (active phases: `awaiting_recording`, `recording`, `processing`, `api_error`)

**Header bar** (`bg-zinc-900 px-6 py-3 flex items-center justify-between`):
- Left: job title `text-white font-semibold text-lg`
- Right: `<CallTimer startedAt={callStartedAt} />`

**Tile grid** (`grid md:grid-cols-2 grid-cols-1 gap-4 p-6`):
- Left/top: `<VideoTile name="AI Interviewer" isActive={isAISpeaking}>` containing inline SVG avatar
- Right/bottom: `<VideoTile name="You">` containing `<video>` (camera granted) or silhouette SVG (camera denied/unavailable)

**Question panel** (`bg-zinc-800 rounded-xl mx-6 p-4`):
- `"Current question"` label: `text-zinc-400 text-xs mb-1`
- Question text: `text-white font-medium`
- Interim transcript (when `phase === 'recording'` and `state.interimTranscript` is non-empty): `text-zinc-400 italic text-sm mt-2`

**Transcript section** (`mx-6 mt-4 mb-4`):
- `<TranscriptView turns={state.turns} variant="dark" />`

**Controls bar** (`flex items-center justify-center gap-6 py-6`):
- When `phase === 'awaiting_recording'` or `phase === 'recording'`: renders `<VoiceRecorder disabled={...} onStart={...} onInterim={...} onTranscript={...} onError={...} />`
- When `phase === 'processing'`: renders spinner + `"Thinking…"` text, no `VoiceRecorder`
- When `phase === 'api_error'`: renders error panel (see FR 22), no `VoiceRecorder`

**API error panel** (rendered above or in place of controls bar when `phase === 'api_error'`):
- `bg-zinc-800 rounded-xl mx-6 p-4`
- Error message: `text-red-400 text-sm mb-2`
- `<Button variant="secondary" onClick={handleRetryTurn}>Retry</Button>`

### VideoTile (reusable primitive)

Outer div: `relative bg-zinc-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center`

When `isActive === true`, wrap children in a container that also renders a sibling `div` with classes `animate-ping absolute inline-flex h-24 w-24 rounded-full border-4 border-white opacity-30` (or similar, centred absolutely). The ping animation constitutes the speaking indicator. The ring element must have `aria-label="AI is speaking"`.

Name label: `absolute bottom-2 left-2 text-white text-xs font-medium bg-black/50 rounded px-2 py-0.5` — renders `{name}`.

### CallTimer (reusable primitive)

Tracks elapsed seconds since `startedAt` (epoch ms). On each tick: `elapsed = Math.floor((Date.now() - startedAt) / 1000)`. Formats as `MM:SS` where MM = `String(Math.floor(elapsed / 60)).padStart(2, '0')` and SS = `String(elapsed % 60).padStart(2, '0')`. Renders `<time aria-label="Elapsed interview time" dateTime={formatted} className="text-zinc-400 text-sm font-mono">{formatted}</time>`.

### IconButton (reusable primitive)

```
<button
  type="button"
  aria-label={label}
  disabled={disabled}
  onClick={onClick}
  className={[base, variantClass, disabled ? disabledClass : ''].join(' ')}
>
  {icon}
</button>
```

### VoiceRecorder (modified)

Renders a `<div className="flex items-center gap-4">` containing:
1. Always: Start `<IconButton variant="mic" label="Start recording" icon={<MicSvg />} disabled={props.disabled || isRecording} onClick={handleStart} />`
2. Conditionally (when `isRecording === true`): Stop `<IconButton variant="stop" label="Stop recording" icon={<StopSvg />} onClick={handleStop} />`

When `isRecording === true`, an `animate-pulse` red dot indicator may optionally be rendered for visual feedback (non-required, implementer discretion).

Unsupported browser state: `<div role="alert" className="bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-xl p-4">Voice interviews require Chrome or Edge. Please switch browsers to continue.</div>`

### TranscriptView (modified)

When `variant === 'dark'`: each turn's content `<p>` renders as `text-zinc-200 text-sm`. When `variant === 'light'` (default): unchanged (`text-zinc-900 text-sm`). Badge rendering is unchanged for both variants.

### Loading states

- **`session_creating`**: full dark screen, spinner (`animate-spin text-zinc-400 h-8 w-8`) + `"Starting your interview…"` in `text-zinc-500 text-sm`, both vertically and horizontally centred.
- **`session_error`**: full dark screen, centred `bg-zinc-800 rounded-xl p-6` with `text-red-400 text-sm mb-4` error text and `<Button onClick={...}>Retry</Button>`.
- **`complete`**: full dark screen, `"Interview complete."` in `text-white` centred.

## Edge Cases & Error Handling

1. **Camera denied or unavailable**: Catch `getUserMedia` rejection and `navigator.mediaDevices` absence. Set a `cameraGranted` state to `false`. Do not show any error. Render the silhouette SVG placeholder in the user tile. Interview flow continues unaffected.
2. **Camera stream active during unmount**: The `useEffect` cleanup calls `track.stop()` on all tracks in the obtained stream. If no stream was obtained (denial case), the cleanup is a no-op.
3. **SpeechSynthesis unavailable**: The existing `if (!window.speechSynthesis) return` guard in `speakQuestion` prevents utterance creation. `isAISpeaking` stays `false`; the AI avatar ring never animates. No visible error. Because `callStartedAt` is `useState` (not `useRef`), the `setCallStartedAt(Date.now())` call in the `useEffect` triggers a re-render of `InterviewRoom` regardless of TTS availability, ensuring `CallTimer` receives the epoch and starts counting when the session enters `awaiting_recording`. The timer is not dependent on TTS being available.
4. **Stop clicked after SpeechRecognition already fired a final result** (`finalReceivedRef.current === true`): The stop handler is a no-op (guarded by the check in FR 16c). No double-submission.
5. **`callStartedAt` useState guard**: The `useEffect` that calls `setCallStartedAt(Date.now())` must guard with `if (callStartedAt !== null) return` to prevent the epoch from resetting on re-renders when the phase is already `awaiting_recording`. Because `callStartedAt` is `useState`, its value (not `.current`) is read directly in the guard.
6. **VoiceRecorder unmount during active recognition**: The `useEffect` cleanup in `VoiceRecorder` calls `recognitionRef.current?.abort()`, which cancels recognition without triggering `onend`'s error path.
7. **Interim text accumulated before stop**: `currentInterim` (FR 17) is maintained inside `VoiceRecorder`'s local state and is guaranteed to reflect the latest `onresult` interim value. Even a single-word interim is accepted (no minimum length).
8. **Phase transitions during recording**: If a phase transition somehow occurs while recording (e.g., forced retry), `VoiceRecorder` may unmount and the abort cleanup (FR 18) handles recognition cancellation.
9. **Tile layout overflow on small screens**: `overflow-hidden` on `VideoTile` prevents the `<video>` element from breaking the grid layout. The `aspect-video` utility maintains the 16:9 ratio regardless of container width.
10. **Camera `useEffect` runs only once**: A `cameraGranted` or `streamRef` guard prevents re-requesting the camera on subsequent re-renders after the stream is obtained.

## Acceptance Criteria

- [ ] The interview page renders with a full-viewport `bg-zinc-950` dark background and no visible max-width constraint or white container.
- [ ] Two `VideoTile` components appear side-by-side on desktop (`md+`) and stack vertically on mobile.
- [ ] The user `VideoTile` shows a live `<video>` feed when camera permission is granted.
- [ ] The user `VideoTile` shows a silhouette SVG placeholder when camera is denied or unavailable — no error message is shown.
- [ ] The AI `VideoTile` shows a static SVG avatar when TTS is idle.
- [ ] The AI `VideoTile` shows a pulsing animated ring when TTS is active (`isAISpeaking === true`).
- [ ] Both tiles display a name label (`"AI Interviewer"` and `"You"`) overlaid at the tile bottom.
- [ ] `CallTimer` displays `"00:00"` before session creation and counts up in `MM:SS` once the session is active.
- [ ] The job title is visible in the header bar alongside the timer.
- [ ] The current question renders in a dark panel (`bg-zinc-800`) below the tile grid.
- [ ] Interim transcript text appears below the question while `phase === 'recording'`.
- [ ] Transcript history renders with `variant="dark"` (light-coloured text on dark background).
- [ ] The Start `IconButton` (mic variant) is always visible when `VoiceRecorder` is rendered (i.e., during `awaiting_recording` and `recording` phases) but is enabled (clickable) only in the `awaiting_recording` phase; it is disabled (not clickable) during `recording`.
- [ ] The Stop `IconButton` (stop/red variant) is visible only in the `recording` phase.
- [ ] Clicking Stop when interim transcript is non-empty submits the interim text as the final answer, advances the turn, and the phase moves to `processing`.
- [ ] Clicking Stop when interim transcript is empty triggers `onError("Please say something before submitting.")`.
- [ ] Processing phase renders spinner + `"Thinking…"` text with no Start/Stop buttons shown.
- [ ] API error phase renders a dark error panel with `text-red-400` message and a functional Retry button.
- [ ] `VideoTile`, `CallTimer`, and `IconButton` are exported from `src/components/ui/index.ts`.
- [ ] No video or audio data is sent to any API endpoint (verifiable by inspecting network requests).
- [ ] Camera stream is fully stopped on component unmount (no lingering `MediaStreamTrack` objects).
- [ ] All interactive buttons have `aria-label` attributes.
- [ ] AI speaking ring element has `aria-label="AI is speaking"`.
- [ ] Elapsed timer `<time>` element has `aria-label="Elapsed interview time"`.
- [ ] The `interviewReducer` function signature and its `switch` cases are not modified.
- [ ] SpeechRecognition `continuous`, `interimResults`, and `lang` settings are not changed from existing values.

## Open Decisions

1. **Both Start and Stop buttons rendered inside `VoiceRecorder`**: This keeps all recognition lifecycle code (start, interim, final, stop, abort, error) co-located in a single component. `InterviewRoom` renders `<VoiceRecorder .../>` inside the controls bar and does not render standalone `IconButton` elements for recording. This avoids the complexity of `useImperativeHandle` and prevents state desynchrony.

2. **`isAISpeaking` as `useState` not a reducer field**: AI speaking state is purely visual (drives an animation ring) and has no bearing on interview turn logic. Keeping it as component-level `useState` respects the constraint that the `interviewReducer` must not be modified.

3. **`callStartedAt` as `useState` (not `useRef`)**: Although `CallTimer` manages its own interval, `InterviewRoom` must re-render once when the epoch is first set so that the initially `null` `startedAt` prop becomes the epoch value. Using `useRef` avoids that re-render, causing `CallTimer` to display "00:00" until an unrelated state change (e.g., `isAISpeaking`) triggers a re-render — a fragile implicit dependency that breaks when SpeechSynthesis is unavailable. Using `useState<number | null>` guarantees `CallTimer` receives the epoch immediately. The single extra re-render is negligible.

4. **`TranscriptView` gets a `variant` prop**: Rather than duplicating the component or having `InterviewRoom` pass inline style overrides, a `variant` prop keeps styling decisions inside `TranscriptView`. Default is `'light'` so all existing usages outside the interview page are unaffected.

5. **Camera requested after `SESSION_CREATED`**: Requesting camera access during the session-creation spinner could confuse users (the page isn't fully rendered yet). Waiting until `awaiting_recording` ensures the video-call UI is visible before the browser permission prompt appears.

6. **Inline SVG icons (no icon library)**: The project uses no icon library (lucide-react, heroicons, etc.). All icons are simple inline SVGs to avoid adding a dependency. A recognisable microphone outline and a filled square are sufficient for usability.

7. **Page layout: `<h1>` removed from page, job title moves to header bar**: The existing page renders `<h1>{job.title} Interview</h1>` above `InterviewRoom`. In the video-call aesthetic, the job title belongs in the header bar inside `InterviewRoom`, so the page-level `<h1>` is removed. `InterviewRoom` receives the `job` prop (already the case) and can access `job.title`.

8. **`VoiceRecorder` abort on unmount via `useEffect` cleanup**: This is a new defensive measure not present in the current implementation. It prevents a race condition where the component unmounts while recognition is in progress, which would otherwise fire `onend` and potentially `onError` on an unmounted component.

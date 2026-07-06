/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TextDecoder as NodeTextDecoder } from 'node:util';
import type { Job } from '@/types';

// jest-environment-jsdom does not expose TextDecoder as a global; the component's
// streaming reader uses it to decode Uint8Array chunks, so we polyfill it here.
if (typeof (global as Record<string, unknown>).TextDecoder === 'undefined') {
  (global as Record<string, unknown>).TextDecoder = NodeTextDecoder;
}

// ── Module mocks (must be registered before dynamic import of InterviewRoom) ───

jest.unstable_mockModule('@/components/VoiceRecorder', () => ({
  VoiceRecorder: ({
    onTranscript,
    onStart,
    disabled,
  }: {
    onTranscript: (t: string) => void;
    onStart: () => void;
    onInterim: (t: string) => void;
    onError: (m: string) => void;
    disabled: boolean;
  }) => (
    <div data-testid="voice-recorder">
      <button
        data-testid="mock-record-button"
        disabled={disabled}
        onClick={() => {
          onStart();
          onTranscript('my test answer');
        }}
      >
        Mock Record
      </button>
    </div>
  ),
}));

// ── Dynamic import (after mocks are registered) ──────────────────────────────

const { InterviewRoom } = await import('@/components/InterviewRoom');

// ── Test fixtures ─────────────────────────────────────────────────────────────

const VALID_JOB: Job = {
  id: 'clswe0001000000000000000001',
  slug: 'software-engineer',
  title: 'Software Engineer',
  description: 'Test description.',
  questionPack: null,
  seniority: 'MID',
};

const INITIAL_QUESTION =
  'Welcome! Please start by telling me about yourself and your background.';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSessionResponse(id = 'session-123'): Response {
  return {
    ok: true,
    status: 201,
    json: () => Promise.resolve({ id }),
  } as unknown as Response;
}

function makeSessionErrorResponse(
  errorMessage = 'Server error occurred'
): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: errorMessage }),
  } as unknown as Response;
}

function makeInterviewResponse(
  nextQuestion = 'Next question',
  isComplete = false,
  decisionState: {
    detectedSkills: string[];
    coveredTopics: string[];
    remainingGaps: string[];
    questionRationale: string;
  } | null = {
    detectedSkills: ['TypeScript'],
    coveredTopics: ['Background'],
    remainingGaps: ['System Design'],
    questionRationale: 'Probing system design.',
  }
): Response {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        nextQuestion,
        isComplete,
        decisionState,
      }),
  } as unknown as Response;
}

/** Create a fetch mock typed correctly for use with toHaveBeenCalledWith. */
function createFetchMock() {
  return jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InterviewRoom', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock speechSynthesis — not available in jsdom
    Object.defineProperty(window, 'speechSynthesis', {
      value: { cancel: jest.fn(), speak: jest.fn() },
      writable: true,
      configurable: true,
    });

    // Mock SpeechSynthesisUtterance with onstart/onend support — not available in jsdom
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class MockSpeechSynthesisUtterance {
        text: string;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      },
      writable: true,
      configurable: true,
    });

    // Mock navigator.mediaDevices — not available in jsdom; simulate denial so
    // the camera useEffect runs and catches the rejection silently.
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest
          .fn()
          .mockImplementation(() => Promise.reject(new DOMException('Permission denied'))),
      },
      writable: true,
      configurable: true,
    });

    // Mock scrollIntoView — not implemented in jsdom
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── 1. On mount, fetch is called ─────────────────────────────────────────────

  it('on mount, calls fetch /api/sessions with { jobId: job.id }', () => {
    const mockFetch = createFetchMock();
    mockFetch.mockImplementation(() => new Promise<Response>(() => {}));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ jobId: VALID_JOB.id }),
      })
    );
  });

  // ── 2. Spinner while fetch is pending ────────────────────────────────────────

  it('renders "Starting your interview…" while fetch is pending', () => {
    const mockFetch = createFetchMock();
    mockFetch.mockImplementation(() => new Promise<Response>(() => {}));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    expect(screen.getByText('Starting your interview…')).toBeInTheDocument();
  });

  // ── 3. INITIAL_QUESTION shown after session creation ─────────────────────────

  it('renders INITIAL_QUESTION after session creation succeeds', async () => {
    const mockFetch = createFetchMock();
    mockFetch.mockResolvedValue(makeSessionResponse());
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    await waitFor(() => {
      expect(screen.getByText(INITIAL_QUESTION)).toBeInTheDocument();
    });
  });

  // ── 4. Error state on session creation failure ────────────────────────────────

  it('shows error message and Retry button when session creation fails', async () => {
    const errorMsg = 'Server error occurred';
    const mockFetch = createFetchMock();
    mockFetch.mockResolvedValue(makeSessionErrorResponse(errorMsg));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    await waitFor(() => {
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /retry/i })
      ).toBeInTheDocument();
    });
  });

  // ── 5. Clicking Retry re-calls fetch ─────────────────────────────────────────

  it('clicking Retry re-calls fetch /api/sessions', async () => {
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionErrorResponse('Oops'))
      .mockImplementationOnce(() => new Promise<Response>(() => {}));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /retry/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ── 6. VoiceRecorder rendered after SESSION_CREATED ──────────────────────────

  it('renders VoiceRecorder after session creation succeeds', async () => {
    const mockFetch = createFetchMock();
    mockFetch.mockResolvedValue(makeSessionResponse());
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    await waitFor(() => {
      expect(screen.getByTestId('voice-recorder')).toBeInTheDocument();
    });
  });

  // ── 7. "Thinking…" shown during processing phase ─────────────────────────────

  it('renders "Thinking…" when phase is processing', async () => {
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionResponse())
      .mockImplementationOnce(() => new Promise<Response>(() => {})); // interview fetch never resolves
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    // Wait for awaiting_recording phase (VoiceRecorder present)
    await waitFor(() => {
      expect(screen.getByTestId('mock-record-button')).toBeInTheDocument();
    });

    // Click mock button → triggers RECORDING_STARTED + FINAL_TRANSCRIPT → processing
    fireEvent.click(screen.getByTestId('mock-record-button'));

    await waitFor(() => {
      expect(screen.getByText('Thinking…')).toBeInTheDocument();
    });
  });

  // ── 8. "Interview complete." shown when phase is complete ────────────────────

  it('renders "Interview complete." when phase is complete', async () => {
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionResponse())
      .mockResolvedValueOnce(makeInterviewResponse('Final question', true));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    // Wait for awaiting_recording phase
    await waitFor(() => {
      expect(screen.getByTestId('mock-record-button')).toBeInTheDocument();
    });

    // Trigger transcript → processing → TURN_SAVED with isComplete = true → complete
    fireEvent.click(screen.getByTestId('mock-record-button'));

    await waitFor(() => {
      expect(screen.getByText('Interview complete.')).toBeInTheDocument();
    });
  });

  // ── 9. Next question displayed in question panel after non-complete stream ───

  it('displays next question in panel after streaming a non-complete turn', async () => {
    const NEXT_Q = 'Tell me about a challenge you faced.';
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionResponse())
      .mockResolvedValueOnce(makeInterviewResponse(NEXT_Q, false));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    // Wait for awaiting_recording phase
    await waitFor(() => {
      expect(screen.getByTestId('mock-record-button')).toBeInTheDocument();
    });

    // Trigger transcript → processing → TURN_SAVED with isComplete = false
    fireEvent.click(screen.getByTestId('mock-record-button'));

    // Component should transition back to awaiting_recording and show the next question
    await waitFor(() => {
      expect(screen.getByText(NEXT_Q)).toBeInTheDocument();
    });

    // Verify component is NOT in complete phase
    expect(screen.queryByText('Interview complete.')).not.toBeInTheDocument();
  });

  // ── 10. Job title in header bar after session creation ───────────────────────

  it('renders job title in header bar after session creation', async () => {
    const mockFetch = createFetchMock();
    mockFetch.mockResolvedValue(makeSessionResponse());
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    await waitFor(() => {
      expect(screen.getByText(VALID_JOB.title)).toBeInTheDocument();
    });
  });

  // ── 11. DecisionPanel renders in awaiting_recording phase ────────────────────

  it('DecisionPanel renders in awaiting_recording phase', async () => {
    const mockFetch = createFetchMock();
    mockFetch.mockResolvedValue(makeSessionResponse());
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    await waitFor(() => {
      expect(
        document.querySelector('[aria-label="AI decision panel"]')
      ).toBeInTheDocument();
    });
  });

  // ── 12. DecisionPanel shows loading state in processing phase ─────────────────

  it('DecisionPanel shows loading state in processing phase', async () => {
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionResponse())
      .mockImplementationOnce(() => new Promise<Response>(() => {})); // interview fetch never resolves
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    // Wait for awaiting_recording phase
    await waitFor(() => {
      expect(screen.getByTestId('mock-record-button')).toBeInTheDocument();
    });

    // Click mock button → processing phase → DecisionPanel isLoading=true
    fireEvent.click(screen.getByTestId('mock-record-button'));

    await waitFor(() => {
      const decisionPanel = document.querySelector('[aria-label="AI decision panel"]');
      expect(decisionPanel).not.toBeNull();
      // Spinner inside DecisionPanel renders role="status"
      expect(decisionPanel!.querySelector('[role="status"]')).not.toBeNull();
    });
  });

  // ── 13. DecisionPanel shows decisionState data after TURN_SAVED ───────────────

  it('DecisionPanel shows decisionState data after TURN_SAVED', async () => {
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionResponse())
      .mockResolvedValueOnce(makeInterviewResponse('Next question', false));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    // Wait for awaiting_recording phase
    await waitFor(() => {
      expect(screen.getByTestId('mock-record-button')).toBeInTheDocument();
    });

    // Trigger transcript → processing → TURN_SAVED → decisionState populated
    fireEvent.click(screen.getByTestId('mock-record-button'));

    await waitFor(() => {
      expect(screen.getByText('Probing system design.')).toBeInTheDocument();
    });
  });

  // ── 14. /api/interview request body contains currentQuestion ──────────────────

  it('calls /api/interview with currentQuestion in request body', async () => {
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionResponse())
      .mockImplementationOnce(() => new Promise<Response>(() => {})); // interview fetch never resolves
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    // Wait for awaiting_recording phase
    await waitFor(() => {
      expect(screen.getByTestId('mock-record-button')).toBeInTheDocument();
    });

    // Trigger turn submission
    fireEvent.click(screen.getByTestId('mock-record-button'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/interview',
        expect.objectContaining({
          body: expect.stringContaining('"currentQuestion"'),
        })
      );
    });
  });

  // ── 15. TURN_SAVED with decisionState: null does not throw ───────────────────

  it('handles TURN_SAVED with decisionState: null without error', async () => {
    const NEXT_Q = 'Can you elaborate on your debugging approach?';
    const mockFetch = createFetchMock();
    mockFetch
      .mockResolvedValueOnce(makeSessionResponse())
      // OpenRouter follow-up: decisionState is null
      .mockResolvedValueOnce(makeInterviewResponse(NEXT_Q, false, null));
    global.fetch = mockFetch;

    render(<InterviewRoom job={VALID_JOB} />);

    // Wait for awaiting_recording phase
    await waitFor(() => {
      expect(screen.getByTestId('mock-record-button')).toBeInTheDocument();
    });

    // Trigger turn submission
    fireEvent.click(screen.getByTestId('mock-record-button'));

    // The component should transition to awaiting_recording with the follow-up question,
    // and decisionState: null must not cause a runtime exception.
    await waitFor(() => {
      expect(screen.getByText(NEXT_Q)).toBeInTheDocument();
    });

    expect(screen.queryByText('Interview complete.')).not.toBeInTheDocument();
  });

});

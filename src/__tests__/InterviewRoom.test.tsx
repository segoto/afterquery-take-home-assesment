/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { Job } from '@/types';

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
  isComplete = false
): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ nextQuestion, isComplete }),
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

    // Mock SpeechSynthesisUtterance — not available in jsdom
    if (!('SpeechSynthesisUtterance' in window)) {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: class MockSpeechSynthesisUtterance {
          text: string;
          constructor(text: string) {
            this.text = text;
          }
        },
        writable: true,
        configurable: true,
      });
    }

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
});

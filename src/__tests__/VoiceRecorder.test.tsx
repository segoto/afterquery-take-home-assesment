/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

let lastRecognitionInstance: MockSpeechRecognition | null = null;

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    lastRecognitionInstance = this;
  }
}

// Dynamically import VoiceRecorder after mocks are set up
const { VoiceRecorder } = await import('@/components/VoiceRecorder');

const defaultProps = {
  onTranscript: jest.fn<(transcript: string) => void>(),
  onInterim: jest.fn<(text: string) => void>(),
  onError: jest.fn<(message: string) => void>(),
  onStart: jest.fn<() => void>(),
  disabled: false,
};

/** Build a SpeechRecognitionEvent-shaped object for testing onresult handlers. */
function makeSpeechResultEvent(transcript: string, isFinal: boolean): SpeechRecognitionEvent {
  const alternative = { transcript, confidence: 1 } as SpeechRecognitionAlternative;
  const result = Object.assign([alternative], { isFinal, length: 1 }) as unknown as SpeechRecognitionResult;
  const results = Object.assign([result], { length: 1 }) as unknown as SpeechRecognitionResultList;
  return { resultIndex: 0, results } as unknown as SpeechRecognitionEvent;
}

describe('VoiceRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastRecognitionInstance = null;
    // Reset speech recognition APIs before each test
    delete (window as WindowWithSpeechRecognition).SpeechRecognition;
    delete (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
  });

  afterEach(() => {
    delete (window as WindowWithSpeechRecognition).SpeechRecognition;
    delete (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
  });

  it('renders the role="alert" warning banner when SpeechRecognition is not available', () => {
    // Ensure both APIs are undefined
    delete (window as WindowWithSpeechRecognition).SpeechRecognition;
    delete (window as WindowWithSpeechRecognition).webkitSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain('Voice interviews require Chrome or Edge');
  });

  it('does not render the "Start Recording" button when SpeechRecognition is not available', () => {
    delete (window as WindowWithSpeechRecognition).SpeechRecognition;
    delete (window as WindowWithSpeechRecognition).webkitSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /start recording/i })).not.toBeInTheDocument();
  });

  it('renders the "Start Recording" button when SpeechRecognition is available', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
  });

  it('renders the "Start Recording" button when webkitSpeechRecognition is available', () => {
    delete (window as WindowWithSpeechRecognition).SpeechRecognition;
    (window as WindowWithSpeechRecognition).webkitSpeechRecognition = MockSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
  });

  it('button is disabled when props.disabled is true', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} disabled={true} />);

    const button = screen.getByRole('button', { name: /start recording/i });
    expect(button).toBeDisabled();
  });

  it('button is enabled when props.disabled is false', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} disabled={false} />);

    const button = screen.getByRole('button', { name: /start recording/i });
    expect(button).not.toBeDisabled();
  });

  it('calls props.onStart when the button is clicked', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    const onStart = jest.fn<() => void>();
    render(<VoiceRecorder {...defaultProps} onStart={onStart} />);

    const button = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(button);

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('Stop button is absent before recording starts', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /stop recording/i })).not.toBeInTheDocument();
  });

  it('Stop button appears when recording is active', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    render(<VoiceRecorder {...defaultProps} />);

    const startButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(startButton);

    expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
  });

  it('Stop with non-empty interim submits interim as transcript', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    const onTranscript = jest.fn<(transcript: string) => void>();
    const onError = jest.fn<(message: string) => void>();
    render(<VoiceRecorder {...defaultProps} onTranscript={onTranscript} onError={onError} />);

    // Click Start to begin recording
    const startButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(startButton);

    const recognition = lastRecognitionInstance!;

    // Simulate an interim onresult event — this sets currentInterim state
    act(() => {
      recognition.onresult!(makeSpeechResultEvent('Hello world', false));
    });

    // Click Stop — should submit the interim text as the transcript
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    expect(onTranscript).toHaveBeenCalledWith('Hello world');
    expect(onError).not.toHaveBeenCalled();
  });

  it('Stop with empty interim calls onError', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    const onError = jest.fn<(message: string) => void>();
    render(<VoiceRecorder {...defaultProps} onError={onError} />);

    // Click Start without firing any onresult event
    const startButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(startButton);

    // Click Stop with no interim text
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    expect(onError).toHaveBeenCalledWith('Please say something before submitting.');
  });

  it('onend does not call onError when stopWithNoInterimRef is set', () => {
    (window as WindowWithSpeechRecognition).SpeechRecognition = MockSpeechRecognition;

    const onError = jest.fn<(message: string) => void>();
    render(<VoiceRecorder {...defaultProps} onError={onError} />);

    // Click Start
    const startButton = screen.getByRole('button', { name: /start recording/i });
    fireEvent.click(startButton);

    // Click Stop with empty interim — sets stopWithNoInterimRef and calls onError once
    const stopButton = screen.getByRole('button', { name: /stop recording/i });
    fireEvent.click(stopButton);

    expect(onError).toHaveBeenCalledTimes(1);

    // Simulate recognition.onend firing after stop
    const recognition = lastRecognitionInstance!;
    act(() => {
      recognition.onend!();
    });

    // onError should still only have been called once (not again from onend)
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
  start = jest.fn();
  stop = jest.fn();
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

describe('VoiceRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});

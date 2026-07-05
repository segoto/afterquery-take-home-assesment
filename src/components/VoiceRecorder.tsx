'use client';

import React, { useState, useRef, useEffect } from 'react';
import { IconButton } from '@/components/ui';

interface VoiceRecorderProps {
  onTranscript: (transcript: string) => void;
  onInterim: (text: string) => void;
  onError: (message: string) => void;
  onStart: () => void;
  disabled: boolean;
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

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

export function VoiceRecorder(props: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentInterim, setCurrentInterim] = useState<string>('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalReceivedRef = useRef<boolean>(false);
  const stopWithNoInterimRef = useRef<boolean>(false);

  // Browser support detection inside component function to avoid SSR issues
  const SpeechRecognitionAPI: SpeechRecognitionCtor | null =
    typeof window !== 'undefined'
      ? (
          (window as WindowWithSpeechRecognition).SpeechRecognition ??
          (window as WindowWithSpeechRecognition).webkitSpeechRecognition ??
          null
        )
      : null;
  const isSupported = SpeechRecognitionAPI !== null;

  // Unmount cleanup: abort any in-progress recognition to prevent onend
  // from firing on an unmounted component when the phase changes.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  function handleStart() {
    if (!SpeechRecognitionAPI) return;
    finalReceivedRef.current = false;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalReceivedRef.current = true;
          props.onTranscript(result[0].transcript);
          setCurrentInterim('');
          recognition.stop();
        } else {
          props.onInterim(result[0].transcript);
          setCurrentInterim(result[0].transcript);
        }
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
      if (!finalReceivedRef.current && !stopWithNoInterimRef.current) {
        props.onError('Recording ended without a result. Please try again.');
      }
      stopWithNoInterimRef.current = false;
      setCurrentInterim('');
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        props.onError(
          'Microphone access denied. Please allow microphone access in your browser settings.'
        );
      } else {
        props.onError('Recording failed. Please try again.');
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    props.onStart();
  }

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

  if (!isSupported) {
    return (
      <div
        role="alert"
        className="bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-xl p-4"
      >
        Voice interviews require Chrome or Edge. Please switch browsers to continue.
      </div>
    );
  }

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
}

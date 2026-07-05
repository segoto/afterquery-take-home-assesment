'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui';

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

export function VoiceRecorder(props: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalReceivedRef = useRef<boolean>(false);

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
          recognition.stop();
        } else {
          props.onInterim(result[0].transcript);
        }
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
      if (!finalReceivedRef.current) {
        props.onError('Recording ended without a result. Please try again.');
      }
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

  if (!isSupported) {
    return (
      <div
        role="alert"
        className="bg-amber-50 border border-amber-300 text-amber-800 rounded-md p-4"
      >
        Voice interviews require Chrome or Edge. Please switch browsers to continue.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="primary"
        disabled={props.disabled || isRecording}
        aria-label="Start recording"
        onClick={handleStart}
      >
        {isRecording ? 'Recording…' : 'Start Recording'}
      </Button>
      {isRecording && (
        <span
          className="animate-pulse bg-red-500 h-3 w-3 rounded-full inline-block"
          aria-label="Recording in progress"
          aria-live="polite"
        />
      )}
    </div>
  );
}

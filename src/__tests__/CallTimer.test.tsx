/**
 * @jest-environment jsdom
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { CallTimer } from '@/components/ui/CallTimer';

describe('CallTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders "00:00" when startedAt is null', () => {
    render(<CallTimer startedAt={null} />);
    const timeEl = screen.getByLabelText('Elapsed interview time');
    expect(timeEl).toHaveTextContent('00:00');
  });

  it('renders "01:05" after one tick when startedAt was 64 seconds ago', () => {
    // Start 64 s in the past; after 1 tick (1000 ms) the total elapsed is 65 s → "01:05"
    const startedAt = Date.now() - 64000;
    render(<CallTimer startedAt={startedAt} />);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByLabelText('Elapsed interview time')).toHaveTextContent('01:05');
  });

  it('updates elapsed on each 1-second tick', () => {
    const startedAt = Date.now();
    render(<CallTimer startedAt={startedAt} />);

    // Before any tick: initial state is "00:00"
    expect(screen.getByLabelText('Elapsed interview time')).toHaveTextContent('00:00');

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByLabelText('Elapsed interview time')).toHaveTextContent('00:01');

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByLabelText('Elapsed interview time')).toHaveTextContent('00:02');
  });
});

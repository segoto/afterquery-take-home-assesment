/**
 * @jest-environment jsdom
 */
import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { VideoTile } from '@/components/ui/VideoTile';

describe('VideoTile', () => {
  it('renders the name label text', () => {
    render(<VideoTile name="AI Interviewer"><span>content</span></VideoTile>);
    expect(screen.getByText('AI Interviewer')).toBeInTheDocument();
  });

  it('does not render the speaking indicator when isActive is false', () => {
    render(<VideoTile name="AI Interviewer" isActive={false}><span>content</span></VideoTile>);
    expect(screen.queryByLabelText('AI is speaking')).not.toBeInTheDocument();
  });

  it('does not render the speaking indicator when isActive is omitted', () => {
    render(<VideoTile name="AI Interviewer"><span>content</span></VideoTile>);
    expect(screen.queryByLabelText('AI is speaking')).not.toBeInTheDocument();
  });

  it('renders the speaking indicator when isActive is true', () => {
    render(<VideoTile name="AI Interviewer" isActive={true}><span>content</span></VideoTile>);
    expect(screen.getByLabelText('AI is speaking')).toBeInTheDocument();
  });

  it('renders children inside the tile', () => {
    render(
      <VideoTile name="You">
        <span data-testid="tile-child">child content</span>
      </VideoTile>
    );
    expect(screen.getByTestId('tile-child')).toBeInTheDocument();
    expect(screen.getByTestId('tile-child')).toHaveTextContent('child content');
  });
});

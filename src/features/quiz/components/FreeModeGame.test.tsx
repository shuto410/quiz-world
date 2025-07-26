/**
 * Free Mode Game Component Test Suite
 * 
 * TEST SPECIFICATION:
 * - Free Mode game rendering and functionality
 * - Buzzer button behavior for participants
 * - Host judgment buttons and scoring
 * - Scoreboard display and updates
 * 
 * TESTING STRATEGY:
 * - Red: Write failing tests first
 * - Green: Implement minimal code to pass tests
 * - Refactor: Improve code while maintaining test coverage
 * 
 * KEY TEST CASES:
 * - Renders buzzer button for non-host users
 * - Shows judgment buttons for host when user buzzed
 * - Displays scoreboard correctly
 * - Handles next round transitions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { FreeModeGame } from './FreeModeGame';
import type { User } from '@/types';

// Mock users for testing
const mockUsers: User[] = [
  { id: 'host-1', name: 'Host Player', isHost: true },
  { id: 'player-1', name: 'Player 1', isHost: false },
  { id: 'player-2', name: 'Player 2', isHost: false },
];


const defaultProps = {
  users: mockUsers,
  isHost: false,
  buzzedUser: null,
  onBuzzIn: vi.fn(),
  onJudgeCorrect: vi.fn(),
  onJudgeIncorrect: vi.fn(),
  onNextRound: vi.fn(),
  hasAnswered: false,
  showAnswer: false,
};

describe('FreeModeGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Free Mode title and instructions', () => {
    render(<FreeModeGame {...defaultProps} />);
    
    expect(screen.getByText('🎙️ Free Mode')).toBeInTheDocument();
    expect(screen.getByText('📝 How Free Mode Works')).toBeInTheDocument();
    expect(screen.getByText('1. Host reads questions via voice chat (Discord, Skype, etc.)')).toBeInTheDocument();
  });

  it('shows buzzer button for non-host users', () => {
    render(<FreeModeGame {...defaultProps} />);
    
    const buzzerButton = screen.getByRole('button', { name: /buzz in/i });
    expect(buzzerButton).toBeInTheDocument();
    expect(buzzerButton).not.toBeDisabled();
  });

  it('does not show buzzer button for host users', () => {
    render(<FreeModeGame {...defaultProps} isHost={true} />);
    
    expect(screen.queryByRole('button', { name: /buzz in/i })).not.toBeInTheDocument();
    expect(screen.getByText('Read the question via voice chat...')).toBeInTheDocument();
  });

  it('calls onBuzzIn when buzzer button is clicked', () => {
    const onBuzzIn = vi.fn();
    render(<FreeModeGame {...defaultProps} onBuzzIn={onBuzzIn} />);
    
    const buzzerButton = screen.getByRole('button', { name: /buzz in/i });
    fireEvent.click(buzzerButton);
    
    expect(onBuzzIn).toHaveBeenCalledTimes(1);
  });

  it('shows buzzed user status when someone buzzes in', () => {
    const buzzedUser = mockUsers[1]; // Player 1
    render(<FreeModeGame {...defaultProps} buzzedUser={buzzedUser} />);
    
    expect(screen.getByText((content) => content.includes('buzzed in!'))).toBeInTheDocument();
  });

  it('shows judgment buttons for host when user buzzed', () => {
    const buzzedUser = mockUsers[1];
    render(<FreeModeGame {...defaultProps} isHost={true} buzzedUser={buzzedUser} />);
    
    expect(screen.getByText((content) => content.includes('answer:'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /✓ Correct/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /✗ Incorrect/i })).toBeInTheDocument();
  });

  it('calls onJudgeCorrect when correct button is clicked', () => {
    const onJudgeCorrect = vi.fn();
    const buzzedUser = mockUsers[1];
    render(<FreeModeGame {...defaultProps} isHost={true} buzzedUser={buzzedUser} onJudgeCorrect={onJudgeCorrect} />);
    
    const correctButton = screen.getByRole('button', { name: /✓ Correct/i });
    fireEvent.click(correctButton);
    
    expect(onJudgeCorrect).toHaveBeenCalledTimes(1);
  });

  it('calls onJudgeIncorrect when incorrect button is clicked', () => {
    const onJudgeIncorrect = vi.fn();
    const buzzedUser = mockUsers[1];
    render(<FreeModeGame {...defaultProps} isHost={true} buzzedUser={buzzedUser} onJudgeIncorrect={onJudgeIncorrect} />);
    
    const incorrectButton = screen.getByRole('button', { name: /✗ Incorrect/i });
    fireEvent.click(incorrectButton);
    
    expect(onJudgeIncorrect).toHaveBeenCalledTimes(1);
  });


  it('does not show next round button in Free Mode', () => {
    render(<FreeModeGame {...defaultProps} isHost={true} hasAnswered={true} />);
    
    const nextButton = screen.queryByRole('button', { name: /Next Question/i });
    expect(nextButton).not.toBeInTheDocument();
  });

  it('automatically proceeds to next round after correct judgment', () => {
    const onJudgeCorrect = vi.fn();
    const onNextRound = vi.fn();
    const buzzedUser = mockUsers[1];
    
    render(<FreeModeGame 
      {...defaultProps}
      isHost={true}
      buzzedUser={buzzedUser}
      onJudgeCorrect={onJudgeCorrect}
      onNextRound={onNextRound}
    />);
    
    const correctButton = screen.getByRole('button', { name: /✓ Correct/i });
    fireEvent.click(correctButton);
    
    expect(onJudgeCorrect).toHaveBeenCalledTimes(1);
    
    // Should automatically call onNextRound after judgment
    expect(onNextRound).toHaveBeenCalledTimes(1);
  });

  it('automatically proceeds to next round after incorrect judgment', () => {
    const onJudgeIncorrect = vi.fn();
    const onNextRound = vi.fn();
    const buzzedUser = mockUsers[1];
    
    render(<FreeModeGame 
      {...defaultProps}
      isHost={true}
      buzzedUser={buzzedUser}
      onJudgeIncorrect={onJudgeIncorrect}
      onNextRound={onNextRound}
    />);
    
    const incorrectButton = screen.getByRole('button', { name: /✗ Incorrect/i });
    fireEvent.click(incorrectButton);
    
    expect(onJudgeIncorrect).toHaveBeenCalledTimes(1);
    
    // Should automatically call onNextRound after judgment
    expect(onNextRound).toHaveBeenCalledTimes(1);
  });

});
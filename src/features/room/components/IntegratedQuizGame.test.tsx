/**
 * Integrated Quiz Game component tests
 * - Tests all game states and user interactions
 * - Verifies socket event emissions
 * - Ensures proper UI rendering for different scenarios
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntegratedQuizGame } from './IntegratedQuizGame';
import { getSocket } from '@/lib/socketClient';
import type { Quiz, User, Score } from '@/types';

// Mock socket client
vi.mock('@/lib/socketClient', () => ({
  getSocket: vi.fn(),
}));

const mockSocket = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const mockGetSocket = getSocket as vi.MockedFunction<typeof getSocket>;

describe('IntegratedQuizGame', () => {
  const mockQuiz: Quiz = {
    id: 'quiz-1',
    question: 'What is the capital of Japan?',
    answer: 'Tokyo',
    type: 'text',
  };

  const mockCurrentUser: User = {
    id: 'user-1',
    name: 'Test User',
    isHost: false,
  };

  const mockUsers: User[] = [
    { id: 'user-1', name: 'Test User', isHost: false },
    { id: 'user-2', name: 'Player 2', isHost: true },
  ];

  const mockScores: Score[] = [
    { userId: 'user-1', score: 100 },
    { userId: 'user-2', score: 80 },
  ];

  const defaultProps = {
    quiz: mockQuiz,
    currentUser: mockCurrentUser,
    users: mockUsers,
    isHost: false,
    gameState: 'waiting' as const,
    scores: mockScores,
    buzzedUsers: [],
    onEndQuiz: vi.fn(),
    onNextQuiz: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSocket.mockReturnValue(mockSocket);
  });

  describe('Rendering', () => {
    it('should render quiz question and type', () => {
      render(<IntegratedQuizGame {...defaultProps} />);
      
      expect(screen.getByText('What is the capital of Japan?')).toBeInTheDocument();
      expect(screen.getByText('Type: text')).toBeInTheDocument();
    });

    it('should show buzz in button when game is active and no one has buzzed', () => {
      render(<IntegratedQuizGame {...defaultProps} gameState="active" />);
      
      expect(screen.getByText('🔔 Buzz In')).toBeInTheDocument();
    });

    it('should not show buzz in button when someone has buzzed', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockUsers[1]]}
        />
      );
      
      expect(screen.queryByText('🔔 Buzz In')).not.toBeInTheDocument();
    });

    it('should show buzzed user name when someone has buzzed', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockUsers[1]]}
        />
      );
      
      expect(screen.getByText('Player 2')).toBeInTheDocument();
      expect(screen.getByText('buzzed in!')).toBeInTheDocument();
    });

    it('should show answer input for buzzed user', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should not show answer input for non-buzzed user', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockUsers[1]]}
        />
      );
      
      expect(screen.queryByPlaceholderText('Type your answer...')).not.toBeInTheDocument();
    });

    it('should show "Show Answer" button for host after answer submission', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          isHost={true}
          gameState="active"
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      // Simulate answer submission
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      
      expect(screen.getByText('Show Answer')).toBeInTheDocument();
    });

    it('should show correct answer when revealed', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          isHost={true}
          gameState="active"
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      // Simulate answer submission and show answer
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      fireEvent.click(screen.getByText('Show Answer'));
      
      expect(screen.getByText('Correct Answer:')).toBeInTheDocument();
      expect(screen.getByText('Tokyo')).toBeInTheDocument();
    });

    it('should show finished state with scores', () => {
      render(<IntegratedQuizGame {...defaultProps} gameState="finished" />);
      
      expect(screen.getByText('🎉')).toBeInTheDocument();
      expect(screen.getByText('Quiz Finished!')).toBeInTheDocument();
      expect(screen.getByText('Final Scores')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('Player 2')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
    });

    it('should show trophy for first place', () => {
      render(<IntegratedQuizGame {...defaultProps} gameState="finished" />);
      
      expect(screen.getByText('🏆')).toBeInTheDocument();
    });

    it('should show host controls when user is host', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          isHost={true}
          gameState="active"
        />
      );
      
      expect(screen.getByText('End Quiz')).toBeInTheDocument();
    });

    it('should show "Next Quiz" button for host when answer is revealed', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          isHost={true}
          gameState="active"
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      // Simulate answer submission and show answer
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      fireEvent.click(screen.getByText('Show Answer'));
      
      expect(screen.getByText('Next Quiz')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should emit buzz event when buzz in button is clicked', () => {
      render(<IntegratedQuizGame {...defaultProps} gameState="active" />);
      
      fireEvent.click(screen.getByText('🔔 Buzz In'));
      
      expect(mockSocket.emit).toHaveBeenCalledWith('game:buzz', {
        user: mockCurrentUser,
      });
    });

    it('should not emit buzz event when someone has already buzzed', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockUsers[1]]}
        />
      );
      
      // Buzz in button should not be present
      expect(screen.queryByText('🔔 Buzz In')).not.toBeInTheDocument();
    });

    it('should emit answer event when answer is submitted', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      
      expect(mockSocket.emit).toHaveBeenCalledWith('game:answer', {
        user: mockCurrentUser,
        answer: 'Tokyo',
      });
    });

    it('should not emit answer event for empty answer', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const submitButton = screen.getByText('Submit');
      fireEvent.click(submitButton);
      
      expect(mockSocket.emit).not.toHaveBeenCalledWith('game:answer', expect.any(Object));
    });

    it('should submit answer on Enter key press', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.keyDown(answerInput, { key: 'Enter' });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('game:answer', {
        user: mockCurrentUser,
        answer: 'Tokyo',
      });
    });

    it('should not submit answer on Shift+Enter', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.keyDown(answerInput, { key: 'Enter', shiftKey: true });
      
      expect(mockSocket.emit).not.toHaveBeenCalledWith('game:answer', expect.any(Object));
    });

    it('should disable submit button when answer is empty', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const submitButton = screen.getByText('Submit');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when answer is provided', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      
      const submitButton = screen.getByText('Submit');
      expect(submitButton).not.toBeDisabled();
    });

    it('should call onEndQuiz when "Back to Lobby" is clicked', () => {
      const onEndQuiz = vi.fn();
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          onEndQuiz={onEndQuiz}
          gameState="finished"
        />
      );
      
      fireEvent.click(screen.getByText('Back to Lobby'));
      
      expect(onEndQuiz).toHaveBeenCalled();
    });

    it('should call onNextQuiz when "Next Quiz" is clicked', () => {
      const onNextQuiz = vi.fn();
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          onNextQuiz={onNextQuiz}
          isHost={true}
          gameState="active"
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      // Simulate answer submission and show answer
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      fireEvent.click(screen.getByText('Show Answer'));
      
      fireEvent.click(screen.getByText('Next Quiz'));
      
      expect(onNextQuiz).toHaveBeenCalled();
    });

    it('should call onEndQuiz when host clicks "End Quiz"', () => {
      const onEndQuiz = vi.fn();
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          onEndQuiz={onEndQuiz}
          isHost={true}
          gameState="active"
        />
      );
      
      fireEvent.click(screen.getByText('End Quiz'));
      
      expect(onEndQuiz).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing socket gracefully', () => {
      mockGetSocket.mockReturnValue(null);
      
      render(<IntegratedQuizGame {...defaultProps} gameState="active" />);
      
      fireEvent.click(screen.getByText('🔔 Buzz In'));
      
      // Should not throw error
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should handle empty scores array', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="finished"
          scores={[]}
        />
      );
      
      expect(screen.getByText('Quiz Finished!')).toBeInTheDocument();
      expect(screen.queryByText('Final Scores')).not.toBeInTheDocument();
    });

    it('should handle unknown user in scores', () => {
      const scoresWithUnknownUser: Score[] = [
        { userId: 'unknown-user', score: 100 },
      ];
      
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="finished"
          scores={scoresWithUnknownUser}
        />
      );
      
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('should trim whitespace from answer', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: '  Tokyo  ' } });
      fireEvent.click(screen.getByText('Submit'));
      
      expect(mockSocket.emit).toHaveBeenCalledWith('game:answer', {
        user: mockCurrentUser,
        answer: 'Tokyo',
      });
    });

    it('should not show "Next Quiz" button for non-host users', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          isHost={false}
          gameState="active"
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      // Simulate answer submission
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      
      // Non-host users should not see "Show Answer" button
      expect(screen.queryByText('Show Answer')).not.toBeInTheDocument();
      
      // Non-host users should not see "Next Quiz" button
      expect(screen.queryByText('Next Quiz')).not.toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should set hasAnswered state after submitting answer', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      
      // Answer input should be hidden after submission
      expect(screen.queryByPlaceholderText('Type your answer...')).not.toBeInTheDocument();
    });

    it('should set showAnswer state when "Show Answer" is clicked', () => {
      render(
        <IntegratedQuizGame 
          {...defaultProps} 
          isHost={true}
          gameState="active"
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      // Simulate answer submission
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      
      // Click "Show Answer"
      fireEvent.click(screen.getByText('Show Answer'));
      
      // Should show correct answer
      expect(screen.getByText('Correct Answer:')).toBeInTheDocument();
      expect(screen.getByText('Tokyo')).toBeInTheDocument();
    });

    it('should reset answer state when new quiz starts', () => {
      const { rerender } = render(
        <IntegratedQuizGame 
          {...defaultProps} 
          gameState="active" 
          buzzedUsers={[mockCurrentUser]}
        />
      );
      
      // Submit an answer
      const answerInput = screen.getByPlaceholderText('Type your answer...');
      fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
      fireEvent.click(screen.getByText('Submit'));
      
      // Answer input should be hidden after submission
      expect(screen.queryByPlaceholderText('Type your answer...')).not.toBeInTheDocument();
      
      // Rerender with new quiz (different quiz ID) and reset buzzedUser
      const newQuiz = { ...mockQuiz, id: 'quiz-2' };
      rerender(
        <IntegratedQuizGame 
          {...defaultProps} 
          quiz={newQuiz}
          gameState="active" 
          buzzedUsers={[]}
        />
      );
      
      // Buzz in button should be available again
      expect(screen.getByText('🔔 Buzz In')).toBeInTheDocument();
    });
  });
});
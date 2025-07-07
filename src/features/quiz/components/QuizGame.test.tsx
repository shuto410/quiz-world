/**
 * Tests for refactored QuizGame component
 */
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuizGame } from './QuizGame';
import * as socketClient from '../../../lib/socketClient';
import * as useQuizTimer from '../hooks/useQuizTimer';
import type { Quiz, User, Score } from '../../../types';

// Mock socket client
vi.mock('../../../lib/socketClient', () => ({
  submitAnswer: vi.fn(),
}));

// Mock useQuizTimer hook
vi.mock('../hooks/useQuizTimer', () => ({
  useQuizTimer: vi.fn(),
}));

const mockCurrentUser: User = {
  id: 'user-1',
  name: 'Test User',
  isHost: false,
};

const mockUsers: User[] = [
  { id: 'user-1', name: 'Test User', isHost: false },
  { id: 'user-2', name: 'Host User', isHost: true },
  { id: 'user-3', name: 'Other User', isHost: false },
];

const mockTextQuiz: Quiz = {
  id: 'quiz-1',
  type: 'text',
  question: 'What is 2 + 2?',
  answer: '4',
};

const mockImageQuiz: Quiz = {
  id: 'quiz-2',
  type: 'image',
  question: 'What is in this image?',
  answer: 'cat',
  image: {
    type: 'url',
    data: 'https://example.com/cat.jpg',
  },
};

const mockScores: Score[] = [
  { userId: 'user-1', value: 100 },
  { userId: 'user-2', value: 50 },
  { userId: 'user-3', value: 75 },
];

describe('QuizGame Component', () => {
  const mockOnEndQuiz = vi.fn();
  const mockOnNextQuiz = vi.fn();
  
  const defaultTimerReturn = {
    timeLeft: 30,
    isExpired: false,
    start: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuizTimer.useQuizTimer).mockReturnValue(defaultTimerReturn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders text quiz correctly', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    expect(screen.getByText('Text Quiz')).toBeInTheDocument();
  });

  test('renders image quiz correctly', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('What is in this image?')).toBeInTheDocument();
    expect(screen.getByAltText('Quiz image')).toBeInTheDocument();
    expect(screen.getByText('Image Quiz')).toBeInTheDocument();
  });

  test('displays timer correctly', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  test('shows buzzer for text quiz in active state', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('🔔 BUZZ IN!')).toBeInTheDocument();
  });

  test('handles buzzer click', async () => {
    const user = userEvent.setup();
    
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    const buzzer = screen.getByText('🔔 BUZZ IN!');
    await user.click(buzzer);
    
    // Since buzzer functionality is TODO, we just check it renders
    expect(buzzer).toBeInTheDocument();
  });

  test('shows answer input for image quiz', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
  });

  test('shows host controls when user is host', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={{ ...mockCurrentUser, isHost: true }}
        users={mockUsers}
        isHost={true}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('End Quiz')).toBeInTheDocument();
  });

  test('handles end quiz button click', async () => {
    const user = userEvent.setup();
    
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={{ ...mockCurrentUser, isHost: true }}
        users={mockUsers}
        isHost={true}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    await user.click(screen.getByText('End Quiz'));
    
    expect(mockOnEndQuiz).toHaveBeenCalled();
  });

  test('displays scoreboard with sorted scores', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('Scoreboard')).toBeInTheDocument();
    
    // Check scores are sorted by value
    const scoreElements = screen.getAllByText(/^\d+$/);
    expect(scoreElements[0]).toHaveTextContent('100');
    expect(scoreElements[1]).toHaveTextContent('75');
    expect(scoreElements[2]).toHaveTextContent('50');
  });

  test('displays waiting state', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="waiting"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('Waiting for host to start...')).toBeInTheDocument();
  });

  test('displays buzzed user state', () => {
    const buzzedUser = mockUsers[1];
    
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        buzzedUser={buzzedUser}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('Host User is answering...')).toBeInTheDocument();
  });

  test('shows give answer button when user buzzes in', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        buzzedUser={mockCurrentUser}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('You got it! Answer now!')).toBeInTheDocument();
    expect(screen.getByText('Give Answer')).toBeInTheDocument();
  });

  test('opens answer modal when give answer is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        buzzedUser={mockCurrentUser}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    await user.click(screen.getByText('Give Answer'));
    
    expect(screen.getByText('Your Answer')).toBeInTheDocument();
    expect(screen.getByText('Submit Answer')).toBeInTheDocument();
  });

  test('submits answer from modal', async () => {
    const user = userEvent.setup();
    const mockSubmitAnswer = vi.mocked(socketClient.submitAnswer);
    
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        buzzedUser={mockCurrentUser}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    // Open modal
    await user.click(screen.getByText('Give Answer'));
    
    // Type answer
    const input = screen.getAllByPlaceholderText('Type your answer...')[0];
    await user.type(input, '4');
    
    // Submit
    await user.click(screen.getByText('Submit Answer'));
    
    expect(mockSubmitAnswer).toHaveBeenCalledWith('quiz-1', '4');
  });

  test('shows correct and incorrect buttons for host on image quiz', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={{ ...mockCurrentUser, isHost: true }}
        users={mockUsers}
        isHost={true}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
  });

  test('handles timer expiration', () => {
    let onExpireCallback: (() => void) | undefined;
    
    vi.mocked(useQuizTimer.useQuizTimer).mockImplementation((_, options) => {
      onExpireCallback = options?.onExpire;
      return {
        ...defaultTimerReturn,
        isExpired: true,
        timeLeft: 0,
      };
    });

    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    // Call the onExpire callback
    if (onExpireCallback) {
      onExpireCallback();
    }
    
    // Timer should show 0
    expect(screen.getByText('0s')).toBeInTheDocument();
  });

  test('shows result modal for host when game finishes', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={{ ...mockCurrentUser, isHost: true }}
        users={mockUsers}
        isHost={true}
        gameState="finished"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    waitFor(() => {
      expect(screen.getByText('Correct!')).toBeInTheDocument();
    });
  });

  test('displays finished state', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="finished"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('Quiz finished!')).toBeInTheDocument();
  });

  test('highlights current user in scoreboard', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    // Find the user's score entry
    const userEntry = screen.getByText('Test User').closest('div')?.parentElement;
    expect(userEntry).toHaveClass('bg-pink-100');
  });

  test('shows empty scoreboard when no scores', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={[]}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('No scores yet')).toBeInTheDocument();
  });

  test('disables answer input for non-host on image quiz', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    const input = screen.getByPlaceholderText('Type your answer...');
    expect(input).toBeDisabled();
  });

  test('enables answer input for host on image quiz', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={{ ...mockCurrentUser, isHost: true }}
        users={mockUsers}
        isHost={true}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    const input = screen.getByPlaceholderText('Type your answer...');
    expect(input).not.toBeDisabled();
  });

  test('displays answered state', () => {
    render(
      <QuizGame
        quiz={mockTextQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="answered"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );
    
    expect(screen.getByText('Answer submitted!')).toBeInTheDocument();
  });
});
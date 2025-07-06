/**
 * Quiz Game component unit tests
 * Tests quiz game functionality including buzzer, answer submission, and scoring
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizGame } from './QuizGame';
import type { Quiz, User, Score } from '../types';
import * as socketClient from '../lib/socketClient';
import * as userStorage from '../lib/userStorage';

// Mock dependencies
vi.mock('../lib/socketClient');
vi.mock('../lib/userStorage');

const mockSubmitAnswer = vi.mocked(socketClient.submitAnswer);
const mockGetUserName = vi.mocked(userStorage.getUserName);

describe('QuizGame', () => {
  const mockQuiz: Quiz = {
    id: 'quiz-1',
    type: 'text',
    question: 'What is the capital of Japan?',
    answer: 'Tokyo',
  };

  const mockImageQuiz: Quiz = {
    id: 'quiz-2',
    type: 'image',
    question: 'What anime is this character from?',
    answer: 'Naruto',
    image: {
      type: 'url',
      data: 'https://example.com/image.jpg',
    },
  };

  const mockUsers: User[] = [
    { id: 'user-1', name: 'Alice', isHost: true },
    { id: 'user-2', name: 'Bob', isHost: false },
    { id: 'user-3', name: 'Charlie', isHost: false },
  ];

  const mockCurrentUser: User = {
    id: 'user-2',
    name: 'Bob',
    isHost: false,
  };

  const mockScores: Score[] = [
    { userId: 'user-1', value: 10 },
    { userId: 'user-2', value: 5 },
    { userId: 'user-3', value: 3 },
  ];

  const mockOnEndQuiz = vi.fn();
  const mockOnNextQuiz = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserName.mockReturnValue('Bob');
  });

  it('renders quiz information correctly', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="waiting"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    expect(screen.getByText('Quiz Game')).toBeInTheDocument();
    expect(screen.getByText('Text Quiz')).toBeInTheDocument();
    expect(screen.getByText('What is the capital of Japan?')).toBeInTheDocument();
  });

  it('renders image quiz correctly', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="waiting"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    expect(screen.getByText('Image Quiz')).toBeInTheDocument();
    expect(screen.getByText('What anime is this character from?')).toBeInTheDocument();
    expect(screen.getByAltText('Quiz image')).toBeInTheDocument();
  });

  it('shows waiting state correctly', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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

  it('shows buzzer for text quiz in active state', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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
    expect(screen.getByText('Press the buzzer to answer!')).toBeInTheDocument();
  });

  it('shows answer input for image quiz in active state', () => {
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
    expect(screen.getByText('Your Answer')).toBeInTheDocument();
  });

  it('shows buzzed user state', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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

  it('shows other user answering state', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="active"
        scores={mockScores}
        buzzedUser={mockUsers[0]}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    expect(screen.getByText(/Alice is answering.../)).toBeInTheDocument();
  });

  it('shows answered state', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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

  it('shows finished state', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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

  it('displays scoreboard correctly', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="waiting"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    expect(screen.getByText('Scoreboard')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows empty scoreboard when no scores', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="waiting"
        scores={[]}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    expect(screen.getByText('No scores yet')).toBeInTheDocument();
  });

  it('opens answer modal when Give Answer is clicked', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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

    const giveAnswerButton = screen.getByText('Give Answer');
    fireEvent.click(giveAnswerButton);

    expect(screen.getByText('Your Answer')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
  });

  it('submits answer correctly', async () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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

    const giveAnswerButton = screen.getByText('Give Answer');
    fireEvent.click(giveAnswerButton);

    const answerInput = screen.getByPlaceholderText('Type your answer...');
    const submitButton = screen.getByText('Submit Answer');

    fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
    fireEvent.click(submitButton);

    expect(mockSubmitAnswer).toHaveBeenCalledWith('quiz-1', 'Tokyo');
  });

  it('disables submit button when answer is empty', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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

    const giveAnswerButton = screen.getByText('Give Answer');
    fireEvent.click(giveAnswerButton);

    const submitButton = screen.getByText('Submit Answer');
    expect(submitButton).toBeDisabled();
  });

  it('shows host controls for image quiz', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={mockCurrentUser}
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

  it('shows result modal for correct answer', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={true}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    const answerInput = screen.getByPlaceholderText('Type your answer...');
    const correctButton = screen.getByText('Correct');

    fireEvent.change(answerInput, { target: { value: 'Naruto' } });
    fireEvent.click(correctButton);

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText('Great job! That\'s correct!')).toBeInTheDocument();
    expect(screen.getByText(/Answer:/)).toBeInTheDocument();
    expect(screen.getByText('Naruto')).toBeInTheDocument();
  });

  it('shows result modal for incorrect answer', () => {
    render(
      <QuizGame
        quiz={mockImageQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={true}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    const answerInput = screen.getByPlaceholderText('Type your answer...');
    const incorrectButton = screen.getByText('Incorrect');

    fireEvent.change(answerInput, { target: { value: 'Wrong Answer' } });
    fireEvent.click(incorrectButton);

    expect(screen.getByText('Incorrect!')).toBeInTheDocument();
    expect(screen.getByText('Better luck next time!')).toBeInTheDocument();
  });

  it('calls onEndQuiz when End Quiz is clicked', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={true}
        gameState="active"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    const endQuizButton = screen.getByText('End Quiz');
    fireEvent.click(endQuizButton);

    expect(mockOnEndQuiz).toHaveBeenCalled();
  });

  it('calls onNextQuiz when Next Quiz is clicked', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="finished"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    // This test needs to be in active state with buzzed user
    render(
      <QuizGame
        quiz={mockQuiz}
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

    const giveAnswerButton = screen.getByText('Give Answer');
    fireEvent.click(giveAnswerButton);

    const answerInput = screen.getByPlaceholderText('Type your answer...');
    const submitButton = screen.getByText('Submit Answer');

    fireEvent.change(answerInput, { target: { value: 'Tokyo' } });
    fireEvent.click(submitButton);

    // Close result modal and click Next Quiz
    // Next Quiz button is only shown in finished state for host
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={true}
        gameState="finished"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    // Open result modal first by showing a result
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={true}
        gameState="finished"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    // Simulate showing result modal
    const resultModals = screen.getAllByText('Quiz finished!');
    expect(resultModals).toHaveLength(3); // Multiple instances due to re-rendering

    // Next Quiz button should be available in the modal
    const nextQuizButtons = screen.getAllByText('Next Quiz');
    fireEvent.click(nextQuizButtons[0]);

    expect(mockOnNextQuiz).toHaveBeenCalled();
  });

  it('shows timer in active state', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
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
    expect(screen.getByText('Time Left')).toBeInTheDocument();
  });

  it('does not show timer in non-active state', () => {
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="waiting"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    expect(screen.queryByText('Time Left')).not.toBeInTheDocument();
  });

  it('uses username from storage when available', () => {
    mockGetUserName.mockReturnValue('StoredName');
    
    render(
      <QuizGame
        quiz={mockQuiz}
        currentUser={mockCurrentUser}
        users={mockUsers}
        isHost={false}
        gameState="waiting"
        scores={mockScores}
        onEndQuiz={mockOnEndQuiz}
        onNextQuiz={mockOnNextQuiz}
      />
    );

    // The component should use the stored username
    expect(mockGetUserName).toHaveBeenCalled();
  });
}); 
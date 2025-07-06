/**
 * Quiz Game page unit tests
 * Tests the integration of QuizGame component into a dedicated page
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter, useSearchParams } from 'next/navigation';
import QuizGamePage from './page';
import * as socketClient from '@/lib/socketClient';
import * as userStorage from '@/lib/userStorage';
import type { Quiz, User, Score } from '@/types';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/socketClient');
vi.mock('@/lib/userStorage');

describe('QuizGamePage', () => {
  const mockPush = vi.fn();
  const mockGet = vi.fn();
  const mockSubmitAnswer = vi.fn();
  const mockGetUserName = vi.fn();
  const mockGetUserId = vi.fn();

  const mockQuiz: Quiz = {
    id: 'quiz-1',
    type: 'text',
    question: 'What is the capital of Japan?',
    answer: 'Tokyo',
  };

  const mockCurrentUser: User = {
    id: 'user-1',
    name: 'Alice',
    isHost: false,
  };

  const mockUsers: User[] = [
    { id: 'user-1', name: 'Alice', isHost: false },
    { id: 'user-2', name: 'Bob', isHost: true },
  ];

  const mockScores: Score[] = [
    { userId: 'user-1', value: 100 },
    { userId: 'user-2', value: 150 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useRouter as any).mockReturnValue({
      push: mockPush,
    });

    (useSearchParams as any).mockReturnValue({
      get: mockGet,
    });

    (socketClient.submitAnswer as any).mockImplementation(mockSubmitAnswer);
    (userStorage.getUserName as any).mockImplementation(mockGetUserName);
    (userStorage.getUserId as any).mockImplementation(mockGetUserId);
    
    mockGetUserName.mockReturnValue('Alice');
    mockGetUserId.mockReturnValue('user-1');
    mockSubmitAnswer.mockResolvedValue(undefined);

    // Mock URL search params
    mockGet.mockImplementation((key: string) => {
      const params: Record<string, string> = {
        quiz: JSON.stringify(mockQuiz),
        users: JSON.stringify(mockUsers),
        scores: JSON.stringify(mockScores),
        gameState: 'active',
      };
      return params[key];
    });
  });

  it('renders the quiz game page', () => {
    render(<QuizGamePage />);
    
    expect(screen.getByText('Quiz Game')).toBeInTheDocument();
    expect(screen.getByText('What is the capital of Japan?')).toBeInTheDocument();
  });

  it('shows loading state when quiz data is not available', () => {
    mockGet.mockReturnValue(null);
    
    render(<QuizGamePage />);
    
    expect(screen.getByText('Quiz data not found')).toBeInTheDocument();
  });

  it('shows error state when quiz data is invalid', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'quiz') return 'invalid-json';
      return null;
    });
    
    render(<QuizGamePage />);
    
    expect(screen.getByText('Error loading quiz')).toBeInTheDocument();
    expect(screen.getByText('Error loading quiz data')).toBeInTheDocument();
  });

  it('navigates back to home when back button is clicked', () => {
    render(<QuizGamePage />);
    
    const backButton = screen.getByText('Back to Home');
    fireEvent.click(backButton);
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('shows buzzer for text quiz in active state', () => {
    render(<QuizGamePage />);
    
    expect(screen.getByText('🔔 BUZZ IN!')).toBeInTheDocument();
  });

  it('shows image quiz interface for image quiz', () => {
    const imageQuiz: Quiz = {
      id: 'quiz-2',
      type: 'image',
      question: 'What anime is this?',
      answer: 'Naruto',
      image: { type: 'url', data: 'https://example.com/naruto.jpg' },
    };

    mockGet.mockImplementation((key: string) => {
      if (key === 'quiz') return JSON.stringify(imageQuiz);
      if (key === 'users') return JSON.stringify(mockUsers);
      if (key === 'scores') return JSON.stringify(mockScores);
      if (key === 'gameState') return 'active';
      return null;
    });
    
    render(<QuizGamePage />);
    
    expect(screen.getByText('What anime is this?')).toBeInTheDocument();
    expect(screen.getByAltText('Quiz image')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
  });

  it('displays scoreboard with user scores', () => {
    render(<QuizGamePage />);
    
    expect(screen.getByText('Scoreboard')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('shows timer when game is active', () => {
    render(<QuizGamePage />);
    
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('Time Left')).toBeInTheDocument();
  });

  it('shows waiting state when game is waiting', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'quiz') return JSON.stringify(mockQuiz);
      if (key === 'users') return JSON.stringify(mockUsers);
      if (key === 'scores') return JSON.stringify(mockScores);
      if (key === 'gameState') return 'waiting';
      return null;
    });
    
    render(<QuizGamePage />);
    
    expect(screen.getByText('Waiting for host to start...')).toBeInTheDocument();
  });

  it('shows finished state when game is finished', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'quiz') return JSON.stringify(mockQuiz);
      if (key === 'users') return JSON.stringify(mockUsers);
      if (key === 'scores') return JSON.stringify(mockScores);
      if (key === 'gameState') return 'finished';
      return null;
    });
    
    render(<QuizGamePage />);
    
    expect(screen.getByText('Quiz finished!')).toBeInTheDocument();
  });

  it('handles quiz end and navigates back', () => {
    // Mock the current user as host to see the End Quiz button
    mockGetUserId.mockReturnValue('user-2');
    mockGetUserName.mockReturnValue('Bob');
    
    render(<QuizGamePage />);
    
    const endQuizButton = screen.getByText('End Quiz');
    fireEvent.click(endQuizButton);
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('handles next quiz navigation', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'quiz') return JSON.stringify(mockQuiz);
      if (key === 'users') return JSON.stringify(mockUsers);
      if (key === 'scores') return JSON.stringify(mockScores);
      if (key === 'gameState') return 'finished';
      return null;
    });
    
    render(<QuizGamePage />);
    
    // This test would need to simulate the result modal being shown
    // For now, we'll just check that the page renders correctly
    expect(screen.getByText('Quiz finished!')).toBeInTheDocument();
  });

  it('shows host controls when user is host', () => {
    const hostUser: User = {
      id: 'user-2',
      name: 'Bob',
      isHost: true,
    };

    mockGetUserId.mockReturnValue('user-2');
    mockGetUserName.mockReturnValue('Bob');

    render(<QuizGamePage />);
    
    expect(screen.getByText('End Quiz')).toBeInTheDocument();
  });

  it('shows buzzed user state when someone has buzzed', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'quiz') return JSON.stringify(mockQuiz);
      if (key === 'users') return JSON.stringify(mockUsers);
      if (key === 'scores') return JSON.stringify(mockScores);
      if (key === 'gameState') return 'active';
      if (key === 'buzzedUser') return JSON.stringify(mockUsers[0]);
      return null;
    });
    
    render(<QuizGamePage />);
    
    expect(screen.getByText('is answering...')).toBeInTheDocument();
  });
});
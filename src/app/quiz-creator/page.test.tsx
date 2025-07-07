/**
 * Quiz Creator page unit tests
 * Tests the integration of QuizCreator component into a dedicated page
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import QuizCreatorPage from './page';
import * as socketClient from '@/lib/socketClient';
import * as userStorage from '@/lib/userStorage';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/socketClient');
vi.mock('@/lib/userStorage');

describe('QuizCreatorPage', () => {
  const mockPush = vi.fn();
  const mockAddQuiz = vi.fn();
  const mockGetUserName = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    } as unknown as { push: typeof mockPush });

    (socketClient.addQuiz as ReturnType<typeof vi.fn>).mockImplementation(mockAddQuiz);
    (userStorage.getUserName as ReturnType<typeof vi.fn>).mockImplementation(mockGetUserName);
    
    mockGetUserName.mockReturnValue('TestUser');
    mockAddQuiz.mockResolvedValue(undefined);
  });

  it('renders the quiz creator page', () => {
    render(<QuizCreatorPage />);
    
    expect(screen.getByRole('heading', { name: 'Create Quiz' })).toBeInTheDocument();
    expect(screen.getByText('Quiz Creator')).toBeInTheDocument();
    expect(screen.getByText('Create amazing quizzes for your room!')).toBeInTheDocument();
  });

  it('shows the quiz creator modal by default', () => {
    render(<QuizCreatorPage />);
    
    expect(screen.getByText('Create New Quiz')).toBeInTheDocument();
    expect(screen.getByText('Quiz Type')).toBeInTheDocument();
    expect(screen.getByText('Text Quiz')).toBeInTheDocument();
    expect(screen.getByText('Image Quiz')).toBeInTheDocument();
  });

  it('navigates back to home when back button is clicked', () => {
    render(<QuizCreatorPage />);
    
    const backButton = screen.getByText('Back to Home');
    fireEvent.click(backButton);
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('navigates back to home when quiz is created successfully', async () => {
    render(<QuizCreatorPage />);
    
    // Fill out the form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });
    
    // Submit the form
    const createButton = screen.getByRole('button', { name: 'Create Quiz' });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockAddQuiz).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'text',
        question: 'What is 2+2?',
        answer: '4',
      });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message when quiz creation fails', async () => {
    mockAddQuiz.mockRejectedValue(new Error('Network error'));
    
    render(<QuizCreatorPage />);
    
    // Fill out the form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });
    
    // Submit the form
    const createButton = screen.getByRole('button', { name: 'Create Quiz' });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to create quiz. Please try again.')).toBeInTheDocument();
    });
  });

  it('handles quiz creation with image type', async () => {
    render(<QuizCreatorPage />);
    
    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);
    
    // Fill out the form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    const imageUrlInput = screen.getByPlaceholderText('https://example.com/image.jpg');
    
    fireEvent.change(questionInput, { target: { value: 'What anime is this?' } });
    fireEvent.change(answerInput, { target: { value: 'Naruto' } });
    fireEvent.change(imageUrlInput, { target: { value: 'https://example.com/naruto.jpg' } });
    
    // Submit the form
    const createButton = screen.getByRole('button', { name: 'Create Quiz' });
    fireEvent.click(createButton);
    
    await waitFor(() => {
      expect(mockAddQuiz).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'image',
        question: 'What anime is this?',
        answer: 'Naruto',
        image: { type: 'url', data: 'https://example.com/naruto.jpg' },
      });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows loading state during quiz creation', async () => {
    // Mock addQuiz to return a promise that doesn't resolve immediately
    mockAddQuiz.mockImplementation(() => new Promise(() => {}));
    
    render(<QuizCreatorPage />);
    
    // Fill out the form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });
    
    // Submit the form
    const createButton = screen.getByRole('button', { name: 'Create Quiz' });
    fireEvent.click(createButton);
    
    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(createButton).toBeDisabled();
  });

  it('navigates back to home when modal is closed', () => {
    render(<QuizCreatorPage />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
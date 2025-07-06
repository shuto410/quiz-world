/**
 * Quiz Creator component unit tests
 * Tests quiz creation functionality including form validation and image handling
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuizCreator } from './QuizCreator';
import * as socketClient from '../lib/socketClient';

// Mock dependencies
vi.mock('../lib/socketClient');

const mockAddQuiz = vi.mocked(socketClient.addQuiz);

describe('QuizCreator', () => {
  const mockOnClose = vi.fn();
  const mockOnQuizCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quiz creator modal when open', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    expect(screen.getByText('Create New Quiz')).toBeInTheDocument();
    expect(screen.getByText('Quiz Type')).toBeInTheDocument();
    expect(screen.getByText('Text Quiz')).toBeInTheDocument();
    expect(screen.getByText('Image Quiz')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <QuizCreator
        isOpen={false}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    expect(screen.queryByText('Create New Quiz')).not.toBeInTheDocument();
  });

  it('starts with text quiz type selected', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const textQuizButton = screen.getByText('Text Quiz').closest('button');
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');

    expect(textQuizButton).toHaveClass('border-pink-500', 'bg-pink-50');
    expect(imageQuizButton).toHaveClass('border-gray-300', 'bg-white');
  });

  it('switches to image quiz type when clicked', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    expect(imageQuizButton).toHaveClass('border-pink-500', 'bg-pink-50');
    expect(screen.getByText('Image')).toBeInTheDocument();
  });

  it('shows image input fields when image quiz is selected', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeInTheDocument();
    expect(screen.getByText('Upload Image')).toBeInTheDocument();
  });

  it('handles question input correctly', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const questionInput = screen.getByPlaceholderText('Enter your question...');
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });

    expect(questionInput).toHaveValue('What is 2+2?');
  });

  it('handles answer input correctly', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    fireEvent.change(answerInput, { target: { value: '4' } });

    expect(answerInput).toHaveValue('4');
  });

  it('handles image URL input correctly', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    const imageUrlInput = screen.getByPlaceholderText('https://example.com/image.jpg');
    fireEvent.change(imageUrlInput, { target: { value: 'https://example.com/test.jpg' } });

    expect(imageUrlInput).toHaveValue('https://example.com/test.jpg');
  });

  it('shows preview when question is entered', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const questionInput = screen.getByPlaceholderText('Enter your question...');
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByDisplayValue('What is 2+2?')).toBeInTheDocument();
  });

  it('shows image preview for image quiz', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    // Enter question and image URL
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const imageUrlInput = screen.getByPlaceholderText('https://example.com/image.jpg');
    
    fireEvent.change(questionInput, { target: { value: 'What anime is this?' } });
    fireEvent.change(imageUrlInput, { target: { value: 'https://example.com/test.jpg' } });

    expect(screen.getByText('Image:')).toBeInTheDocument();
    expect(screen.getByAltText('Preview')).toBeInTheDocument();
  });

  it('validates required fields for text quiz', async () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const createButton = screen.getByText('Create Quiz');
    fireEvent.click(createButton);

    expect(screen.getByText('Question is required')).toBeInTheDocument();
    expect(screen.getByText('Answer is required')).toBeInTheDocument();
  });

  it('validates image is required for image quiz', async () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    // Fill question and answer but not image
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What anime is this?' } });
    fireEvent.change(answerInput, { target: { value: 'Naruto' } });

    const createButton = screen.getByText('Create Quiz');
    fireEvent.click(createButton);

    expect(screen.getByText('Image is required for image quiz')).toBeInTheDocument();
  });

  it('creates text quiz successfully', async () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Fill form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });

    const createButton = screen.getByText('Create Quiz');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAddQuiz).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'text',
        question: 'What is 2+2?',
        answer: '4',
      });
      expect(mockOnQuizCreated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('creates image quiz successfully', async () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    // Fill form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    const imageUrlInput = screen.getByPlaceholderText('https://example.com/image.jpg');
    
    fireEvent.change(questionInput, { target: { value: 'What anime is this?' } });
    fireEvent.change(answerInput, { target: { value: 'Naruto' } });
    fireEvent.change(imageUrlInput, { target: { value: 'https://example.com/test.jpg' } });

    const createButton = screen.getByText('Create Quiz');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockAddQuiz).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'image',
        question: 'What anime is this?',
        answer: 'Naruto',
        image: {
          type: 'url',
          data: 'https://example.com/test.jpg',
        },
      });
      expect(mockOnQuizCreated).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles file upload correctly', async () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    // Mock file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText('Upload Image');
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('test.jpg')).toBeInTheDocument();
  });

  it('clears errors when user starts typing', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Trigger validation error
    const createButton = screen.getByText('Create Quiz');
    fireEvent.click(createButton);

    expect(screen.getByText('Question is required')).toBeInTheDocument();

    // Start typing
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    fireEvent.change(questionInput, { target: { value: 'Test' } });

    expect(screen.queryByText('Question is required')).not.toBeInTheDocument();
  });

  it('resets form when modal is closed', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Fill some data
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    fireEvent.change(questionInput, { target: { value: 'Test question' } });

    // Close modal
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();

    // Reopen and check form is reset
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    const newQuestionInputs = screen.getAllByPlaceholderText('Enter your question...');
    expect(newQuestionInputs[0]).toHaveValue('');
  });

  it('shows loading state during submission', async () => {
    // Mock addQuiz to return a promise that doesn't resolve immediately
    mockAddQuiz.mockImplementation(() => new Promise(() => {}));

    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Fill form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });

    const createButton = screen.getByText('Create Quiz');
    fireEvent.click(createButton);

    expect(screen.getByText(/Creating/)).toBeInTheDocument();
    expect(createButton).toBeDisabled();
  });

  it('handles submission error gracefully', async () => {
    mockAddQuiz.mockRejectedValue(new Error('Network error'));

    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Fill form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });

    const createButton = screen.getByText('Create Quiz');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to create quiz/)).toBeInTheDocument();
    });
  });

  it('switches between URL and file upload correctly', () => {
    render(
      <QuizCreator
        isOpen={true}
        onClose={mockOnClose}
        onQuizCreated={mockOnQuizCreated}
      />
    );

    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    // Enter URL
    const imageUrlInput = screen.getByPlaceholderText('https://example.com/image.jpg');
    fireEvent.change(imageUrlInput, { target: { value: 'https://example.com/test.jpg' } });

    // Upload file
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const fileInput = screen.getByLabelText('Upload Image');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // URL should be cleared when file is selected
    expect(imageUrlInput).toHaveValue('');
    expect(screen.getByText('test.jpg')).toBeInTheDocument();
  });
}); 
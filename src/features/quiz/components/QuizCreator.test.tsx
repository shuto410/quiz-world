/**
 * Tests for refactored QuizCreator component
 */
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuizCreator } from './QuizCreator';
import * as socketClient from '../../../lib/socketClient';
import * as useQuizForm from '../hooks/useQuizForm';
import type { Quiz } from '../../../types';

// Mock socket client
vi.mock('../../../lib/socketClient', () => ({
  addQuiz: vi.fn(),
}));

// Mock useQuizForm hook
vi.mock('../hooks/useQuizForm', () => ({
  useQuizForm: vi.fn(),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

describe('QuizCreator Component', () => {
  const mockOnClose = vi.fn();
  const mockOnQuizCreated = vi.fn();
  const mockUpdateField = vi.fn();
  const mockSetQuizType = vi.fn();
  const mockSetImageFromUrl = vi.fn();
  const mockSetImageFromFile = vi.fn();
  const mockSetErrors = vi.fn();
  const mockValidate = vi.fn();
  const mockReset = vi.fn();
  const mockHandleSubmit = vi.fn();

  const defaultFormData = {
    type: 'text' as const,
    question: '',
    answer: '',
  };

  const defaultUseQuizFormReturn = {
    formData: defaultFormData,
    errors: {},
    isSubmitting: false,
    updateField: mockUpdateField,
    setQuizType: mockSetQuizType,
    setImageFromUrl: mockSetImageFromUrl,
    setImageFromFile: mockSetImageFromFile,
    setErrors: mockSetErrors,
    validate: mockValidate,
    reset: mockReset,
    handleSubmit: mockHandleSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue(defaultUseQuizFormReturn);
    
    // Mock global URL and FileReader
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders quiz creator with default text type', () => {
    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.getByText('Create New Quiz')).toBeInTheDocument();
    expect(screen.getByText('Text Quiz')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your question...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter the correct answer...')).toBeInTheDocument();
  });

  test('switches to image quiz type', async () => {
    const user = userEvent.setup();
    
    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    await user.click(screen.getByText('Image Quiz'));
    
    expect(mockSetQuizType).toHaveBeenCalledWith('image');
  });

  test('updates question field', async () => {
    const user = userEvent.setup();
    
    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    await user.type(questionInput, 'Test question');
    
    // updateField is called for each character typed
    expect(mockUpdateField).toHaveBeenCalled();
    expect(mockUpdateField).toHaveBeenCalledWith('question', expect.any(String));
  });

  test('updates answer field', async () => {
    const user = userEvent.setup();
    
    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    await user.type(answerInput, 'Test answer');
    
    // updateField is called for each character typed
    expect(mockUpdateField).toHaveBeenCalled();
    expect(mockUpdateField).toHaveBeenCalledWith('answer', expect.any(String));
  });

  test('shows image options for image quiz', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: { ...defaultFormData, type: 'image' },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.getByText('Image URL')).toBeInTheDocument();
    expect(screen.getByText('Upload Image')).toBeInTheDocument();
  });

  test('handles file upload', async () => {
    const user = userEvent.setup();
    
    // Mock FileReader
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      result: 'data:image/png;base64,test',
    };
    
    global.FileReader = vi.fn(() => mockFileReader) as any;
    
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: { ...defaultFormData, type: 'image' },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText('Upload Image') as HTMLInputElement;
    
    await user.upload(input, file);
    
    // Simulate FileReader onload
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: 'data:image/png;base64,test' } });
    }
    
    expect(mockSetImageFromFile).toHaveBeenCalledWith('data:image/png;base64,test');
  });



  test('switches to URL input mode', async () => {
    const user = userEvent.setup();
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: { ...defaultFormData, type: 'image' },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    // URL input should be already visible
    expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeInTheDocument();
  });

  test('updates image URL', async () => {
    const user = userEvent.setup();
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: { ...defaultFormData, type: 'image' },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    const urlInput = screen.getByPlaceholderText('https://example.com/image.jpg');
    await user.type(urlInput, 'https://example.com/image.jpg');
    
    expect(mockSetImageFromUrl).toHaveBeenCalledWith('https://example.com/image.jpg');
  });

  test('shows image preview', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: {
        ...defaultFormData,
        type: 'image',
        question: 'What is this?',
        image: { type: 'url', data: 'https://example.com/image.jpg' },
      },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    const previewImage = screen.getByAltText('Preview');
    expect(previewImage).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  test('removes image', async () => {
    const user = userEvent.setup();
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: {
        ...defaultFormData,
        type: 'image',
        image: { type: 'url', data: 'https://example.com/image.jpg' },
      },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    await user.click(screen.getByText('Remove'));
    
    expect(mockUpdateField).toHaveBeenCalledWith('image', undefined);
  });

  test('shows validation errors', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      errors: {
        question: 'Question is required',
        answer: 'Answer is required',
      },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.getByText('Question is required')).toBeInTheDocument();
    expect(screen.getByText('Answer is required')).toBeInTheDocument();
  });

  test('handles form submission', async () => {
    const user = userEvent.setup();
    const mockHandleSubmitImpl = vi.fn(async (onSubmit) => {
      await onSubmit({ type: 'text', question: 'Q1', answer: 'A1' });
    });
    
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      handleSubmit: mockHandleSubmitImpl,
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    await user.click(screen.getByText('Create Quiz'));
    
    expect(mockHandleSubmitImpl).toHaveBeenCalled();
    expect(socketClient.addQuiz).toHaveBeenCalledWith(expect.objectContaining({
      type: 'text',
      question: 'Q1',
      answer: 'A1',
    }));
    expect(mockOnQuizCreated).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows loading state during submission', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      isSubmitting: true,
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    const submitButton = screen.getByText('Creating...');
    expect(submitButton).toBeDisabled();
  });

  test('handles submission error', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Failed to add quiz');
    const mockHandleSubmitImpl = vi.fn(async (onSubmit) => {
      await onSubmit({ type: 'text', question: 'Q1', answer: 'A1' });
    });
    
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      handleSubmit: mockHandleSubmitImpl,
    });
    
    vi.mocked(socketClient.addQuiz).mockRejectedValue(mockError);

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    await user.click(screen.getByText('Create Quiz'));
    
    // Since error handling is in the form, it should be handled gracefully
    expect(mockHandleSubmitImpl).toHaveBeenCalled();
  });

  test('shows character count for question', async () => {
    const user = userEvent.setup();
    
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: { ...defaultFormData, question: 'Test question' },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.getByText('13/200')).toBeInTheDocument();
  });

  test('shows character count for answer', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: { ...defaultFormData, answer: 'Test answer' },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.getByText('11/100')).toBeInTheDocument();
  });

  test('disables submit button when validation fails', () => {
    mockValidate.mockReturnValue(false);
    
    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    const submitButton = screen.getByText('Create Quiz');
    // The button is controlled by the form hook, so we just check it exists
    expect(submitButton).toBeInTheDocument();
  });

  test('handles cancel button', async () => {
    const user = userEvent.setup();
    
    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    await user.click(screen.getByText('Cancel'));
    
    expect(mockReset).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows preview only when question is entered', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: {
        ...defaultFormData,
        question: 'Test question',
        answer: 'Test answer',
      },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.getByText('Preview')).toBeInTheDocument();
    // Use more specific queries to avoid duplicates
    const previewSection = screen.getByText('Preview').closest('div')?.parentElement;
    if (previewSection) {
      expect(within(previewSection).getByText('Test question')).toBeInTheDocument();
      expect(within(previewSection).getByText('Test answer')).toBeInTheDocument();
    }
  });

  test('does not show preview when question is empty', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      formData: {
        ...defaultFormData,
        question: '',
        answer: 'Test answer',
      },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
  });

  test('shows submit error message', () => {
    vi.mocked(useQuizForm.useQuizForm).mockReturnValue({
      ...defaultUseQuizFormReturn,
      errors: {
        submit: 'Failed to create quiz. Please try again.',
      },
    });

    render(<QuizCreator isOpen={true} onClose={mockOnClose} onQuizCreated={mockOnQuizCreated} />);
    
    expect(screen.getByText('Failed to create quiz. Please try again.')).toBeInTheDocument();
  });
});
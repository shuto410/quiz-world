/**
 * Tests for useQuizForm hook
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizForm } from './useQuizForm';

describe('useQuizForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useQuizForm());
    
    expect(result.current.formData).toEqual({
      type: 'text',
      question: '',
      answer: '',
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
  });

  test('should update form field', () => {
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.updateField('question', 'What is 2 + 2?');
    });
    
    expect(result.current.formData.question).toBe('What is 2 + 2?');
    
    act(() => {
      result.current.updateField('answer', '4');
    });
    
    expect(result.current.formData.answer).toBe('4');
  });

  test('should change quiz type', () => {
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.setQuizType('image');
    });
    
    expect(result.current.formData.type).toBe('image');
  });

  test('should clear error when field is updated', () => {
    const { result } = renderHook(() => useQuizForm());
    
    // Set an error
    act(() => {
      result.current.setErrors({ question: 'Question is required' });
    });
    
    expect(result.current.errors.question).toBe('Question is required');
    
    // Update the field
    act(() => {
      result.current.updateField('question', 'New question');
    });
    
    expect(result.current.errors.question).toBeUndefined();
  });

  test('should validate empty form', () => {
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      const isValid = result.current.validate();
      expect(isValid).toBe(false);
    });
    
    expect(result.current.errors).toEqual({
      question: 'Question is required',
      answer: 'Answer is required',
    });
  });

  test('should validate text quiz successfully', () => {
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.updateField('question', 'What is React?');
      result.current.updateField('answer', 'A JavaScript library');
    });
    
    act(() => {
      const isValid = result.current.validate();
      expect(isValid).toBe(true);
    });
    
    expect(result.current.errors).toEqual({});
  });

  test('should validate image quiz requires image', () => {
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.setQuizType('image');
      result.current.updateField('question', 'Who is this character?');
      result.current.updateField('answer', 'Naruto');
    });
    
    act(() => {
      const isValid = result.current.validate();
      expect(isValid).toBe(false);
    });
    
    expect(result.current.errors).toEqual({
      image: 'Image is required for image quiz',
    });
  });

  test('should trim whitespace in validation', () => {
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.updateField('question', '  ');
      result.current.updateField('answer', '  ');
    });
    
    act(() => {
      const isValid = result.current.validate();
      expect(isValid).toBe(false);
    });
    
    expect(result.current.errors).toEqual({
      question: 'Question is required',
      answer: 'Answer is required',
    });
  });

  test('should set image from URL', () => {
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.setImageFromUrl('https://example.com/image.jpg');
    });
    
    expect(result.current.formData.image).toEqual({
      type: 'url',
      data: 'https://example.com/image.jpg',
    });
  });

  test('should set image from file', () => {
    const { result } = renderHook(() => useQuizForm());
    const base64Data = 'data:image/png;base64,iVBORw0KGgo...';
    
    act(() => {
      result.current.setImageFromFile(base64Data);
    });
    
    expect(result.current.formData.image).toEqual({
      type: 'upload',
      data: base64Data,
    });
  });

  test('should clear image when empty URL is set', () => {
    const { result } = renderHook(() => useQuizForm());
    
    // Set an image first
    act(() => {
      result.current.setImageFromUrl('https://example.com/image.jpg');
    });
    
    expect(result.current.formData.image).toBeDefined();
    
    // Clear it with empty URL
    act(() => {
      result.current.setImageFromUrl('');
    });
    
    expect(result.current.formData.image).toBeUndefined();
  });

  test('should reset form', () => {
    const { result } = renderHook(() => useQuizForm());
    
    // Set some data
    act(() => {
      result.current.updateField('question', 'Test question');
      result.current.updateField('answer', 'Test answer');
      result.current.setQuizType('image');
      result.current.setImageFromUrl('https://example.com/image.jpg');
      result.current.setErrors({ question: 'Error' });
    });
    
    // Reset
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.formData).toEqual({
      type: 'text',
      question: '',
      answer: '',
    });
    expect(result.current.errors).toEqual({});
  });

  test('should handle form submission', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.updateField('question', 'What is TypeScript?');
      result.current.updateField('answer', 'A typed superset of JavaScript');
    });
    
    await act(async () => {
      await result.current.handleSubmit(onSubmit);
    });
    
    expect(onSubmit).toHaveBeenCalledWith({
      type: 'text',
      question: 'What is TypeScript?',
      answer: 'A typed superset of JavaScript',
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  test('should not submit invalid form', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useQuizForm());
    
    await act(async () => {
      await result.current.handleSubmit(onSubmit);
    });
    
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors).toHaveProperty('question');
    expect(result.current.errors).toHaveProperty('answer');
  });

  test('should handle submission error', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useQuizForm());
    
    act(() => {
      result.current.updateField('question', 'Question');
      result.current.updateField('answer', 'Answer');
    });
    
    await act(async () => {
      await result.current.handleSubmit(onSubmit);
    });
    
    expect(result.current.errors.submit).toBe('Failed to create quiz. Please try again.');
    expect(result.current.isSubmitting).toBe(false);
  });
});
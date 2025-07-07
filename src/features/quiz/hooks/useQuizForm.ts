/**
 * Hook for managing quiz form state
 */
import { useState, useCallback } from 'react';
import type { ImageResource } from '@/types';

export interface QuizFormData {
  type: 'text' | 'image';
  question: string;
  answer: string;
  image?: ImageResource;
}

export interface UseQuizFormReturn {
  formData: QuizFormData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  updateField: (field: keyof QuizFormData, value: string) => void;
  setQuizType: (type: 'text' | 'image') => void;
  setImageFromUrl: (url: string) => void;
  setImageFromFile: (base64Data: string) => void;
  setErrors: (errors: Record<string, string>) => void;
  validate: () => boolean;
  reset: () => void;
  handleSubmit: (onSubmit: (data: QuizFormData) => Promise<void>) => Promise<void>;
}

const initialFormData: QuizFormData = {
  type: 'text',
  question: '',
  answer: '',
};

export function useQuizForm(): UseQuizFormReturn {
  const [formData, setFormData] = useState<QuizFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = useCallback((field: keyof QuizFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const setQuizType = useCallback((type: 'text' | 'image') => {
    setFormData(prev => ({ ...prev, type }));
    // Clear image when switching to text type
    if (type === 'text') {
      setFormData(prev => {
        const { image, ...rest } = prev;
        return { ...rest, type };
      });
    }
  }, []);

  const setImageFromUrl = useCallback((url: string) => {
    if (url.trim()) {
      setFormData(prev => ({
        ...prev,
        image: { type: 'url', data: url.trim() }
      }));
    } else {
      setFormData(prev => {
        const { image, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  const setImageFromFile = useCallback((base64Data: string) => {
    setFormData(prev => ({
      ...prev,
      image: { type: 'upload', data: base64Data }
    }));
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.question.trim()) {
      newErrors.question = 'Question is required';
    }

    if (!formData.answer.trim()) {
      newErrors.answer = 'Answer is required';
    }

    if (formData.type === 'image' && !formData.image) {
      newErrors.image = 'Image is required for image quiz';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const reset = useCallback(() => {
    setFormData(initialFormData);
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const handleSubmit = useCallback(async (onSubmit: (data: QuizFormData) => Promise<void>) => {
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to create quiz:', error);
      setErrors({ submit: 'Failed to create quiz. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validate]);

  return {
    formData,
    errors,
    isSubmitting,
    updateField,
    setQuizType,
    setImageFromUrl,
    setImageFromFile,
    setErrors,
    validate,
    reset,
    handleSubmit,
  };
}
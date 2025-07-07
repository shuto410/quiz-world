/**
 * Quiz Creator component for Quiz World application
 * - Creates both text and image quiz types
 * - Supports image upload and URL input
 * - Validates quiz data before submission
 * - Follows anime pop style design
 */

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import type { Quiz, ImageResource } from '../types';
import { addQuiz } from '../lib/socketClient';

/**
 * Quiz Creator props interface
 */
export interface QuizCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizCreated?: (quiz: Quiz) => void;
  className?: string;
}

/**
 * Quiz form data interface
 */
interface QuizFormData {
  type: 'text' | 'image';
  question: string;
  answer: string;
  image?: ImageResource;
}

/**
 * Quiz Creator component with anime pop style
 */
export function QuizCreator({ isOpen, onClose, onQuizCreated }: QuizCreatorProps) {
  const [formData, setFormData] = useState<QuizFormData>({
    type: 'text',
    question: '',
    answer: '',
  });
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Reset form data
   */
  const resetForm = () => {
    setFormData({
      type: 'text',
      question: '',
      answer: '',
    });
    setImageUrl('');
    setImageFile(null);
    setErrors({});
  };

  /**
   * Handle form field changes
   */
  const handleFieldChange = (field: keyof QuizFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /**
   * Handle quiz type change
   */
  const handleTypeChange = (type: 'text' | 'image') => {
    setFormData(prev => ({ ...prev, type }));
    setImageUrl('');
    setImageFile(null);
    setErrors({});
  };

  /**
   * Handle image URL input
   */
  const handleImageUrlChange = (url: string) => {
    setImageUrl(url);
    setImageFile(null);
    
    if (url.trim()) {
      setFormData(prev => ({
        ...prev,
        image: { type: 'url', data: url.trim() }
      }));
    } else {
      setFormData(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { image, ...rest } = prev;
        return rest;
      });
    }
  };

  /**
   * Handle image file selection
   */
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl('');
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setFormData(prev => ({
          ...prev,
          image: { type: 'upload', data: base64 }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
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
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const quiz: Quiz = {
        id: Date.now().toString(), // Temporary ID, server will assign real one
        type: formData.type,
        question: formData.question.trim(),
        answer: formData.answer.trim(),
        ...(formData.image && { image: formData.image }),
      };

      await addQuiz(quiz);
      onQuizCreated?.(quiz);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to create quiz:', error);
      setErrors({ submit: 'Failed to create quiz. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Quiz"
      size="lg"
    >
      <div className="space-y-6">
        {/* Quiz Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Quiz Type
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleTypeChange('text')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                formData.type === 'text'
                  ? 'border-pink-500 bg-pink-50 text-pink-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="font-medium">Text Quiz</div>
              <div className="text-sm opacity-75">Buzzer-style questions</div>
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('image')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                formData.type === 'image'
                  ? 'border-pink-500 bg-pink-50 text-pink-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-2">🖼️</div>
              <div className="font-medium">Image Quiz</div>
              <div className="text-sm opacity-75">Anime character questions</div>
            </button>
          </div>
        </div>

        {/* Question Input */}
        <div>
          <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
            Question
          </label>
          <textarea
            id="question"
            value={formData.question}
            onChange={(e) => handleFieldChange('question', e.target.value)}
            placeholder="Enter your question..."
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none ${
              errors.question ? 'border-red-500' : 'border-gray-300'
            }`}
            rows={3}
          />
          {errors.question && (
            <p className="mt-1 text-sm text-red-600">{errors.question}</p>
          )}
        </div>

        {/* Image Input for Image Quiz */}
        {formData.type === 'image' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Image
            </label>
            
            {/* Image URL Input */}
            <div className="mb-4">
              <label htmlFor="imageUrl" className="block text-sm text-gray-600 mb-2">
                Image URL
              </label>
              <input
                id="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => handleImageUrlChange(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            {/* Or Divider */}
            <div className="flex items-center mb-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-3 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            {/* Image File Upload */}
            <div>
              <label htmlFor="imageFile" className="block text-sm text-gray-600 mb-2">
                Upload Image
              </label>
              <input
                ref={fileInputRef}
                id="imageFile"
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition-colors"
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">📁</div>
                  <div className="text-gray-600">
                    {imageFile ? imageFile.name : 'Click to select image'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    PNG, JPG, GIF up to 5MB
                  </div>
                </div>
              </button>
            </div>

            {errors.image && (
              <p className="mt-2 text-sm text-red-600">{errors.image}</p>
            )}
          </div>
        )}

        {/* Answer Input */}
        <div>
          <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
            Answer
          </label>
          <input
            id="answer"
            type="text"
            value={formData.answer}
            onChange={(e) => handleFieldChange('answer', e.target.value)}
            placeholder="Enter the correct answer..."
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
              errors.answer ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.answer && (
            <p className="mt-1 text-sm text-red-600">{errors.answer}</p>
          )}
        </div>

        {/* Preview */}
        {formData.question && (
          <Card variant="elevated">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-800">Preview</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Question:</span>
                  <p className="text-gray-800">{formData.question}</p>
                </div>
                {formData.type === 'image' && formData.image && (
                  <div>
                    <span className="text-sm text-gray-600">Image:</span>
                    <div className="mt-2">
                      <Image
                        src={formData.image.type === 'url' ? formData.image.data : formData.image.data}
                        alt="Preview"
                        width={200}
                        height={128}
                        className="max-w-full max-h-32 rounded-lg object-cover"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-600">Answer:</span>
                  <p className="text-gray-800">{formData.answer}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Creating...' : 'Create Quiz'}
          </Button>
        </div>
      </div>
    </Modal>
  );
} 
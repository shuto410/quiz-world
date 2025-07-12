/**
 * Refactored Quiz Creator component for Quiz World application
 * - Split into smaller, focused components
 * - Uses custom hooks for form management
 * - Maintains anime pop style design
 */

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { Quiz } from '@/types';
import { addQuiz } from '@/lib/socketClient';
import { useQuizForm } from '../hooks/useQuizForm';

/**
 * Quiz type selector component
 */
interface QuizTypeSelectorProps {
  selectedType: 'text' | 'image';
  onTypeChange: (type: 'text' | 'image') => void;
}

function QuizTypeSelector({ selectedType, onTypeChange }: QuizTypeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Quiz Type
      </label>
      <div className="flex gap-4">
        <TypeButton
          type="text"
          isSelected={selectedType === 'text'}
          onClick={() => onTypeChange('text')}
          icon="📝"
          title="Text Quiz"
          description="Buzzer-style questions"
        />
        <TypeButton
          type="image"
          isSelected={selectedType === 'image'}
          onClick={() => onTypeChange('image')}
          icon="🖼️"
          title="Image Quiz"
          description="Anime character questions"
        />
      </div>
    </div>
  );
}

/**
 * Quiz type button
 */
interface TypeButtonProps {
  type: 'text' | 'image';
  isSelected: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  description: string;
}

function TypeButton({ isSelected, onClick, icon, title, description }: TypeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 p-4 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-pink-500 bg-pink-50 text-pink-700'
          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-medium">{title}</div>
      <div className="text-sm opacity-75">{description}</div>
    </button>
  );
}

/**
 * Form input component
 */
interface FormInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  multiline?: boolean;
}

function FormInput({ id, label, value, onChange, placeholder, error, multiline }: FormInputProps) {
  const inputClasses = `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none ${
    error ? 'border-red-500' : 'border-gray-300'
  }`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClasses}
          rows={3}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClasses}
        />
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

/**
 * Image input component
 */
interface ImageInputProps {
  onUrlChange: (url: string) => void;
  onFileChange: (base64: string) => void;
  error?: string;
}

function ImageInput({ onUrlChange, onFileChange, error }: ImageInputProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    setImageFile(null);
    onUrlChange(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl('');
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onFileChange(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
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
          onChange={(e) => handleUrlChange(e.target.value)}
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
          onChange={handleFileChange}
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

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

/**
 * Quiz preview component
 */
interface QuizPreviewProps {
  formData: {
    type: 'text' | 'image';
    question: string;
    answer: string;
    image?: { type: 'url' | 'upload'; data: string };
  };
}

function QuizPreview({ formData }: QuizPreviewProps) {
  if (!formData.question) return null;

  return (
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
                  src={
                    formData.image.type === 'url'
                      ? formData.image.data
                      : `data:image/jpeg;base64,${formData.image.data}`
                  }
                  alt="Preview"
                  width={200}
                  height={128}
                  className="w-full max-w-sm h-auto rounded-lg object-contain"
                  style={{ maxHeight: '8rem' }}
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
  );
}

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
 * Refactored Quiz Creator component
 */
export function QuizCreator({ isOpen, onClose, onQuizCreated }: QuizCreatorProps) {
  const {
    formData,
    errors,
    isSubmitting,
    updateField,
    setQuizType,
    setImageFromUrl,
    setImageFromFile,
    reset,
    handleSubmit,
  } = useQuizForm();

  /**
   * Handle form submission
   */
  const handleFormSubmit = async (data: typeof formData) => {
    const quiz: Quiz = {
      id: Date.now().toString(), // Temporary ID, server will assign real one
      type: data.type,
      question: data.question.trim(),
      answer: data.answer.trim(),
      ...(data.image && { image: data.image }),
    };

    await addQuiz(quiz);
    onQuizCreated?.(quiz);
    reset();
    onClose();
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    reset();
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
        <QuizTypeSelector
          selectedType={formData.type}
          onTypeChange={setQuizType}
        />

        {/* Question Input */}
        <FormInput
          id="question"
          label="Question"
          value={formData.question}
          onChange={(value) => updateField('question', value)}
          placeholder="Enter your question..."
          error={errors.question}
          multiline
        />

        {/* Image Input for Image Quiz */}
        {formData.type === 'image' && (
          <ImageInput
            onUrlChange={setImageFromUrl}
            onFileChange={setImageFromFile}
            error={errors.image}
          />
        )}

        {/* Answer Input */}
        <FormInput
          id="answer"
          label="Answer"
          value={formData.answer}
          onChange={(value) => updateField('answer', value)}
          placeholder="Enter the correct answer..."
          error={errors.answer}
        />

        {/* Preview */}
        <QuizPreview formData={formData} />

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
            onClick={() => handleSubmit(handleFormSubmit)}
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
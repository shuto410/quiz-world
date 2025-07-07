/**
 * Quiz Creator page for Quiz World application
 * - Integrates QuizCreator component into a dedicated page
 * - Provides navigation back to home
 * - Handles quiz creation and navigation
 * - Follows anime pop style design
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QuizCreator } from '@/components/QuizCreator';
import { Button } from '@/components/ui/Button';
import type { Quiz } from '@/types';

/**
 * Quiz Creator page component
 */
export default function QuizCreatorPage() {
  const [isCreatorOpen] = useState(true);
  const router = useRouter();

  const handleQuizCreated = (quiz: Quiz) => {
    console.log('Quiz created:', quiz);
    // Navigate back to home after successful creation
    router.push('/');
  };

  const handleClose = () => {
    // Navigate back to home when modal is closed
    router.push('/');
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Create Quiz
          </h1>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-700">
              Quiz Creator
            </h2>
            <p className="text-gray-600">
              Create amazing quizzes for your room!
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="ghost"
              onClick={handleBackToHome}
            >
              Back to Home
            </Button>
          </div>
        </div>

        {/* Quiz Creator Component */}
        <QuizCreator
          isOpen={isCreatorOpen}
          onClose={handleClose}
          onQuizCreated={handleQuizCreated}
        />
      </div>
    </div>
  );
}
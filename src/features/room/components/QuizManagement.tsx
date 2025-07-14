/**
 * Quiz Management component for Quiz World application
 * - Displays list of available quizzes
 * - Provides quiz creation and starting functionality
 * - Host-only access for quiz management
 */

import React from 'react';
import { Button } from '@/components/ui/Button';
import type { Quiz } from '@/types';

/**
 * Quiz management component props
 */
interface QuizManagementProps {
  quizzes: Quiz[];
  onStartQuiz: () => void; // 引数なしに修正
  onCreateQuiz: () => void;
}

/**
 * Individual quiz item props
 */
interface QuizItemProps {
  quiz: Quiz;
}

/**
 * Individual quiz item component
 */
function QuizItem({ quiz }: QuizItemProps) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div>
        <h4 className="font-medium text-gray-800">{quiz.question}</h4>
        <p className="text-sm text-gray-600">
          Type: {quiz.type} • Answer: {quiz.answer}
        </p>
      </div>
    </div>
  );
}

/**
 * Quiz management modal content
 */
export function QuizManagement({ quizzes, onStartQuiz, onCreateQuiz }: QuizManagementProps) {
  if (quizzes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          No quizzes available
        </h3>
        <p className="text-gray-600 mb-4">
          Create some quizzes to start the game!
        </p>
        <Button onClick={onCreateQuiz}>
          Create Quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Start Quizボタンを1つだけ表示し、クリックでonStartQuiz()を呼ぶ */}
      <Button data-testid="start-quiz-btn" onClick={() => onStartQuiz()}>
        Start Quiz
      </Button>
      {quizzes.map((quiz) => (
        <QuizItem key={quiz.id} quiz={quiz} />
      ))}
      <Button onClick={onCreateQuiz}>
        Create Quiz
      </Button>
    </div>
  );
} 
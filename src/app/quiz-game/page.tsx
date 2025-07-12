/**
 * Quiz Game page for Quiz World application
 * - Integrates QuizGame component into a dedicated page
 * - Handles quiz game state and navigation
 * - Provides game controls and real-time updates
 * - Follows anime pop style design
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuizGame } from '@/features/quiz/components/QuizGame';
import { Button } from '@/components/ui/Button';
import { getUserName, getUserId } from '@/lib/userStorage';
import type { Quiz, User, Score } from '@/types';

/**
 * Quiz Game Content component that uses useSearchParams
 */
function QuizGameContent() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [gameState, setGameState] = useState<'waiting' | 'active' | 'answered' | 'finished'>('waiting');
  const [buzzedUser, setBuzzedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      // Get quiz data from URL parameters
      const quizParam = searchParams.get('quiz');
      const usersParam = searchParams.get('users');
      const scoresParam = searchParams.get('scores');
      const gameStateParam = searchParams.get('gameState');
      const buzzedUserParam = searchParams.get('buzzedUser');

      if (!quizParam) {
        setError('Quiz data not found');
        setLoading(false);
        return;
      }

      const parsedQuiz = JSON.parse(quizParam) as Quiz;
      const parsedUsers = usersParam ? JSON.parse(usersParam) as User[] : [];
      const parsedScores = scoresParam ? JSON.parse(scoresParam) as Score[] : [];
      const parsedGameState = gameStateParam as 'waiting' | 'active' | 'answered' | 'finished' || 'waiting';
      const parsedBuzzedUser = buzzedUserParam ? JSON.parse(buzzedUserParam) as User : null;

      setQuiz(parsedQuiz);
      setUsers(parsedUsers);
      setScores(parsedScores);
      setGameState(parsedGameState);
      setBuzzedUser(parsedBuzzedUser);

      // Set current user
      const userId = getUserId();
      const userName = getUserName();
      const user = parsedUsers.find(u => u.id === userId) || {
        id: userId,
        name: userName || 'Unknown',
        isHost: false,
      };
      setCurrentUser(user);

      setLoading(false);
    } catch (err) {
      console.error('Error parsing quiz data:', err);
      setError('Error loading quiz data');
      setLoading(false);
    }
  }, [searchParams]);

  const handleEndQuiz = () => {
    router.push('/');
  };

  const handleNextQuiz = () => {
    // For now, just navigate back to home
    // In a real app, this would load the next quiz
    router.push('/');
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error loading quiz</h2>
          <p className="text-gray-600 mb-4">
            {error || 'There was a problem loading the quiz data.'}
          </p>
          <Button onClick={handleBackToHome}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBackToHome}
            className="mb-4"
          >
            Back to Home
          </Button>
        </div>

        {/* Quiz Game Component */}
        <QuizGame
          quiz={quiz}
          currentUser={currentUser}
          users={users}
          isHost={currentUser.isHost}
          gameState={gameState}
          scores={scores}
          buzzedUser={buzzedUser}
          onEndQuiz={handleEndQuiz}
          onNextQuiz={handleNextQuiz}
        />
      </div>
    </div>
  );
}

/**
 * Quiz Game page component with Suspense boundary
 */
export default function QuizGamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    }>
      <QuizGameContent />
    </Suspense>
  );
}
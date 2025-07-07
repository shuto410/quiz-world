/**
 * Main page for Quiz World application
 * - Displays room list and creation interface
 * - Handles room joining and navigation
 * - Provides links to quiz components
 * - Follows anime pop style design
 */

'use client';

import { useRouter } from 'next/navigation';
import { RoomList } from '../components/RoomList';
import { Button } from '../components/ui/Button';
import type { Room } from '../types';

export default function Home() {
  const router = useRouter();

  const handleRoomJoined = (room: Room) => {
    // Navigate to room page
    router.push(`/room/${room.id}`);
  };

  const handleCreateQuiz = () => {
    router.push('/quiz-creator');
  };

  const handlePlayQuiz = () => {
    // Example quiz data for testing
    const exampleQuiz = {
      id: 'example-quiz',
      type: 'text' as const,
      question: 'What is the capital of Japan?',
      answer: 'Tokyo',
    };
    
    const exampleUsers = [
      { id: 'user-1', name: 'Alice', isHost: false },
      { id: 'user-2', name: 'Bob', isHost: true },
    ];
    
    const exampleScores = [
      { userId: 'user-1', value: 100 },
      { userId: 'user-2', value: 150 },
    ];

    const params = new URLSearchParams({
      quiz: JSON.stringify(exampleQuiz),
      users: JSON.stringify(exampleUsers),
      scores: JSON.stringify(exampleScores),
      gameState: 'active',
    });

    router.push(`/quiz-game?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Quiz World 🎯
          </h1>
          <p className="text-gray-600 mb-6">
            Real-time multiplayer quiz game
          </p>
          
          {/* Quick Actions */}
          <div className="flex gap-4 justify-center mb-8">
            <Button onClick={handleCreateQuiz}>
              Create Quiz
            </Button>
            <Button variant="secondary" onClick={handlePlayQuiz}>
              Demo Quiz Game
            </Button>
          </div>
        </div>

        {/* Room List */}
        <RoomList onRoomJoined={handleRoomJoined} />
      </div>
    </div>
  );
}

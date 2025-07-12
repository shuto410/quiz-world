/**
 * Main page for Quiz World application
 * - Displays room list and creation interface
 * - Handles room joining and navigation
 * - Provides links to quiz components
 * - Follows anime pop style design
 */

'use client';

import { useRouter } from 'next/navigation';
import { RoomList } from '../features/room-list/components/RoomList';
import { Button } from '../components/ui/Button';
import type { Room } from '../types';
import { createRoom } from '../lib/socketClient';
import { getUserName, getUserId } from '../lib/userStorage';

export default function Home() {
  const router = useRouter();

  const handleRoomJoined = (room: Room) => {
    // Navigate to room page
    router.push(`/room/${room.id}`);
  };



  const handleCreateDemoRoom = () => {
    const userName = getUserName();
    const userId = getUserId();
    
    if (!userName) {
      alert('ユーザー名を設定してください');
      return;
    }

    try {
      // Create demo room with mock quiz data using Socket.io
      const demoRoomName = '🎯 デモルーム (サンプルクイズ付き)';
      createRoom(demoRoomName, true, 8, userName, userId, true);
      
      // Note: Navigation will be handled by RoomList component's onRoomCreated event
    } catch (error) {
      console.error('Failed to create demo room:', error);
      alert('デモルームの作成に失敗しました');
    }
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
          <div className="flex gap-4 justify-center mb-8 flex-wrap">
            <Button variant="secondary" onClick={handleCreateDemoRoom}>
              🎯 Create Demo Room
            </Button>
          </div>
        </div>

        {/* Room List */}
        <RoomList onRoomJoined={handleRoomJoined} />
      </div>
    </div>
  );
}

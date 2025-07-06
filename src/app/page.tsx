/**
 * Main page for Quiz World application
 * - Displays room list and creation interface
 * - Handles room joining and navigation
 * - Follows anime pop style design
 */

'use client';

import { RoomList } from '../components/RoomList';
import type { Room } from '../types';

export default function Home() {
  const handleRoomJoined = (room: Room) => {
    // TODO: Navigate to room page or show room interface
    console.log('Joined room:', room);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <RoomList onRoomJoined={handleRoomJoined} />
      </div>
    </div>
  );
}

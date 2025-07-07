/**
 * Room page component tests
 * - Tests room joining and navigation
 * - Tests user state management
 * - Tests room creation flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useParams, useRouter } from 'next/navigation';
import RoomPage from './page';

// Mock Next.js navigation
const mockSearchParams = { get: vi.fn() };
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: () => mockSearchParams,
}));

// Mock socket client
vi.mock('@/lib/socketClient', () => ({
  getSocket: vi.fn(),
  isConnected: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
}));

// Mock user storage
vi.mock('@/lib/userStorage', () => ({
  getUserName: vi.fn(),
  getUserId: vi.fn(),
}));

// Mock Room component
vi.mock('@/components/Room', () => ({
  Room: vi.fn(({ room, currentUser }: { room: Record<string, unknown>; currentUser: Record<string, unknown> }) => (
    <div data-testid="room-component">
      <div data-testid="room-name">{room.name as string}</div>
      <div data-testid="current-user-name">{currentUser.name as string}</div>
      <div data-testid="current-user-id">{currentUser.id as string}</div>
      <div data-testid="is-host">{currentUser.isHost ? 'true' : 'false'}</div>
    </div>
  )),
}));

describe('RoomPage', () => {
  const mockRouter = {
    push: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter);
    (useParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'test-room-id' });
    // Reset window.location.search to default
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
      },
      writable: true,
    });
  });

  it('should not call joinRoom when user is already host in the room', async () => {
    const { joinRoom, getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    // Mock window.location.search for host=true
    Object.defineProperty(window, 'location', {
      value: {
        search: '?host=true',
      },
      writable: true,
    });
    
    // Mock that user is connected and has data
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    // Mock room:joined event with user as host
    let roomJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:joined') {
        roomJoinedHandler = handler;
      }
    });

    render(<RoomPage />);

    // Simulate room:joined event where user is already host
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: {
          id: 'test-room-id',
          name: 'Test Room',
          hostId: 'test-user-id', // Same as current user ID
          users: [
            {
              id: 'test-user-id',
              name: 'Test User',
              isHost: true,
            }
          ],
          isPublic: true,
          maxPlayers: 8,
          quizzes: [],
        },
        user: {
          id: 'test-user-id',
          name: 'Test User',
          isHost: true,
        }
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('room-component')).toBeInTheDocument();
    });

    // Verify that joinRoom was NOT called when user is already host
    expect(joinRoom).not.toHaveBeenCalled();
  });

  it('should call joinRoom when user is not in the room yet', async () => {
    const { joinRoom, getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    // Mock window.location.search for no host parameter
    Object.defineProperty(window, 'location', {
      value: {
        search: '',
      },
      writable: true,
    });
    
    // Mock that user is connected and has data
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    // Mock room:joined event with user as new participant
    let roomJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:joined') {
        roomJoinedHandler = handler;
      }
    });

    render(<RoomPage />);

    // Simulate room:joined event where user joins as new participant
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: {
          id: 'test-room-id',
          name: 'Test Room',
          hostId: 'other-user-id', // Different from current user ID
          users: [
            {
              id: 'other-user-id',
              name: 'Other User',
              isHost: true,
            },
            {
              id: 'test-user-id',
              name: 'Test User',
              isHost: false,
            }
          ],
          isPublic: true,
          maxPlayers: 8,
          quizzes: [],
        },
        user: {
          id: 'test-user-id',
          name: 'Test User',
          isHost: false,
        }
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('room-component')).toBeInTheDocument();
    });

    // Verify that joinRoom was called
    expect(joinRoom).toHaveBeenCalledWith('test-room-id', 'test-user-id', 'Test User');
  });

  it('should redirect to home if user name is not set', async () => {
    const { getUserName } = await import('@/lib/userStorage');
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('');

    render(<RoomPage />);

    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('should show error if not connected to server', async () => {
    const { isConnected } = await import('@/lib/socketClient');
    const { getUserName } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');

    render(<RoomPage />);

    expect(screen.getByText('Not connected to server. Please refresh the page.')).toBeInTheDocument();
  });
}); 
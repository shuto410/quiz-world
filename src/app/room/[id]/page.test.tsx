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

  it('should handle room:userJoined event', async () => {
    const { getSocket, isConnected, joinRoom } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    let roomJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    let userJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:joined') {
        roomJoinedHandler = handler;
      } else if (event === 'room:userJoined') {
        userJoinedHandler = handler;
      }
    });

    render(<RoomPage />);

    // First, join the room
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: {
          id: 'test-room-id',
          name: 'Test Room',
          hostId: 'test-user-id',
          users: [{ id: 'test-user-id', name: 'Test User', isHost: true }],
          isPublic: true,
          maxPlayers: 8,
          quizzes: [],
        },
        user: { id: 'test-user-id', name: 'Test User', isHost: true }
      });
    }

    // Then simulate another user joining
    if (userJoinedHandler) {
      userJoinedHandler({
        user: { id: 'new-user-id', name: 'New User', isHost: false }
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('room-component')).toBeInTheDocument();
    });
  });

  it('should handle room:userLeft event', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    let roomJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    let userLeftHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:joined') {
        roomJoinedHandler = handler;
      } else if (event === 'room:userLeft') {
        userLeftHandler = handler;
      }
    });

    render(<RoomPage />);

    // First, join the room with multiple users
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: {
          id: 'test-room-id',
          name: 'Test Room',
          hostId: 'test-user-id',
          users: [
            { id: 'test-user-id', name: 'Test User', isHost: true },
            { id: 'other-user-id', name: 'Other User', isHost: false }
          ],
          isPublic: true,
          maxPlayers: 8,
          quizzes: [],
        },
        user: { id: 'test-user-id', name: 'Test User', isHost: true }
      });
    }

    // Then simulate a user leaving
    if (userLeftHandler) {
      userLeftHandler({ userId: 'other-user-id' });
    }

    await waitFor(() => {
      expect(screen.getByTestId('room-component')).toBeInTheDocument();
    });
  });

  it('should handle room:updated event', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    let roomJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    let roomUpdatedHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:joined') {
        roomJoinedHandler = handler;
      } else if (event === 'room:updated') {
        roomUpdatedHandler = handler;
      }
    });

    render(<RoomPage />);

    // First, join the room
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: {
          id: 'test-room-id',
          name: 'Test Room',
          hostId: 'test-user-id',
          users: [{ id: 'test-user-id', name: 'Test User', isHost: true }],
          isPublic: true,
          maxPlayers: 8,
          quizzes: [],
        },
        user: { id: 'test-user-id', name: 'Test User', isHost: true }
      });
    }

    // Then simulate room update
    if (roomUpdatedHandler) {
      roomUpdatedHandler({
        room: {
          id: 'test-room-id',
          name: 'Updated Room',
          hostId: 'test-user-id',
          users: [{ id: 'test-user-id', name: 'Test User', isHost: true }],
          isPublic: false,
          maxPlayers: 10,
          quizzes: [],
        }
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('room-name')).toHaveTextContent('Updated Room');
    });
  });

  it('should handle room:notFound event', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    let roomNotFoundHandler: (() => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: () => void) => {
      if (event === 'room:notFound') {
        roomNotFoundHandler = handler;
      }
    });

    render(<RoomPage />);

    // Simulate room not found
    if (roomNotFoundHandler) {
      roomNotFoundHandler();
    }

    await waitFor(() => {
      expect(screen.getByText('Room not found')).toBeInTheDocument();
    });
  });

  it('should handle room:alreadyJoined event', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    let alreadyJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:alreadyJoined') {
        alreadyJoinedHandler = handler;
      }
    });

    render(<RoomPage />);

    // Simulate already joined event
    if (alreadyJoinedHandler) {
      alreadyJoinedHandler({
        room: {
          id: 'test-room-id',
          name: 'Test Room',
          hostId: 'test-user-id',
          users: [{ id: 'test-user-id', name: 'Test User', isHost: true }],
          isPublic: true,
          maxPlayers: 8,
          quizzes: [],
        },
        user: { id: 'test-user-id', name: 'Test User', isHost: true }
      });
    }

    await waitFor(() => {
      expect(screen.getByTestId('room-component')).toBeInTheDocument();
    });
  });

  it('should handle quiz:started event and navigate to quiz game', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    let roomJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    let quizStartedHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:joined') {
        roomJoinedHandler = handler;
      } else if (event === 'quiz:started') {
        quizStartedHandler = handler;
      }
    });

    render(<RoomPage />);

    // First, join the room
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: {
          id: 'test-room-id',
          name: 'Test Room',
          hostId: 'test-user-id',
          users: [{ id: 'test-user-id', name: 'Test User', isHost: true }],
          isPublic: true,
          maxPlayers: 8,
          quizzes: [],
        },
        user: { id: 'test-user-id', name: 'Test User', isHost: true }
      });
    }

    // Then simulate quiz start
    if (quizStartedHandler) {
      quizStartedHandler({
        quiz: { id: 'quiz-1', type: 'text', question: 'Test?', answer: 'Yes' },
        timeLimit: 30
      });
    }

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(expect.stringContaining('/quiz-game?'));
    });
  });

  it('should show loading state initially', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    render(<RoomPage />);

    expect(screen.getByText('Loading room...')).toBeInTheDocument();
  });

  it('should show error state when socket is not initialized', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');

    render(<RoomPage />);

    await waitFor(() => {
      expect(screen.getByText('Socket not initialized')).toBeInTheDocument();
      expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });
  });

  it('should show room not found state when room is null', async () => {
    const { getSocket, isConnected } = await import('@/lib/socketClient');
    const { getUserName, getUserId } = await import('@/lib/userStorage');
    
    (isConnected as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getSocket as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    (getUserName as unknown as ReturnType<typeof vi.fn>).mockReturnValue('Test User');
    (getUserId as unknown as ReturnType<typeof vi.fn>).mockReturnValue('test-user-id');

    let roomJoinedHandler: ((data: Record<string, unknown>) => void) | undefined;
    mockSocket.on.mockImplementation((event: string, handler: (data: Record<string, unknown>) => void) => {
      if (event === 'room:joined') {
        roomJoinedHandler = handler;
      }
    });

    render(<RoomPage />);

    // Simulate room joined with null room data
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: null,
        user: null
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Room not found')).toBeInTheDocument();
      expect(screen.getByText('The room you\'re looking for doesn\'t exist.')).toBeInTheDocument();
    });
  });
}); 
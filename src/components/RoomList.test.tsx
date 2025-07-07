/**
 * Room List component unit tests
 * Tests room listing, creation, and joining functionality
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { RoomList } from './RoomList';
import type { Room } from '../types';
import * as socketClient from '../lib/socketClient';
import * as userStorage from '../lib/userStorage';
import { useRouter } from 'next/navigation';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock socket client
vi.mock('../lib/socketClient', () => ({
  initializeSocketClient: vi.fn(),
  requestRoomList: vi.fn(),
  joinRoom: vi.fn(),
  createRoom: vi.fn(),
}));

// Mock user storage
vi.mock('../lib/userStorage', () => ({
  getUserName: vi.fn(),
  setUserName: vi.fn(),
  getUserId: vi.fn(),
  resetCache: vi.fn(),
  getUserData: vi.fn(),
}));

describe('RoomList', () => {
  const mockPush = vi.fn();
  const mockOnRoomJoined = vi.fn();
  const mockInitializeSocketClient = vi.mocked(socketClient.initializeSocketClient);
  const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);
  const mockJoinRoom = vi.mocked(socketClient.joinRoom);
  const mockCreateRoom = vi.mocked(socketClient.createRoom);
  const mockGetUserName = vi.mocked(userStorage.getUserName);
  const mockSetUserName = vi.mocked(userStorage.setUserName);
  const mockGetUserId = vi.mocked(userStorage.getUserId);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockInitializeSocketClient.mockResolvedValue();
    mockGetUserName.mockReturnValue('TestUser');
    mockGetUserId.mockReturnValue('test-user-id');
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({ push: mockPush } as unknown as { push: typeof mockPush });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  it('renders room list with title and create button', async () => {
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    await waitFor(() => {
      expect(screen.getByText('Quiz World')).toBeInTheDocument();
      expect(screen.getByText('Create Room')).toBeInTheDocument();
      expect(screen.getByText('Public Rooms')).toBeInTheDocument();
    });
  });

  it('shows loading state while connecting', async () => {
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
  });

  it('shows connection error state', async () => {
    mockInitializeSocketClient.mockRejectedValue(new Error('Connection failed'));
    
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    await waitFor(() => {
      expect(screen.getByText(/Connecting to server/i)).toBeInTheDocument();
    });
  });

  it('shows no rooms available when empty', async () => {
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
        listeners?.onRoomList?.({ rooms: [] });
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    await waitFor(() => {
      expect(screen.getByText('No rooms available')).toBeInTheDocument();
      expect(screen.getByText('Be the first to create a room and start playing!')).toBeInTheDocument();
    });
  });

  it('displays rooms when available', async () => {
    const mockRooms: Room[] = [
      {
        id: 'room-1',
        name: 'Test Room 1',
        isPublic: true,
        maxPlayers: 8,
        hostId: 'user-1',
        users: [
          { id: 'user-1', name: 'Alice', isHost: true },
          { id: 'user-2', name: 'Bob', isHost: false },
        ],
        quizzes: [],
      },
    ];

    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
        listeners?.onRoomList?.({ rooms: mockRooms });
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
      expect(screen.getByText('2/8 players')).toBeInTheDocument();
      expect(screen.getByText('0 quizzes')).toBeInTheDocument();
      expect(screen.getByText('Host: Alice')).toBeInTheDocument();
    });
  });

  it('opens create room modal when create button is clicked', async () => {
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    await waitFor(() => {
      expect(screen.getByText('Create Room')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Room'));

    expect(screen.getByText('Create New Room')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter room name...')).toBeInTheDocument();
  });

  it('creates room with specified user name and saves userId', async () => {
    const testUserName = 'TDD Test User';
    
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // 接続完了を待つ
    await waitFor(() => {
      expect(screen.getByText('Create Room')).toBeInTheDocument();
    });

    // ルーム作成モーダルを開く
    fireEvent.click(screen.getByText('Create Room'));

    // フォームに入力
    const nameInput = screen.getByPlaceholderText('Enter room name...');
    fireEvent.change(nameInput, { target: { value: 'TDD Test Room' } });
    const userNameInput = screen.getByPlaceholderText('Enter your name...');
    fireEvent.change(userNameInput, { target: { value: testUserName } });

    // ルーム作成ボタンをクリック
    const createButtons = screen.getAllByText('Create Room');
    const modalCreateButton = createButtons.find(button => 
      button.closest('[class*="fixed inset-0"]') || // Modal container
      button.closest('[class*="max-w-md"]') // Modal content
    ) || createButtons[createButtons.length - 1]; // Fallback to last one
    fireEvent.click(modalCreateButton);

    // ユーザー名が保存されること
    expect(mockSetUserName).toHaveBeenCalledWith(testUserName);
    // ルーム作成が呼ばれること（ユーザー名とユーザーIDも含む）
    expect(mockCreateRoom).toHaveBeenCalledWith('TDD Test Room', true, 8, testUserName, 'test-user-id');
    // ユーザーIDが保存されていること
    expect(mockGetUserId).toHaveBeenCalled();
  });

  it('opens join modal when join button is clicked', async () => {
    const mockRooms: Room[] = [
      {
        id: 'room-1',
        name: 'Test Room 1',
        isPublic: true,
        maxPlayers: 8,
        hostId: 'user-1',
        users: [{ id: 'user-1', name: 'Alice', isHost: true }],
        quizzes: [],
      },
    ];

    let savedListeners: Parameters<typeof mockInitializeSocketClient>[1] | null = null;
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      savedListeners = listeners;
      // Immediately trigger connection state change
      listeners?.onConnectionStateChange?.('connected');
      return Promise.resolve();
    });

    // Mock requestRoomList to trigger room list update
    mockRequestRoomList.mockImplementation(() => {
      if (savedListeners) {
        // Immediately trigger room list update
        savedListeners.onRoomList?.({ rooms: mockRooms });
      }
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected and rooms to load
    await waitFor(() => {
      expect(screen.getByText(/Test Room 1/i)).toBeInTheDocument();
    });

    // Wait for the join button to be available
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Join Room/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Join Room/i }));

    // Wait for the modal to open
    await waitFor(() => {
      expect(screen.getByText(/Join Test Room 1/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your name/i)).toBeInTheDocument();
    });
  });

  it('joins room when join form is submitted', async () => {
    const mockRooms: Room[] = [
      {
        id: 'room-1',
        name: 'Test Room 1',
        isPublic: true,
        maxPlayers: 8,
        hostId: 'user-1',
        users: [{ id: 'user-1', name: 'Alice', isHost: true }],
        quizzes: [],
      },
    ];

    let savedListeners: Parameters<typeof mockInitializeSocketClient>[1] | null = null;
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      savedListeners = listeners;
      // Immediately trigger connection state change
      listeners?.onConnectionStateChange?.('connected');
      return Promise.resolve();
    });

    // Mock requestRoomList to trigger room list update
    mockRequestRoomList.mockImplementation(() => {
      if (savedListeners) {
        // Immediately trigger room list update
        savedListeners.onRoomList?.({ rooms: mockRooms });
      }
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected and rooms to load
    await waitFor(() => {
      expect(screen.getByText(/Test Room 1/i)).toBeInTheDocument();
    });

    // Wait for the join button to be available
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Join Room/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Join Room/i }));

    // Wait for the modal to open and find the name input
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter your name/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    fireEvent.change(nameInput, { target: { value: 'NewUser' } });

    // Find the join button in the modal by looking for the button within the modal
    const modalJoinButtons = screen.getAllByRole('button', { name: /Join Room/i });
    const modalJoinButton = modalJoinButtons.find(button => 
      button.closest('[class*="fixed inset-0"]') || // Modal container
      button.closest('[class*="max-w-sm"]') // Modal content
    ) || modalJoinButtons[modalJoinButtons.length - 1]; // Fallback to last one

    fireEvent.click(modalJoinButton);

    expect(mockSetUserName).toHaveBeenCalledWith('NewUser');
    expect(mockJoinRoom).toHaveBeenCalledWith('room-1', 'test-user-id', 'NewUser');
    expect(mockPush).toHaveBeenCalledWith('/room/room-1');
  });

  it('shows full room when room is at capacity', async () => {
    const mockRooms: Room[] = [
      {
        id: 'room-1',
        name: 'Full Room',
        isPublic: true,
        maxPlayers: 2,
        hostId: 'user-1',
        users: [
          { id: 'user-1', name: 'Alice', isHost: true },
          { id: 'user-2', name: 'Bob', isHost: false },
        ],
        quizzes: [],
      },
    ];

    let savedListeners: Parameters<typeof mockInitializeSocketClient>[1] | null = null;
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      savedListeners = listeners;
      // Immediately trigger connection state change
      listeners?.onConnectionStateChange?.('connected');
      return Promise.resolve();
    });

    // Mock requestRoomList to trigger room list update
    mockRequestRoomList.mockImplementation(() => {
      if (savedListeners) {
        // Immediately trigger room list update
        savedListeners.onRoomList?.({ rooms: mockRooms });
      }
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected and rooms to load
    await waitFor(() => {
      expect(screen.getByText(/Full Room/i)).toBeInTheDocument();
    });

    // Wait for the full button to be displayed
    await waitFor(() => {
      const fullButton = screen.getByRole('button', { name: /Full/i });
      expect(fullButton).toBeInTheDocument();
      expect(fullButton).toBeDisabled();
    });
  });

  it('refreshes room list when refresh button is clicked', async () => {
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Refresh'));

    expect(mockRequestRoomList).toHaveBeenCalled();
  });

  it('handles room creation success', async () => {
    const mockRoom: Room = {
      id: 'new-room',
      name: 'New Room',
      isPublic: true,
      maxPlayers: 8,
      hostId: 'user-1',
      users: [{ id: 'user-1', name: 'Alice', isHost: true }],
      quizzes: [],
    };

    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
        listeners?.onRoomCreated?.({ room: mockRoom });
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected and room to be created
    await waitFor(() => {
      expect(screen.getByText('New Room')).toBeInTheDocument();
    });
  });
}); 
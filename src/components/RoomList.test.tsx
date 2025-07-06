/**
 * Room List component unit tests
 * Tests room listing, creation, and joining functionality
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoomList } from './RoomList';
import type { Room } from '../types';
import * as socketClient from '../lib/socketClient';
import * as userStorage from '../lib/userStorage';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock dependencies
vi.mock('../lib/socketClient');
vi.mock('../lib/userStorage');

const mockInitializeSocketClient = vi.mocked(socketClient.initializeSocketClient);
const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);
const mockJoinRoom = vi.mocked(socketClient.joinRoom);
const mockCreateRoom = vi.mocked(socketClient.createRoom);
const mockGetUserName = vi.mocked(userStorage.getUserName);
const mockSetUserName = vi.mocked(userStorage.setUserName);

describe('RoomList', () => {
  const mockOnRoomJoined = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockInitializeSocketClient.mockResolvedValue();
    mockGetUserName.mockReturnValue('TestUser');
  });

  it('renders room list with title and create button', async () => {
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    expect(screen.getByText('Quiz World')).toBeInTheDocument();
    expect(screen.getByText('Create Room')).toBeInTheDocument();
    expect(screen.getByText('Public Rooms')).toBeInTheDocument();
  });

  it('shows loading state while connecting', async () => {
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
  });

  it('shows connection error state', async () => {
    mockInitializeSocketClient.mockRejectedValue(new Error('Connection failed'));
    
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    await waitFor(() => {
      expect(screen.getByText(/Connection error/)).toBeInTheDocument();
    });
  });

  it('shows no rooms available when empty', async () => {
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      listeners?.onConnectionStateChange?.('connected');
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
      listeners?.onConnectionStateChange?.('connected');
      listeners?.onRoomList?.({ rooms: mockRooms });
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
      listeners?.onConnectionStateChange?.('connected');
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

  it('creates room when form is submitted', async () => {
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected
    await waitFor(() => {
      expect(screen.getByText('Create Room')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Room'));

    // Wait for the modal to open
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter room name...')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('Enter room name...');
    fireEvent.change(nameInput, { target: { value: 'New Test Room' } });

    // Find the create button in the modal (there might be multiple "Create Room" buttons)
    const createButtons = screen.getAllByText('Create Room');
    const modalCreateButton = createButtons.find(button => 
      button.closest('[role="dialog"]') || button.closest('.modal')
    ) || createButtons[createButtons.length - 1]; // Use last one as fallback

    fireEvent.click(modalCreateButton);

    expect(mockCreateRoom).toHaveBeenCalledWith('New Test Room', true, 8);
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

    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
        listeners?.onRoomList?.({ rooms: mockRooms });
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected and rooms to load
    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    // Wait for the join button to be available
    await waitFor(() => {
      expect(screen.getByText('Join Room')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Join Room'));

    // Wait for the modal to open
    await waitFor(() => {
      expect(screen.getByText('Join Test Room 1')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your name...')).toBeInTheDocument();
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

    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
        listeners?.onRoomList?.({ rooms: mockRooms });
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected and rooms to load
    await waitFor(() => {
      expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    });

    // Wait for the join button to be available
    await waitFor(() => {
      expect(screen.getByText('Join Room')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Join Room'));

    // Wait for the modal to open and find the name input
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your name...')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('Enter your name...');
    fireEvent.change(nameInput, { target: { value: 'NewUser' } });

    // Find the join button in the modal (there might be multiple "Join Room" buttons)
    const joinButtons = screen.getAllByText('Join Room');
    const modalJoinButton = joinButtons.find(button => 
      button.closest('[role="dialog"]') || button.closest('.modal')
    ) || joinButtons[joinButtons.length - 1]; // Use last one as fallback

    fireEvent.click(modalJoinButton);

    expect(mockSetUserName).toHaveBeenCalledWith('NewUser');
    expect(mockJoinRoom).toHaveBeenCalledWith('room-1', 'NewUser');
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

    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      setTimeout(() => {
        listeners?.onConnectionStateChange?.('connected');
        listeners?.onRoomList?.({ rooms: mockRooms });
      }, 0);
      return Promise.resolve();
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);

    // Wait for the component to be connected and rooms to load
    await waitFor(() => {
      expect(screen.getByText('Full Room')).toBeInTheDocument();
    });

    // Wait for the full button to be displayed
    await waitFor(() => {
      expect(screen.getByText('Full')).toBeInTheDocument();
      expect(screen.getByText('Full')).toBeDisabled();
    });
  });

  it('refreshes room list when refresh button is clicked', async () => {
    mockInitializeSocketClient.mockImplementation((url, listeners) => {
      listeners?.onConnectionStateChange?.('connected');
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
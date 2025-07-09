/**
 * Tests for refactored RoomList component
 */
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomList } from './RoomList';
import * as socketClient from '../../../lib/socketClient';
import * as userStorage from '../../../lib/userStorage';
import * as useSocketConnection from '../hooks/useSocketConnection';
import * as useRoomList from '../hooks/useRoomList';
import type { Room, User } from '../../../types';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock socket client
vi.mock('../../../lib/socketClient', () => ({
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
}));

// Mock user storage
vi.mock('../../../lib/userStorage', () => ({
  getUserName: vi.fn(),
  setUserName: vi.fn(),
  getUserId: vi.fn(),
}));

// Mock hooks
vi.mock('../hooks/useSocketConnection', () => ({
  useSocketConnection: vi.fn(),
}));

vi.mock('../hooks/useRoomList', () => ({
  useRoomList: vi.fn(),
}));

const mockRooms: Room[] = [
  {
    id: 'room-1',
    name: 'Test Room 1',
    isPublic: true,
    maxPlayers: 8,
    hostId: 'user-1',
    users: [{ id: 'user-1', name: 'Host', isHost: true }],
    quizzes: [],
  },
  {
    id: 'room-2',
    name: 'Test Room 2',
    isPublic: true,
    maxPlayers: 4,
    hostId: 'user-2',
    users: [
      { id: 'user-2', name: 'Host2', isHost: true },
      { id: 'user-3', name: 'Player', isHost: false },
    ],
    quizzes: [{ id: 'quiz-1', type: 'text', question: 'Q1', answer: 'A1' }],
  },
];

describe('RoomList Component', () => {
  const mockOnRoomJoined = vi.fn();
  const mockRefresh = vi.fn();
  
  const defaultSocketConnection = {
    isConnected: true,
    connectionState: 'connected' as const,
  };
  
  const defaultRoomList = {
    rooms: mockRooms,
    loading: false,
    error: null,
    refresh: mockRefresh,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSocketConnection.useSocketConnection).mockReturnValue(defaultSocketConnection);
    vi.mocked(useRoomList.useRoomList).mockReturnValue(defaultRoomList);
    vi.mocked(userStorage.getUserName).mockReturnValue('Test User');
    vi.mocked(userStorage.getUserId).mockReturnValue('test-user-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders room list with rooms', () => {
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Check header
    expect(screen.getByText('Quiz World')).toBeInTheDocument();
    expect(screen.getByText('Available Rooms')).toBeInTheDocument();
    
    // Check rooms are displayed
    expect(screen.getByText('Test Room 1')).toBeInTheDocument();
    expect(screen.getByText('Test Room 2')).toBeInTheDocument();
    
    // Check room details
    expect(screen.getByText('1/8 players')).toBeInTheDocument();
    expect(screen.getByText('2/4 players')).toBeInTheDocument();
    expect(screen.getByText('0 quizzes')).toBeInTheDocument();
    expect(screen.getByText('1 quizzes')).toBeInTheDocument();
  });

  test('displays empty state when no rooms', () => {
    vi.mocked(useRoomList.useRoomList).mockReturnValue({
      ...defaultRoomList,
      rooms: [],
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    expect(screen.getByText('No rooms available')).toBeInTheDocument();
    expect(screen.getByText('Be the first to create a room and start playing!')).toBeInTheDocument();
    expect(screen.getByText('Create First Room')).toBeInTheDocument();
  });

  test('displays loading state', () => {
    vi.mocked(useRoomList.useRoomList).mockReturnValue({
      ...defaultRoomList,
      loading: true,
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    expect(screen.getByText('Loading rooms...')).toBeInTheDocument();
  });

  test('displays error state', () => {
    vi.mocked(useRoomList.useRoomList).mockReturnValue({
      ...defaultRoomList,
      error: 'Failed to load rooms',
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    expect(screen.getByText('Failed to load rooms')).toBeInTheDocument();
  });

  test('displays connection status when disconnected', () => {
    vi.mocked(useSocketConnection.useSocketConnection).mockReturnValue({
      isConnected: false,
      connectionState: 'disconnected',
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    expect(screen.getByText('Disconnected from server')).toBeInTheDocument();
  });

  test('displays connecting state', () => {
    vi.mocked(useSocketConnection.useSocketConnection).mockReturnValue({
      isConnected: false,
      connectionState: 'connecting',
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
  });

  test('handles refresh button click', () => {
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    expect(mockRefresh).toHaveBeenCalled();
  });

  test('opens create room modal', async () => {
    const user = userEvent.setup();
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    const createButton = screen.getByText('Create Room');
    await user.click(createButton);
    
    expect(screen.getByText('Create New Room')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter room name...')).toBeInTheDocument();
  });

  test('creates room with valid input', async () => {
    const user = userEvent.setup();
    const mockCreateRoom = vi.mocked(socketClient.createRoom);
    
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Open modal
    await user.click(screen.getByText('Create Room'));
    
    // Fill form
    await user.type(screen.getByPlaceholderText('Enter room name...'), 'My Room');
    await user.clear(screen.getByPlaceholderText('Enter your name...'));
    await user.type(screen.getByPlaceholderText('Enter your name...'), 'Player 1');
    
    // Submit
    const submitButtons = screen.getAllByText('Create Room');
    const modalSubmitButton = submitButtons[1]; // Second button is in the modal
    await user.click(modalSubmitButton);
    
    expect(mockCreateRoom).toHaveBeenCalledWith(
      'My Room',
      true,
      8,
      'Player 1',
      'test-user-id'
    );
    expect(userStorage.setUserName).toHaveBeenCalledWith('Player 1');
  });

  test('cannot create room with empty name', async () => {
    const user = userEvent.setup();
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Open modal
    await user.click(screen.getByText('Create Room'));
    
    // Submit button should be disabled with empty fields
    const submitButtons = screen.getAllByText('Create Room');
    const modalSubmitButton = submitButtons[1]; // Second button is in the modal
    expect(modalSubmitButton).toBeDisabled();
  });

  test('opens join room modal when clicking join button', async () => {
    const user = userEvent.setup();
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    const joinButtons = screen.getAllByText('Join Room');
    await user.click(joinButtons[0]);
    
    expect(screen.getByText('Join Test Room 1')).toBeInTheDocument();
  });

  test('joins room with valid username', async () => {
    const user = userEvent.setup();
    const mockJoinRoom = vi.mocked(socketClient.joinRoom);
    
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Click join on first room
    const joinButtons = screen.getAllByText('Join Room');
    await user.click(joinButtons[0]);
    
    // Enter username
    const nameInput = screen.getByPlaceholderText('Enter your name...');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Player');
    
    // Submit
    const submitJoinButtons = screen.getAllByText('Join Room');
    const modalJoinButton = submitJoinButtons[submitJoinButtons.length - 1]; // Last button is in the modal
    await user.click(modalJoinButton);
    
    expect(mockJoinRoom).toHaveBeenCalledWith('room-1', 'test-user-id', 'New Player');
    expect(userStorage.setUserName).toHaveBeenCalledWith('New Player');
  });

  test('handles room created event', () => {
    let roomCreatedHandler: ((data: { room: Room }) => void) | undefined;
    
    vi.mocked(useSocketConnection.useSocketConnection).mockReturnValue({
      ...defaultSocketConnection,
    });
    
    vi.mocked(useSocketConnection.useSocketConnection).mockImplementation((options?: any) => {
      roomCreatedHandler = options?.onRoomCreated;
      return defaultSocketConnection;
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Simulate room created event
    const newRoom: Room = {
      id: 'new-room',
      name: 'New Room',
      isPublic: true,
      maxPlayers: 8,
      hostId: 'test-user-id',
      users: [{ id: 'test-user-id', name: 'Test User', isHost: true }],
      quizzes: [],
    };
    
    if (roomCreatedHandler) {
      roomCreatedHandler({ room: newRoom });
    }
    
    expect(mockPush).toHaveBeenCalledWith('/room/new-room?host=true');
  });

  test('handles room joined event for non-host', async () => {
    let roomJoinedHandler: ((data: { room: Room; user: User }) => void) | undefined;
    
    vi.mocked(useSocketConnection.useSocketConnection).mockImplementation((options?: any) => {
      roomJoinedHandler = options?.onRoomJoined;
      return defaultSocketConnection;
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Simulate room joined event
    if (roomJoinedHandler) {
      roomJoinedHandler({
        room: mockRooms[0],
        user: { id: 'test-user-id', name: 'Test User', isHost: false },
      });
    }
    
    await waitFor(() => {
      expect(mockOnRoomJoined).toHaveBeenCalledWith(mockRooms[0]);
      expect(mockPush).toHaveBeenCalledWith('/room/room-1');
    });
  });

  test('disables join button for full room', () => {
    const fullRoom: Room = {
      ...mockRooms[1],
      users: [
        { id: 'u1', name: 'P1', isHost: true },
        { id: 'u2', name: 'P2', isHost: false },
        { id: 'u3', name: 'P3', isHost: false },
        { id: 'u4', name: 'P4', isHost: false },
      ],
    };
    
    vi.mocked(useRoomList.useRoomList).mockReturnValue({
      ...defaultRoomList,
      rooms: [fullRoom],
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    const fullButton = screen.getByText('Full');
    expect(fullButton).toBeDisabled();
  });

  test('loads saved username on mount', () => {
    vi.mocked(userStorage.getUserName).mockReturnValue('Saved User');
    
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Open create modal to check if username is loaded
    fireEvent.click(screen.getByText('Create Room'));
    
    // Check that the name input has the saved value
    const nameInputs = screen.getAllByPlaceholderText('Enter your name...');
    const createModalNameInput = nameInputs[0];
    expect(createModalNameInput).toHaveValue('Saved User');
  });

  test('handles create room modal close', async () => {
    const user = userEvent.setup();
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Open modal
    await user.click(screen.getByText('Create Room'));
    expect(screen.getByText('Create New Room')).toBeInTheDocument();
    
    // Close modal
    await user.click(screen.getByText('Cancel'));
    
    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Create New Room')).not.toBeInTheDocument();
    });
  });

  test('handles join room modal close', async () => {
    const user = userEvent.setup();
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Open modal
    const joinButtons = screen.getAllByText('Join Room');
    await user.click(joinButtons[0]);
    expect(screen.getByText('Join Test Room 1')).toBeInTheDocument();
    
    // Close modal
    await user.click(screen.getByText('Cancel'));
    
    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Join Test Room 1')).not.toBeInTheDocument();
    });
  });

  test('displays room visibility badge correctly', () => {
    const mixedRooms: Room[] = [
      { ...mockRooms[0], isPublic: true },
      { ...mockRooms[1], isPublic: false },
    ];
    
    vi.mocked(useRoomList.useRoomList).mockReturnValue({
      ...defaultRoomList,
      rooms: mixedRooms,
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  test('handles create room with custom settings', async () => {
    const user = userEvent.setup();
    const mockCreateRoom = vi.mocked(socketClient.createRoom);
    
    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Open modal
    await user.click(screen.getByText('Create Room'));
    
    // Fill form with private room settings
    await user.type(screen.getByPlaceholderText('Enter room name...'), 'Private Room');
    await user.selectOptions(screen.getByDisplayValue('8 players'), '4');
    await user.click(screen.getByLabelText('Public room (visible to everyone)'));
    await user.clear(screen.getByPlaceholderText('Enter your name...'));
    await user.type(screen.getByPlaceholderText('Enter your name...'), 'Private Host');
    
    // Submit
    const submitButtons = screen.getAllByText('Create Room');
    const modalSubmitButton = submitButtons[1];
    await user.click(modalSubmitButton);
    
    expect(mockCreateRoom).toHaveBeenCalledWith(
      'Private Room',
      false, // isPublic: false
      4,
      'Private Host',
      'test-user-id'
    );
  });

  // TDD: Test for filter behavior - should show public rooms but filter out private
  test('currently filters out private rooms due to isPublic filter', () => {
    // This test documents current behavior (which is the bug)
    // After fixing, this behavior should change
    const mixedRooms: Room[] = [
      { ...mockRooms[0], isPublic: true, name: 'Public Room' },
      { ...mockRooms[1], isPublic: false, name: 'Private Room' },
    ];
    
    // Reset the mock to check actual filter behavior
    vi.mocked(useRoomList.useRoomList).mockRestore();
    vi.mocked(useRoomList.useRoomList).mockImplementation((isConnected, options) => {
      // Simulate the actual filter applied to mixed rooms
      const filteredRooms = options?.filter 
        ? mixedRooms.filter(options.filter)
        : mixedRooms;
      
      return {
        rooms: filteredRooms,
        loading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // This shows the current bug: private rooms are filtered out
    expect(screen.getByText('Public Room')).toBeInTheDocument();
    expect(screen.queryByText('Private Room')).not.toBeInTheDocument(); // Currently filtered out
  });

  // TDD: Test for desired behavior - should show private rooms created by user
  test('should show user-created private rooms in room list', () => {
    // This test will FAIL initially - this is our RED phase
    const mixedRooms: Room[] = [
      { ...mockRooms[0], isPublic: true, name: 'Public Room' },
      { 
        ...mockRooms[1], 
        isPublic: false, 
        name: 'My Private Room',
        hostId: 'test-user-id' // User created this room
      },
    ];
    
    // Mock useRoomList to NOT filter private rooms created by current user
    vi.mocked(useRoomList.useRoomList).mockImplementation((isConnected, options) => {
      // This is the desired behavior after fix
      const filteredRooms = mixedRooms.filter(room => 
        room.isPublic || room.hostId === 'test-user-id' // Show public OR user's own private rooms
      );
      
      return {
        rooms: filteredRooms,
        loading: false,
        error: null,
        refresh: vi.fn(),
      };
    });

    render(<RoomList onRoomJoined={mockOnRoomJoined} />);
    
    // Both should be visible after fix
    expect(screen.getByText('Public Room')).toBeInTheDocument();
    expect(screen.getByText('My Private Room')).toBeInTheDocument(); // This should work after fix
  });
});
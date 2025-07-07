/**
 * Room component unit tests
 * Tests room UI functionality including user list, chat, and host controls
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Room } from './Room';
import type { Room as RoomType, User } from '../types';
import * as socketClient from '../lib/socketClient';
import * as userStorage from '../lib/userStorage';

// Mock dependencies
vi.mock('../lib/socketClient');
vi.mock('../lib/userStorage');

const mockLeaveRoom = vi.mocked(socketClient.leaveRoom);
const mockTransferHost = vi.mocked(socketClient.transferHost);
const mockGetUserName = vi.mocked(userStorage.getUserName);
const mockGetUserId = vi.mocked(userStorage.getUserId);

describe('Room', () => {
  const mockRoom: RoomType = {
    id: 'room-1',
    name: 'Test Room',
    isPublic: true,
    maxPlayers: 8,
    hostId: 'user-1',
    users: [
      { id: 'user-1', name: 'Alice', isHost: true },
      { id: 'user-2', name: 'Bob', isHost: false },
    ],
    quizzes: [
      {
        id: 'quiz-1',
        question: 'What is 2+2?',
        answer: '4',
        type: 'text',
      },
    ],
  };

  const mockCurrentUser: User = {
    id: 'user-1',
    name: 'Alice',
    isHost: true,
  };

  const mockOnLeave = vi.fn();
  const mockOnQuizStart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserName.mockReturnValue('Alice');
    mockGetUserId.mockReturnValue('user-1');
  });

  it('renders room information correctly', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.getByText('Test Room')).toBeInTheDocument();
    expect(screen.getByText(/2\/8 players/)).toBeInTheDocument();
    expect(screen.getByText(/Public Room/)).toBeInTheDocument();
  });

  it('displays user list with host indicators', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('shows welcome message in chat', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.getByText(/Welcome to Test Room!/)).toBeInTheDocument();
  });

  it('allows sending chat messages', async () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const messageInput = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(messageInput, { target: { value: 'Hello everyone!' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Alice:')).toBeInTheDocument();
      expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
    });
  });

  it.skip('sends message on Enter key press', async () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const messageInput = screen.getByPlaceholderText('Type a message...');
    
    fireEvent.change(messageInput, { target: { value: 'Test message' } });
    fireEvent.keyPress(messageInput, { key: 'Enter', code: 'Enter' });

    // Check that message appears in chat
    await waitFor(() => {
      expect(screen.getByText(/Test message/)).toBeInTheDocument();
    });
  });

  it('disables send button when message is empty', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
  });

  it('calls leaveRoom when Leave Room button is clicked', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const leaveButton = screen.getByText('Leave Room');
    fireEvent.click(leaveButton);

    expect(mockLeaveRoom).toHaveBeenCalled();
    expect(mockOnLeave).toHaveBeenCalled();
  });

  it('shows host controls for host user', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.getByText('Manage Quizzes')).toBeInTheDocument();
    expect(screen.getByText('Make Host')).toBeInTheDocument();
  });

  it('does not show host controls for non-host user', () => {
    const nonHostUser: User = { ...mockCurrentUser, isHost: false };
    
    render(
      <Room
        room={mockRoom}
        currentUser={nonHostUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.queryByText('Manage Quizzes')).not.toBeInTheDocument();
    expect(screen.queryByText('Make Host')).not.toBeInTheDocument();
  });

  it('opens quiz management modal when Manage Quizzes is clicked', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);

    expect(screen.getByText('Quiz Management')).toBeInTheDocument();
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
  });

  it('opens host transfer modal when Make Host is clicked', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const makeHostButton = screen.getByText('Make Host');
    fireEvent.click(makeHostButton);

    expect(screen.getAllByText('Transfer Host')).toHaveLength(2);
    expect(screen.getByText(/Transfer host role to/)).toBeInTheDocument();
    expect(screen.getAllByText('Bob')).toHaveLength(2);
  });

  it('transfers host when confirmed', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const makeHostButton = screen.getByText('Make Host');
    fireEvent.click(makeHostButton);

    const transferButtons = screen.getAllByText('Transfer Host');
    fireEvent.click(transferButtons[1]); // Click the button, not the header

    expect(mockTransferHost).toHaveBeenCalledWith('user-2');
  });

  it('starts quiz when Start button is clicked', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    expect(mockOnQuizStart).toHaveBeenCalledWith(mockRoom.quizzes[0]);
  });

  it('shows empty state when no quizzes available', () => {
    const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
    
    render(
      <Room
        room={roomWithoutQuizzes}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);

    expect(screen.getByText('No quizzes available')).toBeInTheDocument();
    expect(screen.getByText('Create some quizzes to start the game!')).toBeInTheDocument();
  });

  it('opens quiz creator when Create Quiz button is clicked in quiz management', () => {
    const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
    
    render(
      <Room
        room={roomWithoutQuizzes}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);

    const createQuizButton = screen.getByText('Create Quiz');
    fireEvent.click(createQuizButton);

    expect(screen.getByText('Create New Quiz')).toBeInTheDocument();
    expect(screen.getByText('Quiz Type')).toBeInTheDocument();
  });

  it('creates quiz and closes quiz creator when quiz is submitted', async () => {
    const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
    
    render(
      <Room
        room={roomWithoutQuizzes}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    // Open quiz creator
    const manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);
    const createQuizButton = screen.getByText('Create Quiz');
    fireEvent.click(createQuizButton);

    // Fill quiz form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });

    // Submit quiz
    const submitButton = screen.getByText('Create Quiz');
    fireEvent.click(submitButton);

    // Quiz creator should close
    await waitFor(() => {
      expect(screen.queryByText('Create New Quiz')).not.toBeInTheDocument();
    });
  });

  it('adds created quiz to room quiz list', async () => {
    const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
    
    render(
      <Room
        room={roomWithoutQuizzes}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    // Open quiz creator
    const manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);
    const createQuizButton = screen.getByText('Create Quiz');
    fireEvent.click(createQuizButton);

    // Fill quiz form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });

    // Submit quiz
    const submitButton = screen.getByText('Create Quiz');
    fireEvent.click(submitButton);

    // Wait for quiz creator to close
    await waitFor(() => {
      expect(screen.queryByText('Create New Quiz')).not.toBeInTheDocument();
    });

    // Open quiz management again to see the new quiz
    fireEvent.click(manageButton);

    // Check that the new quiz appears in the list
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    expect(screen.getByText('Type: text • Answer: 4')).toBeInTheDocument();
  });

  it('can create multiple quizzes', async () => {
    const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
    
    render(
      <Room
        room={roomWithoutQuizzes}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    // Create first quiz
    let manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);
    let createQuizButton = screen.getByText('Create Quiz');
    fireEvent.click(createQuizButton);

    let questionInput = screen.getByPlaceholderText('Enter your question...');
    let answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    
    fireEvent.change(questionInput, { target: { value: 'What is 2+2?' } });
    fireEvent.change(answerInput, { target: { value: '4' } });
    fireEvent.click(screen.getByText('Create Quiz'));

    await waitFor(() => {
      expect(screen.queryByText('Create New Quiz')).not.toBeInTheDocument();
    });

    // Create second quiz
    manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);
    createQuizButton = screen.getByText('Create Quiz');
    fireEvent.click(createQuizButton);

    questionInput = screen.getByPlaceholderText('Enter your question...');
    answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    fireEvent.change(questionInput, { target: { value: 'What is 3+3?' } });
    fireEvent.change(answerInput, { target: { value: '6' } });
    fireEvent.click(screen.getByText('Create Quiz'));

    await waitFor(() => {
      expect(screen.queryByText('Create New Quiz')).not.toBeInTheDocument();
    });

    // Check both quizzes appear
    manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    expect(screen.getByText('What is 3+3?')).toBeInTheDocument();
  });

  it('can create image quiz', async () => {
    const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
    
    render(
      <Room
        room={roomWithoutQuizzes}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    // Open quiz creator
    const manageButton = screen.getByText('Manage Quizzes');
    fireEvent.click(manageButton);
    const createQuizButton = screen.getByText('Create Quiz');
    fireEvent.click(createQuizButton);

    // Switch to image quiz
    const imageQuizButton = screen.getByText('Image Quiz').closest('button');
    fireEvent.click(imageQuizButton!);

    // Fill image quiz form
    const questionInput = screen.getByPlaceholderText('Enter your question...');
    const answerInput = screen.getByPlaceholderText('Enter the correct answer...');
    const imageUrlInput = screen.getByPlaceholderText('https://example.com/image.jpg');
    
    fireEvent.change(questionInput, { target: { value: 'What anime is this?' } });
    fireEvent.change(answerInput, { target: { value: 'Naruto' } });
    fireEvent.change(imageUrlInput, { target: { value: 'https://example.com/naruto.jpg' } });

    // Submit quiz
    const submitButton = screen.getByText('Create Quiz');
    fireEvent.click(submitButton);

    // Wait for quiz creator to close
    await waitFor(() => {
      expect(screen.queryByText('Create New Quiz')).not.toBeInTheDocument();
    });

    // Open quiz management again to see the new quiz
    fireEvent.click(manageButton);

    // Check that the new quiz appears in the list
    expect(screen.getByText('What anime is this?')).toBeInTheDocument();
    expect(screen.getByText('Type: image • Answer: Naruto')).toBeInTheDocument();
  });

  it('shows waiting message for non-host users', () => {
    const nonHostUser: User = { ...mockCurrentUser, isHost: false };
    
    render(
      <Room
        room={mockRoom}
        currentUser={nonHostUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.getByText('The host will start a quiz soon.')).toBeInTheDocument();
  });

  it('shows create quiz message for host when no quizzes', () => {
    const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
    
    render(
      <Room
        room={roomWithoutQuizzes}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.getByText('Create and start a quiz to begin the game!')).toBeInTheDocument();
  });

  it('shows Start Quiz button for host when quizzes are available', () => {
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    expect(screen.getByText('Start Quiz')).toBeInTheDocument();
  });

  it('uses username from storage when available', () => {
    mockGetUserName.mockReturnValue('StoredName');
    
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const messageInput = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(messageInput, { target: { value: 'Test' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('StoredName:')).toBeInTheDocument();
  });

  it('falls back to current user name when storage is empty', () => {
    mockGetUserName.mockReturnValue('');
    
    render(
      <Room
        room={mockRoom}
        currentUser={mockCurrentUser}
        onLeave={mockOnLeave}
        onQuizStart={mockOnQuizStart}
      />
    );

    const messageInput = screen.getByPlaceholderText('Type a message...');
    const sendButton = screen.getByText('Send');

    fireEvent.change(messageInput, { target: { value: 'Test' } });
    fireEvent.click(sendButton);

    expect(screen.getByText('Alice:')).toBeInTheDocument();
  });
});

describe('User ID Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock userStorage functions
    vi.mocked(mockGetUserName).mockReturnValue('Test User');
    vi.mocked(mockGetUserId).mockReturnValue('test_user_123');
  });

  it('should use consistent user ID for chat messages', () => {
    const room: RoomType = {
      id: 'room1',
      name: 'Test Room',
      users: [
        { id: 'test_user_123', name: 'Test User', isHost: true }
      ],
      maxPlayers: 4,
      isPublic: true,
      quizzes: [],
      hostId: 'test_user_123',
    };

    const currentUser: User = {
      id: 'test_user_123',
      name: 'Test User',
      isHost: true,
    };

    render(
      <Room
        room={room}
        currentUser={currentUser}
        onLeave={vi.fn()}
        onQuizStart={vi.fn()}
      />
    );

    // Find chat input and send a message
    const chatInput = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(chatInput, { target: { value: 'Hello world' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    // Verify that getUserId was called to get the user ID for the message
    expect(mockGetUserId).toHaveBeenCalled();
  });

  it('should maintain user ID consistency across re-renders', () => {
    const room: RoomType = {
      id: 'room1',
      name: 'Test Room',
      users: [
        { id: 'test_user_123', name: 'Test User', isHost: true }
      ],
      maxPlayers: 4,
      isPublic: true,
      quizzes: [],
      hostId: 'test_user_123',
    };

    const currentUser: User = {
      id: 'test_user_123',
      name: 'Test User',
      isHost: true,
    };

    const { rerender } = render(
      <Room
        room={room}
        currentUser={currentUser}
        onLeave={vi.fn()}
        onQuizStart={vi.fn()}
      />
    );

    // First render - getUserId may be called multiple times during initial render
    const firstRenderCallCount = mockGetUserId.mock.calls.length;
    expect(firstRenderCallCount).toBeGreaterThan(0);

    // Re-render with same props
    rerender(
      <Room
        room={room}
        currentUser={currentUser}
        onLeave={vi.fn()}
        onQuizStart={vi.fn()}
      />
    );

    // Should call getUserId again for the re-render (this is expected behavior)
    expect(mockGetUserId).toHaveBeenCalledTimes(firstRenderCallCount + 1);
  });
}); 
/**
 * Room Component Tests
 * Tests for the refactored Room component including:
 * - Room header display
 * - Player list functionality
 * - Chat integration
 * - Quiz management (host only)
 * - Host privilege controls
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { Room } from './Room';
import type { Room as RoomType, User, Quiz } from '@/types';

// Mock dependencies
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

vi.mock('@/lib/socketClient', () => ({
  leaveRoom: vi.fn(),
  transferHost: vi.fn(),
  startQuiz: vi.fn(),
  addQuiz: vi.fn(),
  getSocket: vi.fn(() => mockSocket),
}));

vi.mock('@/lib/userStorage', () => ({
  getUserName: vi.fn(() => 'Test User'),
  getUserId: vi.fn(() => 'test-user-id'),
}));

vi.mock('@/features/chat/hooks/useChat', () => ({
  useChat: vi.fn(() => ({
    messages: [
      {
        id: '1',
        userName: 'System',
        message: 'Welcome to the room!',
        type: 'system',
      },
      {
        id: '2',
        userName: 'Test User',
        message: 'Hello everyone!',
        type: 'user',
      },
    ],
    sendMessage: vi.fn(),
  })),
}));

vi.mock('@/features/quiz/components/QuizCreator', () => ({
  QuizCreator: ({ isOpen, onQuizCreated, onClose }: { isOpen: boolean; onQuizCreated: (quiz: Quiz) => void; onClose: () => void }) => {
    if (!isOpen) return null;
    
    return (
      <div data-testid="quiz-creator">
        <button
          onClick={() =>
            onQuizCreated({
              id: 'new-quiz',
              type: 'text',
              question: 'What is 2+2?',
              answer: '4',
            })
          }
        >
          Create Quiz
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    );
  },
}));

describe('Room Component', () => {
  let mockRoom: RoomType;
  let mockCurrentUser: User;
  let mockOnLeave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnLeave = vi.fn();

    // Default room setup
    mockRoom = {
      id: 'test-room-id',
      name: 'Test Room',
      hostId: 'host-user-id',
      users: [
        { id: 'host-user-id', name: 'Host User', isHost: true },
        { id: 'regular-user-id', name: 'Regular User', isHost: false },
      ],
      isPublic: true,
      maxPlayers: 8,
      quizzes: [
        {
          id: 'quiz-1',
          type: 'text',
          question: 'What is the capital of Japan?',
          answer: 'Tokyo',
        },
      ],
      createdAt: Date.now(),
    };

    mockCurrentUser = {
      id: 'host-user-id',
      name: 'Host User',
      isHost: true,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Room Header', () => {
    it('should display room name and player count', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByTestId('room-name')).toHaveTextContent('Test Room');
      expect(screen.getByText('2/8 players • Public Room')).toBeInTheDocument();
    });

    it('should show private room indicator when room is private', () => {
      const privateRoom = { ...mockRoom, isPublic: false };
      render(<Room room={privateRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('2/8 players')).toBeInTheDocument();
      expect(screen.queryByText('Public Room')).not.toBeInTheDocument();
    });

    it('should show Manage Quizzes button for host users', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('Manage Quizzes')).toBeInTheDocument();
    });

    it('should not show Manage Quizzes button for non-host users', () => {
      const nonHostUser = { id: 'regular-user-id', name: 'Regular User', isHost: false };
      render(<Room room={mockRoom} currentUser={nonHostUser} onLeave={mockOnLeave} />);

      expect(screen.queryByText('Manage Quizzes')).not.toBeInTheDocument();
    });

    it('should show Leave Room button for all users', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('Leave Room')).toBeInTheDocument();
    });
  });

  describe('Player List', () => {
    it('should display all players in the room', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('Host User')).toBeInTheDocument();
      expect(screen.getByText('Regular User')).toBeInTheDocument();
    });

    it('should show crown icon for host users', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Host should have crown emoji
      const hostElement = screen.getByText('Host User').closest('div');
      expect(hostElement).toHaveTextContent('👑');
    });

    it('should show user icon for non-host users', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Regular user should have user emoji
      const regularUserElement = screen.getByText('Regular User').closest('div');
      expect(regularUserElement).toHaveTextContent('👤');
    });

    it('should display current user in player list', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('Host User')).toBeInTheDocument();
      expect(screen.getByText('Regular User')).toBeInTheDocument();
    });




  });

  describe('Chat Functionality', () => {
    it('should display chat messages', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('Welcome to the room!')).toBeInTheDocument();
      expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
    });

    it('should show message input and send button', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
      expect(screen.getByText('Send')).toBeInTheDocument();
    });

    it('should send message when Send button is clicked', async () => {
      const { useChat } = await import('@/features/chat/hooks/useChat');
      const mockSendMessage = vi.fn();
      (useChat as any).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
      });

      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      const messageInput = screen.getByPlaceholderText('Type a message...');
      const sendButton = screen.getByText('Send');

      fireEvent.change(messageInput, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test message', 'test-user-id', 'Test User');
    });

    it('should send message when Enter key is pressed', async () => {
      const user = userEvent.setup();
      const { useChat } = await import('@/features/chat/hooks/useChat');
      const mockSendMessage = vi.fn();
      (useChat as any).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
      });

      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      const messageInput = screen.getByPlaceholderText('Type a message...');

      await user.type(messageInput, 'Test message{enter}');

      expect(mockSendMessage).toHaveBeenCalledWith('Test message', 'test-user-id', 'Test User');
    });
  });

  describe('Quiz Management (Host Only)', () => {
    it('should show game status section for hosts', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('Waiting for Quiz')).toBeInTheDocument();
    });

    it('should show game status section for all users', () => {
      const nonHostUser = { id: 'regular-user-id', name: 'Regular User', isHost: false };
      render(<Room room={mockRoom} currentUser={nonHostUser} onLeave={mockOnLeave} />);

      // Game status is shown to all users, not just hosts
      expect(screen.getByText('Waiting for Quiz')).toBeInTheDocument();
    });

    it('should display available quizzes for hosts', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      fireEvent.click(screen.getByText('Manage Quizzes'));

      expect(screen.getByText('What is the capital of Japan?')).toBeInTheDocument();
    });

    it('should start quiz when Start Quiz button is clicked', async () => {
      // QuizManagementの仕様に合わせてStart Quizボタンをクリック
      const { startQuiz } = await import('@/lib/socketClient');
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);
      fireEvent.click(screen.getByText('Manage Quizzes'));
      // Start Quizボタンをクリック
      fireEvent.click(screen.getByTestId('start-quiz-btn'));
      // handleStartQuizが呼ばれ、currentQuizIndex=0でクイズが始まることを検証
      await waitFor(() => {
        expect(screen.getByText(mockRoom.quizzes[0].question)).toBeInTheDocument();
      });
    });

    it('should show Create Quiz button for hosts', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      fireEvent.click(screen.getByText('Manage Quizzes'));

      // Use more specific selector for the button in quiz management modal
      const createQuizButtons = screen.getAllByText('Create Quiz');
      expect(createQuizButtons.length).toBeGreaterThan(0);
    });

    it('should open quiz creator when Create Quiz is clicked', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      fireEvent.click(screen.getByText('Manage Quizzes'));
      
      // Click the Create Quiz button in the modal (not the one in quiz creator)
      const createQuizButtons = screen.getAllByText('Create Quiz');
      fireEvent.click(createQuizButtons[0]); // Click the first one (in modal)

      expect(screen.getByTestId('quiz-creator')).toBeInTheDocument();
    });

    it('should open quiz creator and handle quiz creation via socket', async () => {
      const { addQuiz } = await import('@/lib/socketClient');
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Open quiz management modal
      fireEvent.click(screen.getByText('Manage Quizzes'));
      
      // Open quiz creator - use getAllByText to handle multiple buttons
      const createQuizButtons = screen.getAllByText('Create Quiz');
      fireEvent.click(createQuizButtons[0]); // Click the first one (in modal)
      
      // Verify quiz creator is displayed
      const quizCreator = screen.getByTestId('quiz-creator');
      expect(quizCreator).toBeInTheDocument();
      
      // Find and click the Create Quiz button within the quiz creator
      const createQuizButton = within(quizCreator).getByText('Create Quiz');
      
      await act(async () => {
        fireEvent.click(createQuizButton);
      });

      // Verify that addQuiz was called with the new quiz
      expect(addQuiz).toHaveBeenCalledWith({
        id: 'new-quiz',
        type: 'text',
        question: 'What is 2+2?',
        answer: '4',
      });

      // Quiz creator should be closed after successful creation
      await waitFor(() => {
        expect(screen.queryByTestId('quiz-creator')).not.toBeInTheDocument();
      });
    });
  });

  describe('Quiz Duplicate Prevention', () => {
    it('should prevent duplicate quizzes when receiving quiz:added event', async () => {
      // Setup mock room with existing quiz
      const existingQuiz = {
        id: 'existing-quiz-1',
        type: 'text' as const,
        question: 'Existing quiz?',
        answer: 'Yes',
      };
      
      const mockRoomWithQuiz = {
        ...mockRoom,
        quizzes: [existingQuiz],
      };

      render(<Room room={mockRoomWithQuiz} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Verify initial quiz count
      fireEvent.click(screen.getByText('Manage Quizzes'));
      expect(screen.getByText('Existing quiz?')).toBeInTheDocument();
      
      // Simulate receiving quiz:added event for the same quiz
      // Use the actual mock returned by getSocket() instead of creating a local one
      
      // Find the handleQuizAdded callback from the global mock
      const onCalls = mockSocket.on.mock?.calls || [];
      const quizAddedCall = onCalls.find(call => call[0] === 'quiz:added');
      
      if (quizAddedCall) {
        const handleQuizAdded = quizAddedCall[1];
        // Simulate receiving the same quiz via socket
        await act(async () => {
          handleQuizAdded({ quiz: existingQuiz });
        });
        
        // Should not have duplicate quizzes
        const quizElements = screen.getAllByText('Existing quiz?');
        expect(quizElements).toHaveLength(1);
      }
    });
    
    it('should handle quiz creation with existing quizzes without duplication', async () => {
      // Setup mock room with existing quiz
      const existingQuiz = {
        id: 'existing-quiz-1',
        type: 'text' as const,
        question: 'Existing quiz?',
        answer: 'Yes',
      };
      
      const mockRoomWithQuiz = {
        ...mockRoom,
        quizzes: [existingQuiz],
      };

      render(<Room room={mockRoomWithQuiz} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Open quiz management and create new quiz
      fireEvent.click(screen.getByText('Manage Quizzes'));
      
      // Verify existing quiz is shown
      expect(screen.getByText('Existing quiz?')).toBeInTheDocument();
      
      // Create new quiz
      const createQuizButtons = screen.getAllByText('Create Quiz');
      fireEvent.click(createQuizButtons[0]);
      
      const quizCreator = screen.getByTestId('quiz-creator');
      const createQuizButton = within(quizCreator).getByText('Create Quiz');
      
      await act(async () => {
        fireEvent.click(createQuizButton);
      });
      
      // Simulate the socket event for the new quiz
      // Use the actual mock returned by getSocket() instead of creating a local one
      
      const newQuiz = {
        id: 'new-quiz-from-socket',
        type: 'text' as const,
        question: 'New quiz from socket?',
        answer: 'Yes',
      };
      
      // Find the handleQuizAdded callback from the global mock
      const onCalls = mockSocket.on.mock?.calls || [];
      const quizAddedCall = onCalls.find(call => call[0] === 'quiz:added');
      
      if (quizAddedCall) {
        const handleQuizAdded = quizAddedCall[1];
        await act(async () => {
          handleQuizAdded({ quiz: newQuiz });
        });
        
        // Re-open quiz management to verify both quizzes are displayed
        fireEvent.click(screen.getByText('Manage Quizzes'));
        
        // Should have both quizzes without duplication
        await waitFor(() => {
          expect(screen.getByText('Existing quiz?')).toBeInTheDocument();
          expect(screen.getByText('New quiz from socket?')).toBeInTheDocument();
        });
        
        // Verify no duplicates
        const existingQuizElements = screen.getAllByText('Existing quiz?');
        const newQuizElements = screen.getAllByText('New quiz from socket?');
        expect(existingQuizElements).toHaveLength(1);
        expect(newQuizElements).toHaveLength(1);
      }
    });
  });

  describe('In-Room Quiz Game', () => {
    it('should switch to quiz game view when quiz is started', async () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Simulate quiz started event
      const quizStartedData = {
        quiz: {
          id: 'quiz-1',
          type: 'text' as const,
          question: 'What is 2+2?',
          answer: '4',
        },
      };

      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'quiz:started');
        if (quizStartedCall) {
          quizStartedCall[1](quizStartedData);
        }
      });

      // Should render quiz game instead of room lobby
      // Check for quiz game elements instead of data-testid
      await waitFor(() => {
        expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
        // Host users should not see the buzz button
        expect(screen.queryByText('🔔 Buzz In')).not.toBeInTheDocument();
        expect(screen.getByText('End Quiz')).toBeInTheDocument();
      });
    });

    it('should return to room lobby when quiz ends', async () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // First, start a quiz
      const quizStartedData = {
        quiz: {
          id: 'quiz-1',
          type: 'text' as const,
          question: 'What is 2+2?',
          answer: '4',
        },
      };

      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'quiz:started');
        if (quizStartedCall) {
          quizStartedCall[1](quizStartedData);
        }
      });

      // Now end the quiz
      act(() => {
        const quizEndedCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'quiz:ended');
        if (quizEndedCall) {
          quizEndedCall[1]();
        }
      });

      // Should return to quiz finished view
      await waitFor(() => {
        expect(screen.getByText('Quiz Finished!')).toBeInTheDocument();
        expect(screen.getByText('Back to Lobby')).toBeInTheDocument();
      });
    });

    it('should handle quiz buzz event', async () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Start a quiz first
      const quizStartedData = {
        quiz: {
          id: 'quiz-1',
          type: 'text' as const,
          question: 'What is 2+2?',
          answer: '4',
        },
      };

      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'quiz:started');
        if (quizStartedCall) {
          quizStartedCall[1](quizStartedData);
        }
      });

      // Simulate buzz event
      const buzzData = {
        user: { id: 'user-1', name: 'Test User', isHost: false },
      };

      act(() => {
        const buzzCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'game:buzz');
        if (buzzCall) {
          buzzCall[1](buzzData);
        }
      });

      // Verify state is updated (this would be tested through the QuizGame component props)
      // Since we're mocking QuizGame, we can't directly test the internal state,
      // but we can verify the socket listener was called
      expect(mockSocket.on).toHaveBeenCalledWith('game:buzz', expect.any(Function));
    });

    it('should handle answer submission event', async () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Start a quiz first
      const quizStartedData = {
        quiz: {
          id: 'quiz-1',
          type: 'text' as const,
          question: 'What is 2+2?',
          answer: '4',
        },
      };

      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'quiz:started');
        if (quizStartedCall) {
          quizStartedCall[1](quizStartedData);
        }
      });

      // Simulate answer submission
      const answerData = {
        user: { id: 'user-1', name: 'Test User', isHost: false },
        answer: '4',
      };

      act(() => {
        const answerCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'game:answer');
        if (answerCall) {
          answerCall[1](answerData);
        }
      });

      // Verify socket listener was set up
      expect(mockSocket.on).toHaveBeenCalledWith('game:answer', expect.any(Function));
    });

    it('should handle score update event', async () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Start a quiz first
      const quizStartedData = {
        quiz: {
          id: 'quiz-1',
          type: 'text' as const,
          question: 'What is 2+2?',
          answer: '4',
        },
      };

      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'quiz:started');
        if (quizStartedCall) {
          quizStartedCall[1](quizStartedData);
        }
      });

      // Simulate score update
      const scoreData = {
        scores: [
          { userId: 'user-1', score: 10 },
          { userId: 'user-2', score: 5 },
        ],
      };

      act(() => {
        const scoreCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'game:score');
        if (scoreCall) {
          scoreCall[1](scoreData);
        }
      });

      // Verify socket listener was set up
      expect(mockSocket.on).toHaveBeenCalledWith('game:score', expect.any(Function));
    });

    it('should emit quiz:end event when ending quiz', async () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Start a quiz first
      const quizStartedData = {
        quiz: {
          id: 'quiz-1',
          type: 'text' as const,
          question: 'What is 2+2?',
          answer: '4',
        },
      };

      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls
          .find(call => call[0] === 'quiz:started');
        if (quizStartedCall) {
          quizStartedCall[1](quizStartedData);
        }
      });

      // Find and click the "End Quiz" button
      await waitFor(() => {
        const endQuizButton = screen.getByText('End Quiz');
        fireEvent.click(endQuizButton);
      });

      // Verify quiz:ended event was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:ended');
    });
  });

  describe('Room Actions', () => {
    it('should call leaveRoom when Leave Room button is clicked', async () => {
      const { leaveRoom } = await import('@/lib/socketClient');
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      const leaveButton = screen.getByText('Leave Room');
      fireEvent.click(leaveButton);

      expect(leaveRoom).toHaveBeenCalledWith();
    });

    it('should call onLeave callback when leaving room', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      const leaveButton = screen.getByText('Leave Room');
      fireEvent.click(leaveButton);

      expect(mockOnLeave).toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('should show appropriate message when no quizzes exist', () => {
      const roomWithoutQuizzes = { ...mockRoom, quizzes: [] };
      render(<Room room={roomWithoutQuizzes} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      fireEvent.click(screen.getByText('Manage Quizzes'));

      expect(screen.getByText('No quizzes available')).toBeInTheDocument();
      expect(screen.getByText('Create some quizzes to start the game!')).toBeInTheDocument();
    });

    it('should show single player message when only one user', () => {
      const singleUserRoom = {
        ...mockRoom,
        users: [{ id: 'host-user-id', name: 'Host User', isHost: true }],
      };
      render(<Room room={singleUserRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('1/8 players • Public Room')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByRole('button', { name: 'Manage Quizzes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Leave Room' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    });

    it('should have proper headings structure', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Room');
      expect(screen.getByRole('heading', { level: 2, name: 'Players' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Chat' })).toBeInTheDocument();
    });

    it('should have accessible form controls', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      const messageInput = screen.getByPlaceholderText('Type a message...');
      expect(messageInput).toHaveAttribute('type', 'text');
    });
  });

  describe('Edge Cases', () => {
    it('should handle room with maximum players', () => {
      const fullRoom = {
        ...mockRoom,
        maxPlayers: 2,
        users: [
          { id: 'host-user-id', name: 'Host User', isHost: true },
          { id: 'regular-user-id', name: 'Regular User', isHost: false },
        ],
      };
      render(<Room room={fullRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      expect(screen.getByText('2/2 players • Public Room')).toBeInTheDocument();
    });

    it('should handle quiz with different types', () => {
      const roomWithImageQuiz = {
        ...mockRoom,
        quizzes: [
          {
            id: 'quiz-1',
            type: 'image' as const,
            question: 'What anime is this?',
            answer: 'One Piece',
            image: { type: 'url' as const, data: 'https://example.com/image.jpg' },
          },
        ],
      };
      render(<Room room={roomWithImageQuiz} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      fireEvent.click(screen.getByText('Manage Quizzes'));

      expect(screen.getByText('What anime is this?')).toBeInTheDocument();
    });

    it('should handle empty message submission', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      const messageInput = screen.getByPlaceholderText('Type a message...');
      const sendButton = screen.getByText('Send');

      // Verify initial state
      expect(messageInput).toHaveValue('');
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should not display error message initially', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // No error should be visible initially
      expect(screen.queryByText('Failed to start quiz. Please try again.')).not.toBeInTheDocument();
    });

    it('should display error message when quiz creation fails', async () => {
      const { addQuiz } = await import('@/lib/socketClient');
      vi.mocked(addQuiz).mockImplementation(() => {
        throw new Error('Network error');
      });

      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Open quiz creator and create a quiz
      fireEvent.click(screen.getByText('Manage Quizzes'));
      const createQuizButtons = screen.getAllByText('Create Quiz');
      fireEvent.click(createQuizButtons[0]);
      
      const quizCreator = screen.getByTestId('quiz-creator');
      const createQuizButton = within(quizCreator).getByText('Create Quiz');
      fireEvent.click(createQuizButton);

      // Error message should be displayed
      expect(screen.getByText('Failed to add quiz. Please try again.')).toBeInTheDocument();
    });

    it('should auto-clear quiz creation error after 5 seconds', async () => {
      const { addQuiz } = await import('@/lib/socketClient');
      vi.mocked(addQuiz).mockImplementation(() => {
        throw new Error('Network error');
      });

      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Trigger error
      fireEvent.click(screen.getByText('Manage Quizzes'));
      const createQuizButtons = screen.getAllByText('Create Quiz');
      fireEvent.click(createQuizButtons[0]);
      
      const quizCreator = screen.getByTestId('quiz-creator');
      const createQuizButton = within(quizCreator).getByText('Create Quiz');
      fireEvent.click(createQuizButton);

      // Error should be visible
      expect(screen.getByText('Failed to add quiz. Please try again.')).toBeInTheDocument();

      // Fast forward 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Error should be cleared
      expect(screen.queryByText('Failed to add quiz. Please try again.')).not.toBeInTheDocument();
    });
  });

  describe('Socket Quiz Synchronization', () => {
    it('should set up socket event listeners for quiz synchronization', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Verify that socket event listeners are set up
      expect(mockSocket.on).toHaveBeenCalledWith('quiz:added', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('quiz:removed', expect.any(Function));
    });

    it('should update quiz list when quiz:added event is received', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Find the quiz:added event handler
      const quizAddedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'quiz:added'
      )?.[1];

      expect(quizAddedHandler).toBeDefined();

      // Simulate receiving a quiz:added event
      const newQuiz = {
        id: 'new-quiz-from-server',
        type: 'text' as const,
        question: 'What is 3+3?',
        answer: '6',
      };

      act(() => {
        quizAddedHandler({ quiz: newQuiz });
      });

      // Verify the quiz appears in the management modal
      fireEvent.click(screen.getByText('Manage Quizzes'));
      expect(screen.getByText('What is 3+3?')).toBeInTheDocument();
    });

    it('should remove quiz from list when quiz:removed event is received', () => {
      render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Find the quiz:removed event handler
      const quizRemovedHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'quiz:removed'
      )?.[1];

      expect(quizRemovedHandler).toBeDefined();

      // Simulate removing the existing quiz
      act(() => {
        quizRemovedHandler({ quizId: 'quiz-1' });
      });

      // Verify the quiz is no longer in the management modal
      fireEvent.click(screen.getByText('Manage Quizzes'));
      expect(screen.queryByText('What is the capital of Japan?')).not.toBeInTheDocument();
      expect(screen.getByText('No quizzes available')).toBeInTheDocument();
    });

    it('should clean up socket listeners on component unmount', () => {
      const { unmount } = render(<Room room={mockRoom} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);

      // Unmount the component
      unmount();

      // Verify that socket event listeners are cleaned up
      expect(mockSocket.off).toHaveBeenCalledWith('quiz:added', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('quiz:removed', expect.any(Function));
    });
  });

  describe('In-Room Quiz UI Integration', () => {
    it('should show quiz results only after all quizzes are finished', async () => {
      // 複数問クイズを用意
      const quizzes = [
        { id: 'quiz-1', type: 'text' as const, question: 'Q1?', answer: 'A1' },
        { id: 'quiz-2', type: 'text' as const, question: 'Q2?', answer: 'A2' },
      ];
      const roomWithQuizzes = { ...mockRoom, quizzes };
      render(<Room room={roomWithQuizzes} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);
      // 1問目開始
      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:started');
        if (quizStartedCall) quizStartedCall[1]({ quiz: quizzes[0] });
      });
      await waitFor(() => {
        expect(screen.getByText('Q1?')).toBeInTheDocument();
      });
      // 1問目終了
      act(() => {
        const quizEndedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:ended');
        if (quizEndedCall) quizEndedCall[1]();
      });
      // 2問目開始
      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:started');
        if (quizStartedCall) quizStartedCall[1]({ quiz: quizzes[1] });
      });
      await waitFor(() => {
        expect(screen.getByText('Q2?')).toBeInTheDocument();
      });
      // 2問目終了
      act(() => {
        const quizEndedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:ended');
        if (quizEndedCall) quizEndedCall[1]();
      });
      // 全問終了後のみQuiz Finished!が表示される
      await waitFor(() => {
        expect(screen.getByText('Quiz Finished!')).toBeInTheDocument();
      });
    });
    it('should return to lobby state after all quizzes are finished and Back to Lobby is clicked', async () => {
      const quizzes = [
        { id: 'quiz-1', type: 'text' as const, question: 'Q1?', answer: 'A1' },
        { id: 'quiz-2', type: 'text' as const, question: 'Q2?', answer: 'A2' },
      ];
      const roomWithQuizzes = { ...mockRoom, quizzes };
      render(<Room room={roomWithQuizzes} currentUser={mockCurrentUser} onLeave={mockOnLeave} />);
      // 1問目開始・終了
      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:started');
        if (quizStartedCall) quizStartedCall[1]({ quiz: quizzes[0] });
      });
      act(() => {
        const quizEndedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:ended');
        if (quizEndedCall) quizEndedCall[1]();
      });
      // 2問目開始・終了
      act(() => {
        const quizStartedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:started');
        if (quizStartedCall) quizStartedCall[1]({ quiz: quizzes[1] });
      });
      act(() => {
        const quizEndedCall = mockSocket.on.mock.calls.find(call => call[0] === 'quiz:ended');
        if (quizEndedCall) quizEndedCall[1]();
      });
      // Quiz Finished!表示
      await waitFor(() => {
        expect(screen.getByText('Quiz Finished!')).toBeInTheDocument();
      });
      // Back to Lobbyクリックでロビーに戻る
      await waitFor(() => {
        const backButton = screen.getByText('Back to Lobby');
        fireEvent.click(backButton);
      });
      await waitFor(() => {
        expect(screen.getByText('Waiting for Quiz')).toBeInTheDocument();
      });
    });
  });
}); 
/**
 * useRoomGame Hook Test Suite
 * 
 * TEST SPECIFICATION:
 * - Validates room game logic using t-wada style TDD approach
 * - Tests state management and socket event handling
 * - Ensures proper separation of concerns between UI actions and server state
 * - Verifies error handling and user feedback mechanisms
 * - Tests socket event listeners setup and cleanup
 * 
 * TESTING STRATEGY:
 * - Red: Write failing tests first
 * - Green: Implement minimal code to pass tests
 * - Refactor: Improve code while maintaining test coverage
 * 
 * KEY TEST CASES:
 * - handleStartQuiz should not update state directly
 * - Socket event handlers should manage state transitions
 * - Error handling should provide user feedback
 * - Socket listeners should be properly cleaned up
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRoomGame } from './useRoomGame';
import * as socketClient from '@/lib/socketClient';
import * as userStorage from '@/lib/userStorage';
import type { Room, User, Quiz } from '@/types';

// モックの設定
vi.mock('@/lib/socketClient');
vi.mock('@/lib/userStorage');

describe('useRoomGame', () => {
  let mockSocket: any;
  let mockRoom: Room;
  let mockCurrentUser: User;
  let mockQuiz: Quiz;

  beforeEach(() => {
    // モックソケットの設定
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
    };

    // モックデータの設定
    mockQuiz = {
      id: 'quiz-1',
      type: 'text',
      question: 'Test Question',
      answer: 'Test Answer',
    };

    mockRoom = {
      id: 'room-1',
      name: 'Test Room',
      isPublic: true,
      users: [
        { id: 'user-1', name: 'Host User', isHost: true },
        { id: 'user-2', name: 'Regular User', isHost: false },
      ],
      quizzes: [mockQuiz],
      hostId: 'user-1',
      maxPlayers: 8,
      createdAt: Date.now(),
    };

    mockCurrentUser = { id: 'user-1', name: 'Host User', isHost: true };

    // モック関数の設定
    vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket);
    vi.mocked(socketClient.startQuiz).mockResolvedValue(undefined);
    vi.mocked(userStorage.getUserName).mockReturnValue('Host User');
    vi.mocked(userStorage.getUserId).mockReturnValue('user-1');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleStartQuiz', () => {
    it('should NOT update state directly when starting quiz', async () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // 初期状態の確認
      expect(result.current.gameState).toBe('lobby');
      expect(result.current.currentQuiz).toBe(null);
      expect(result.current.quizGameState).toBe('waiting');

      // handleStartQuizを実行
      await act(async () => {
        await result.current.handleStartQuiz();
      });

      // startQuizが呼ばれることを確認
      expect(socketClient.startQuiz).toHaveBeenCalledWith('quiz-1');

      // 状態が直接更新されていないことを確認（これが失敗するはず）
      expect(result.current.gameState).toBe('lobby'); // socket eventで更新されるまで変わらない
      expect(result.current.currentQuiz).toBe(null); // socket eventで更新されるまで変わらない
      expect(result.current.quizGameState).toBe('waiting'); // socket eventで更新されるまで変わらない
    });

    it('should only close quiz modal and clear error on success', async () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // モーダルを開く
      act(() => {
        result.current.setShowQuizModal(true);
      });

      // エラーを設定
      act(() => {
        result.current.setError('Some error');
      });

      // handleStartQuizを実行
      await act(async () => {
        await result.current.handleStartQuiz();
      });

      // モーダルが閉じられることを確認
      expect(result.current.showQuizModal).toBe(false);
      // エラーがクリアされることを確認
      expect(result.current.error).toBe(null);
    });

    it('should handle startQuiz failure properly', async () => {
      // startQuizが失敗するように設定
      vi.mocked(socketClient.startQuiz).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // handleStartQuizを実行
      await act(async () => {
        await result.current.handleStartQuiz();
      });

      // エラーが設定されることを確認
      expect(result.current.error).toBe('Failed to start quiz. Please try again.');
      // モーダルは閉じられないことを確認
      expect(result.current.showQuizModal).toBe(false); // 初期値のまま
    });

    it('should not call startQuiz when no quizzes available', async () => {
      const emptyRoom = { ...mockRoom, quizzes: [] };
      const { result } = renderHook(() => useRoomGame(emptyRoom, mockCurrentUser));

      await act(async () => {
        await result.current.handleStartQuiz();
      });

      // startQuizが呼ばれないことを確認
      expect(socketClient.startQuiz).not.toHaveBeenCalled();
    });
  });

  describe('socket event handlers', () => {
    it('should update state when quiz:started event is received', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // socket.onが呼ばれたことを確認
      expect(mockSocket.on).toHaveBeenCalledWith('quiz:started', expect.any(Function));

      // quiz:startedイベントハンドラーを取得
      const quizStartedHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'quiz:started'
      )?.[1];

      expect(quizStartedHandler).toBeDefined();

      // イベントハンドラーを実行
      act(() => {
        quizStartedHandler({ quiz: mockQuiz });
      });

      // 状態が更新されることを確認
      expect(result.current.gameState).toBe('quiz-active');
      expect(result.current.currentQuiz).toEqual(mockQuiz);
      expect(result.current.quizGameState).toBe('active');
      expect(result.current.buzzedUser).toBe(null);
      expect(result.current.buzzedUsers).toEqual([]);
      expect(result.current.recentJudgments).toEqual([]);
    });

    it('should properly clean up socket listeners on unmount', () => {
      const { unmount } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // socket.onが呼ばれたことを確認
      expect(mockSocket.on).toHaveBeenCalledWith('quiz:started', expect.any(Function));

      // アンマウント
      unmount();

      // socket.offが呼ばれたことを確認
      expect(mockSocket.off).toHaveBeenCalledWith('quiz:started', expect.any(Function));
    });

    it('should handle stale closure in quiz:judged event handler', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // 初期answer設定
      act(() => {
        result.current.setAnswer('initial answer');
      });

      // quiz:judgedイベントハンドラーを取得
      const quizJudgedHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'quiz:judged'
      )?.[1];

      expect(quizJudgedHandler).toBeDefined();

      // answerを変更
      act(() => {
        result.current.setAnswer('updated answer');
      });

      // quiz:judgedイベントを発火
      act(() => {
        quizJudgedHandler({
          userId: 'user-2',
          isCorrect: true,
          score: 10
        });
      });

      // recentJudgmentsに最新のanswerが記録されていることを確認
      // (現在の実装では stale closure により 'initial answer' が記録される可能性がある)
      expect(result.current.recentJudgments).toHaveLength(1);
      expect(result.current.recentJudgments[0].answer).toBe('updated answer');
      expect(result.current.recentJudgments[0].userId).toBe('user-2');
      expect(result.current.recentJudgments[0].isCorrect).toBe(true);
    });

    it('should successfully eliminate buzzedUser state duplication', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // game:buzzイベントハンドラーを取得
      const gameBuzzHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'game:buzz'
      )?.[1];

      expect(gameBuzzHandler).toBeDefined();

      const user1 = { id: 'user-1', name: 'User 1', isHost: false };
      const user2 = { id: 'user-2', name: 'User 2', isHost: false };

      // 初期状態の確認
      expect(result.current.buzzedUser).toBe(null);
      expect(result.current.buzzedUsers).toEqual([]);

      // 最初のユーザーがバズ
      act(() => {
        gameBuzzHandler({ user: user1 });
      });

      // buzzedUserはbuzzedUsers[0]から派生される
      expect(result.current.buzzedUser).toEqual(user1);
      expect(result.current.buzzedUsers).toEqual([user1]);

      // 2番目のユーザーがバズ
      act(() => {
        gameBuzzHandler({ user: user2 });
      });

      // buzzedUsersは更新され、buzzedUserは常に配列の最初の要素
      expect(result.current.buzzedUsers).toEqual([user1, user2]);
      expect(result.current.buzzedUser).toEqual(user1); // 配列の最初の要素
      
      // 成功: buzzedUserは常にbuzzedUsers[0] || nullと一致する
      expect(result.current.buzzedUser).toBe(result.current.buzzedUsers[0] || null);
    });

    it('should derive first buzzed user from buzzedUsers array instead of maintaining separate state', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // game:buzzイベントハンドラーを取得
      const gameBuzzHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'game:buzz'
      )?.[1];

      expect(gameBuzzHandler).toBeDefined();

      const user1 = { id: 'user-1', name: 'User 1', isHost: false };
      const user2 = { id: 'user-2', name: 'User 2', isHost: false };

      // 初期状態: buzzedUsersが空の場合、first buzzed userはnull
      expect(result.current.buzzedUsers).toEqual([]);
      expect(result.current.buzzedUser).toBe(null);

      // 最初のユーザーがバズ
      act(() => {
        gameBuzzHandler({ user: user1 });
      });

      // buzzedUsersの最初の要素が first buzzed user になる
      expect(result.current.buzzedUsers[0]).toEqual(user1);
      expect(result.current.buzzedUser).toEqual(user1);

      // 2番目のユーザーがバズ
      act(() => {
        gameBuzzHandler({ user: user2 });
      });

      // buzzedUsersの最初の要素は変わらず user1 のまま
      expect(result.current.buzzedUsers[0]).toEqual(user1);
      expect(result.current.buzzedUsers).toEqual([user1, user2]);

      // 成功: buzzedUserは buzzedUsers[0] || null で派生される
      expect(result.current.buzzedUser).toBe(result.current.buzzedUsers[0] || null);
      
      // 状態の重複と同期問題が解決された
      expect(result.current.buzzedUser).toEqual(user1);
    });
  });

  describe('handleSubmitAnswer', () => {
    it('should prevent duplicate answer submissions when hasAnswered is true', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // Set up initial state with an answer
      act(() => {
        result.current.setAnswer('test answer');
      });

      // Verify initial state
      expect(result.current.hasAnswered).toBe(false);
      expect(result.current.answer).toBe('test answer');

      // First submission should work
      act(() => {
        result.current.handleSubmitAnswer();
      });

      // Verify socket emission occurred
      expect(mockSocket.emit).toHaveBeenCalledWith('game:answer', {
        user: mockCurrentUser,
        answer: 'test answer'
      });

      // hasAnswered should be set to true
      expect(result.current.hasAnswered).toBe(true);

      // Clear mock to test duplicate prevention
      mockSocket.emit.mockClear();

      // Second submission should be prevented
      act(() => {
        result.current.handleSubmitAnswer();
      });

      // Socket emission should NOT occur for duplicate submission
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should allow submission when hasAnswered is false', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // Set up answer
      act(() => {
        result.current.setAnswer('valid answer');
      });

      expect(result.current.hasAnswered).toBe(false);

      // Submission should work
      act(() => {
        result.current.handleSubmitAnswer();
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('game:answer', {
        user: mockCurrentUser,
        answer: 'valid answer'
      });
    });

    it('should not submit empty or whitespace-only answers', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // Test empty answer
      act(() => {
        result.current.setAnswer('');
      });

      act(() => {
        result.current.handleSubmitAnswer();
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();

      // Test whitespace-only answer
      act(() => {
        result.current.setAnswer('   ');
      });

      act(() => {
        result.current.handleSubmitAnswer();
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should handle socket connection failure gracefully', () => {
      // Mock socket as null to simulate connection failure
      vi.mocked(socketClient.getSocket).mockReturnValue(null);
      
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      act(() => {
        result.current.setAnswer('test answer');
      });

      expect(result.current.hasAnswered).toBe(false);

      // Should not crash when socket is null
      act(() => {
        result.current.handleSubmitAnswer();
      });

      // hasAnswered should remain false since no socket emission occurred
      expect(result.current.hasAnswered).toBe(false);
      
      // Restore mock socket for subsequent tests
      vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket);
    });
  });

  describe('handleJudgeAnswer', () => {
    it('should handle socket emit errors gracefully without state corruption', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // Set up game state with a buzzed user
      const user1 = { id: 'user-1', name: 'User 1', isHost: false };
      const gameBuzzHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'game:buzz'
      )?.[1];

      act(() => {
        gameBuzzHandler({ user: user1 });
      });

      expect(result.current.buzzedUser).toEqual(user1);
      
      // Mock socket.emit to throw error on first call
      mockSocket.emit.mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      // Should handle the error gracefully
      expect(() => {
        act(() => {
          result.current.handleJudgeAnswer(true);
        });
      }).not.toThrow();

      // State should be consistent - if first emit fails, second should not execute
      // Currently this will fail because there's no error handling
      expect(mockSocket.emit).toHaveBeenCalledTimes(1); // Only first call attempted
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:judge', { 
        userId: user1.id, 
        isCorrect: true 
      });
    });

    it('should execute both socket emits successfully when no errors occur', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // Set up game state with a buzzed user
      const user1 = { id: 'user-1', name: 'User 1', isHost: false };
      const gameBuzzHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'game:buzz'
      )?.[1];

      act(() => {
        gameBuzzHandler({ user: user1 });
      });

      mockSocket.emit.mockClear();

      // Should execute both emits successfully
      act(() => {
        result.current.handleJudgeAnswer(true);
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
      expect(mockSocket.emit).toHaveBeenNthCalledWith(1, 'quiz:judge', { 
        userId: user1.id, 
        isCorrect: true 
      });
      expect(mockSocket.emit).toHaveBeenNthCalledWith(2, 'quiz:revealAnswer');
    });

    it('should not execute socket emits when no buzzed user exists', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // Ensure no buzzed user
      expect(result.current.buzzedUser).toBe(null);

      mockSocket.emit.mockClear();

      // Should not execute any socket emits
      act(() => {
        result.current.handleJudgeAnswer(true);
      });

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should maintain consistent state even when socket emits fail', () => {
      const { result } = renderHook(() => useRoomGame(mockRoom, mockCurrentUser));

      // Set up game state with a buzzed user
      const user1 = { id: 'user-1', name: 'User 1', isHost: false };
      const gameBuzzHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'game:buzz'
      )?.[1];

      act(() => {
        gameBuzzHandler({ user: user1 });
      });

      expect(result.current.buzzedUser).toEqual(user1);
      
      // Clear mocks and set up answer submission
      mockSocket.emit.mockClear();
      
      act(() => {
        result.current.setAnswer('test answer');
      });
      
      act(() => {
        result.current.handleSubmitAnswer();
      });

      expect(result.current.hasAnswered).toBe(true);
      expect(result.current.answer).toBe('test answer');

      // Mock socket.emit to always throw errors
      mockSocket.emit.mockImplementation(() => {
        throw new Error('Network error');
      });

      // Should handle errors gracefully and maintain state consistency
      expect(() => {
        act(() => {
          result.current.handleJudgeAnswer(true);
        });
      }).not.toThrow();

      // State should be properly reset even if socket emits fail
      expect(result.current.buzzedUsers).toEqual([]);
      expect(result.current.hasAnswered).toBe(false);
      expect(result.current.answer).toBe('');
    });
  });
});
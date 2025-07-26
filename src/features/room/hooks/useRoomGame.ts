/**
 * useRoomGame Hook - Room Game Logic Management
 * 
 * SPECIFICATION:
 * - Manages room-level game state and quiz interactions
 * - Handles socket communication for real-time multiplayer features
 * - Provides handlers for quiz lifecycle (start, answer, judge, end)
 * - Manages user interactions like buzzing and answer submission
 * - Ensures state consistency through server-side event handling
 * - Prevents race conditions by delegating state updates to socket event handlers
 * 
 * KEY BEHAVIORS:
 * - handleStartQuiz: Only triggers socket event, state updates handled by handleQuizStarted
 * - handleSubmitAnswer: Prevents duplicate submissions using hasAnswered state
 * - Socket event handlers: Manage all state transitions from server confirmations
 * - Error handling: Provides user feedback for failed operations
 * - UI state management: Controls modal visibility and form states
 * - Buzz system: Uses single buzzedUsers array, buzzedUser derived from first element
 * 
 * DEPENDENCIES:
 * - @/lib/socketClient: Real-time communication with server
 * - @/lib/userStorage: User session persistence
 * - @/types: Type definitions for Room, User, Quiz, Score
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Room, User, Quiz, Score } from '@/types';
import { leaveRoom, addQuiz, getSocket, startQuiz } from '@/lib/socketClient';
import { getStoredUserName, getStoredUserId } from '@/lib/userStorage';

export function useRoomGame(room: Room, currentUser: User, onLeave?: () => void) {
  // State
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showQuizCreator, setShowQuizCreator] = useState(false);
  const [roomQuizzes, setRoomQuizzes] = useState(room.quizzes);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<'lobby' | 'quiz-active' | 'quiz-answered' | 'quiz-finished'>('lobby');
  const [currentQuizIndex, setCurrentQuizIndex] = useState<number>(0);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizGameState, setQuizGameState] = useState<'waiting' | 'active' | 'answered' | 'finished'>('waiting');
  const [scores, setScores] = useState<Score[]>([]);
  const [buzzedUsers, setBuzzedUsers] = useState<User[]>([]);
  
  // buzzedUserを配列から派生させる
  const buzzedUser = buzzedUsers[0] || null;
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [recentJudgments, setRecentJudgments] = useState<{ userId: string; answer: string; isCorrect: boolean; timestamp: number }[]>([]);

  // useRefを使用してstale closure問題を解決
  const answerRef = useRef(answer);
  answerRef.current = answer;

  const isHost = currentUser.isHost;
  const currentUserName = getStoredUserName() || currentUser.name;
  const currentUserId = getStoredUserId();

  // roomQuizzes同期
  useEffect(() => {
    setRoomQuizzes(room.quizzes);
  }, [room.quizzes]);

  // リセット用ハンドラー
  const handleResetAnswerForm = useCallback(() => {
    setAnswer('');
    setHasAnswered(false);
    setShowAnswer(false);
  }, []);

  // ソケットイベントハンドラー群
  const createSocketEventHandlers = useCallback(() => {
    const handleQuizAdded = (data: { quiz: Quiz }) => {
      setRoomQuizzes(prev => {
        const existingQuizIndex = prev.findIndex(quiz => quiz.id === data.quiz.id);
        if (existingQuizIndex !== -1) return prev;
        return [...prev, data.quiz];
      });
    };

    const handleQuizRemoved = (data: { quizId: string }) => {
      setRoomQuizzes(prev => prev.filter(quiz => quiz.id !== data.quizId));
    };

    const handleQuizStarted = (data: { quiz: Quiz }) => {
      setCurrentQuiz(data.quiz);
      const idx = roomQuizzes.findIndex(q => q.id === data.quiz.id);
      if (idx !== -1) setCurrentQuizIndex(idx);
      setGameState('quiz-active');
      setQuizGameState('active');
      setBuzzedUsers([]);
      handleResetAnswerForm();
      setRecentJudgments([]);
    };

    const handleQuizEnded = () => {
      setGameState('quiz-finished');
      setQuizGameState('finished');
      setBuzzedUsers([]);
      handleResetAnswerForm();
    };

    const handleBuzzIn = (data: { user: User }) => {
      const userStillInRoom = room.users.some(u => u.id === data.user.id);
      if (!userStillInRoom) return;
      setBuzzedUsers(prev => {
        const alreadyBuzzed = prev.some((u: User) => u.id === data.user.id);
        if (!alreadyBuzzed) return [...prev, data.user];
        return prev;
      });
    };

    const handleAnswerSubmitted = (data: { user: User, answer: string }) => {
      setQuizGameState('answered');
      setHasAnswered(true);
      setAnswer(data.answer);
      // buzzedUserは派生値なので、setBuzzedUsersで管理
      setBuzzedUsers(prev => {
        const alreadyBuzzed = prev.some((u: User) => u.id === data.user.id);
        if (!alreadyBuzzed) return [data.user, ...prev];
        return prev;
      });
    };

    const handleScoreUpdate = (data: { scores: Score[] }) => {
      setScores(data.scores);
    };

    const handleQuizJudged = (data: { userId: string; isCorrect: boolean; score: number }) => {
      setRecentJudgments(prev => {
        const filtered = prev.filter(judgment => judgment.userId !== data.userId);
        return [...filtered, {
          userId: data.userId,
          answer: answerRef.current,
          isCorrect: data.isCorrect,
          timestamp: Date.now()
        }];
      });
      setScores(prev => {
        const existingScoreIndex = prev.findIndex(score => score.userId === data.userId);
        if (existingScoreIndex !== -1) {
          const newScores = [...prev];
          newScores[existingScoreIndex] = { ...newScores[existingScoreIndex], score: newScores[existingScoreIndex].score + data.score };
          return newScores;
        } else {
          return [...prev, { userId: data.userId, score: data.score }];
        }
      });
      setBuzzedUsers([]);
      setHasAnswered(false);
      setAnswer('');
      setQuizGameState('finished');
    };

    const handleRevealAnswer = () => setShowAnswer(true);

    const handleFreeModeStarted = (data: { quiz: Quiz }) => {
      setRoomQuizzes([data.quiz]);
      setCurrentQuizIndex(0);
      setCurrentQuiz(data.quiz);
      setGameState('quiz-active');
      setQuizGameState('active');
      
      // Reset game state for all participants
      setScores(room.users.map(user => ({ userId: user.id, score: 0 })));
      setBuzzedUsers([]);
      handleResetAnswerForm();
      setRecentJudgments([]);
    };

    const handleFreeModeReset = () => {
      // Reset buzz and answer state for participants
      setBuzzedUsers([]);
      setAnswer('');
      setHasAnswered(false);
      setShowAnswer(false);
      setQuizGameState('active');
      handleResetAnswerForm();
      
      console.log('Free Mode reset received from host');
    };

    return {
      handleQuizAdded,
      handleQuizRemoved,
      handleQuizStarted,
      handleQuizEnded,
      handleBuzzIn,
      handleAnswerSubmitted,
      handleScoreUpdate,
      handleQuizJudged,
      handleRevealAnswer,
      handleFreeModeStarted,
      handleFreeModeReset,
    };
  }, [room.users, roomQuizzes, handleResetAnswerForm]);

  // ソケットイベント登録
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handlers = createSocketEventHandlers();

    // イベントリスナー登録
    socket.on('quiz:added', handlers.handleQuizAdded);
    socket.on('quiz:removed', handlers.handleQuizRemoved);
    socket.on('quiz:started', handlers.handleQuizStarted);
    socket.on('quiz:ended', handlers.handleQuizEnded);
    socket.on('game:buzz', handlers.handleBuzzIn);
    socket.on('game:answer', handlers.handleAnswerSubmitted);
    socket.on('game:score', handlers.handleScoreUpdate);
    socket.on('quiz:judged', handlers.handleQuizJudged);
    socket.on('quiz:revealAnswer', handlers.handleRevealAnswer);
    socket.on('game:freeModeStarted', handlers.handleFreeModeStarted);
    socket.on('game:freeModeReset', handlers.handleFreeModeReset);

    // クリーンアップ
    return () => {
      socket.off('quiz:added', handlers.handleQuizAdded);
      socket.off('quiz:removed', handlers.handleQuizRemoved);
      socket.off('quiz:started', handlers.handleQuizStarted);
      socket.off('quiz:ended', handlers.handleQuizEnded);
      socket.off('game:buzz', handlers.handleBuzzIn);
      socket.off('game:answer', handlers.handleAnswerSubmitted);
      socket.off('game:score', handlers.handleScoreUpdate);
      socket.off('quiz:judged', handlers.handleQuizJudged);
      socket.off('quiz:revealAnswer', handlers.handleRevealAnswer);
      socket.off('game:freeModeStarted', handlers.handleFreeModeStarted);
      socket.off('game:freeModeReset', handlers.handleFreeModeReset);
    };
  }, [createSocketEventHandlers]);

  // ハンドラ群
  const handleLeaveRoom = () => {
    leaveRoom();
    onLeave?.();
  };
  const handleStartQuiz = async () => {
    if (roomQuizzes.length === 0) return;
    try {
      await startQuiz(roomQuizzes[0].id);
      setError(null);
      setShowQuizModal(false);
    } catch {
      setError('Failed to start quiz. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };
  const handleEndQuiz = () => {
    setGameState('lobby');
    setQuizGameState('waiting');
    setCurrentQuiz(null);
    setCurrentQuizIndex(0);
    setBuzzedUsers([]);
    const socket = getSocket();
    if (socket) {
      socket.emit('quiz:ended');
    }
  };
  const handleNextQuiz = () => {
    const nextIndex = currentQuizIndex + 1;
    if (nextIndex < roomQuizzes.length) {
      const socket = getSocket();
      if (socket) {
        socket.emit('quiz:start', { quizId: roomQuizzes[nextIndex].id });
      }
    } else {
      setGameState('quiz-finished');
      setQuizGameState('finished');
      setCurrentQuiz(null);
      setBuzzedUsers([]);
    }
  };

  /**
   * Handle Free Mode next round
   * Resets state for the next question in Free Mode without changing quiz
   */
  const handleFreeModeNextRound = () => {
    // Reset buzz and answer state for Free Mode next round
    setBuzzedUsers([]);
    setAnswer('');
    setHasAnswered(false);
    setShowAnswer(false);
    setQuizGameState('active'); // Keep quiz active for next round
    
    // Emit socket event to sync with all participants
    const socket = getSocket();
    if (socket && isHost) {
      try {
        socket.emit('game:freeModeReset');
        console.log('Free Mode reset for next round - synced to participants');
      } catch (error) {
        console.error('Failed to emit game:freeModeReset:', error);
      }
    } else {
      console.log('Free Mode reset for next round (participant)');
    }
  };
  const handleOpenQuizCreator = () => {
    setShowQuizModal(false);
    setShowQuizCreator(true);
  };
  const handleQuizCreated = async (quiz: Quiz) => {
    try {
      await addQuiz(quiz);
      setShowQuizCreator(false);
    } catch {
      setError('Failed to add quiz. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };
  const handleBuzzInUser = () => {
    const socket = getSocket();
    if (socket && !buzzedUser) {
      socket.emit('game:buzz', { user: currentUser });
    }
  };
  /**
   * Handles answer submission with duplicate prevention
   * 
   * VALIDATION RULES:
   * - Returns early if user has already answered (hasAnswered === true)
   * - Requires non-empty answer after trimming whitespace
   * - Requires active socket connection
   * 
   * SIDE EFFECTS:
   * - Emits 'game:answer' socket event with user and trimmed answer
   * - Sets hasAnswered to true to prevent duplicate submissions
   * - Handles socket errors gracefully with logging
   */
  const handleSubmitAnswer = () => {
    // Prevent duplicate submissions
    if (hasAnswered) {
      return;
    }
    
    if (answer.trim()) {
      const socket = getSocket();
      if (socket) {
        const submittedAnswer = answer.trim();
        try {
          socket.emit('game:answer', { user: currentUser, answer: submittedAnswer });
          setHasAnswered(true);
        } catch (error) {
          console.error('Failed to emit game:answer:', error);
        }
      }
    }
  };
  const handleShowAnswer = () => {
    setShowAnswer(true);
  };
  /**
   * Handles quiz answer judgment with error handling
   * 
   * RESPONSIBILITIES:
   * - Emits quiz:judge event with user judgment
   * - Emits quiz:revealAnswer event only if judge succeeds
   * - Performs state cleanup regardless of emit results
   * - Logs errors for debugging without throwing
   * 
   * ERROR HANDLING:
   * - Uses nested try-catch blocks for independent error handling
   * - Continues with second emit only if first succeeds
   * - Always performs state cleanup to prevent UI inconsistencies
   */
  const handleJudgeAnswer = (isCorrect: boolean) => {
    if (buzzedUser) {
      const socket = getSocket();
      if (socket) {
        let judgeSuccess = false;
        try {
          socket.emit('quiz:judge', { userId: buzzedUser.id, isCorrect });
          judgeSuccess = true;
        } catch (judgeError) {
          console.error('Failed to emit quiz:judge:', judgeError);
        }
        
        // Only execute second emit if first one succeeds
        if (judgeSuccess) {
          try {
            socket.emit('quiz:revealAnswer');
          } catch (revealError) {
            console.error('Failed to emit quiz:revealAnswer:', revealError);
          }
        }
      }
      // Always perform state cleanup to prevent UI inconsistencies
      setBuzzedUsers([]);
      setHasAnswered(false);
      setAnswer('');
    }
  };

  /**
   * Handle starting Free Mode directly (without quiz creation)
   * Creates a temporary free mode quiz and starts it locally, then syncs with all participants
   */
  const handleStartFreeMode = () => {
    const freeModeQuiz: Quiz = {
      id: `free-${Date.now()}`,
      type: 'free',
      question: 'Free Mode Quiz',
      answer: 'N/A',
    };
    
    try {
      // Start Free Mode locally for immediate feedback
      setRoomQuizzes([freeModeQuiz]);
      setCurrentQuizIndex(0);
      setCurrentQuiz(freeModeQuiz);
      setGameState('quiz-active');
      setQuizGameState('active');
      
      // Reset game state for all participants
      setScores(room.users.map(user => ({ userId: user.id, score: 0 })));
      setBuzzedUsers([]);
      setAnswer('');
      setHasAnswered(false);
      setShowAnswer(false);
      setRecentJudgments([]);
      
      // Emit socket event to sync with all participants
      const socket = getSocket();
      if (socket) {
        socket.emit('game:startFreeMode', { quiz: freeModeQuiz });
        console.log('Free Mode started locally and synced to participants');
      }
      
      setError(null);
    } catch (error) {
      console.error('Failed to start Free Mode:', error);
      setError('Failed to start Free Mode. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  return {
    // state
    showQuizModal, setShowQuizModal,
    showQuizCreator, setShowQuizCreator,
    roomQuizzes,
    error, setError,
    gameState,
    currentQuizIndex,
    currentQuiz,
    quizGameState,
    scores,
    buzzedUser,
    buzzedUsers,
    answer, setAnswer,
    hasAnswered,
    showAnswer,
    recentJudgments,
    isHost, currentUserName, currentUserId,
    // handlers
    handleLeaveRoom,
    handleStartQuiz,
    handleEndQuiz,
    handleNextQuiz,
    handleFreeModeNextRound,
    handleOpenQuizCreator,
    handleQuizCreated,
    handleBuzzInUser,
    handleSubmitAnswer,
    handleShowAnswer,
    handleJudgeAnswer,
    handleStartFreeMode,
  };
} 
/**
 * useRoomGame - Roomコンポーネントのロジックをカスタムフック化
 * - State管理
 * - ソケット通信
 * - ゲーム進行ハンドラ
 */
import { useState, useEffect } from 'react';
import type { Room, User, Quiz, Score } from '@/types';
import { leaveRoom, addQuiz, getSocket, startQuiz } from '@/lib/socketClient';
import { getUserName, getUserId } from '@/lib/userStorage';

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
  const [buzzedUser, setBuzzedUser] = useState<User | null>(null);
  const [buzzedUsers, setBuzzedUsers] = useState<User[]>([]);
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [recentJudgments, setRecentJudgments] = useState<{ userId: string; answer: string; isCorrect: boolean; timestamp: number }[]>([]);

  const isHost = currentUser.isHost;
  const currentUserName = getUserName() || currentUser.name;
  const currentUserId = getUserId();

  // roomQuizzes同期
  useEffect(() => {
    setRoomQuizzes(room.quizzes);
  }, [room.quizzes]);

  // ソケットイベント登録
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    // ...Room.tsxのsocket.on/offロジックをそのまま移植...
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
      setBuzzedUser(null);
      setBuzzedUsers([]);
      handleResetAnswerForm();
      setRecentJudgments([]);
    };
    const handleQuizEnded = () => {
      setGameState('quiz-finished');
      setQuizGameState('finished');
      setBuzzedUser(null);
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
      if (!buzzedUser) setBuzzedUser(data.user);
    };
    const handleAnswerSubmitted = (data: { user: User, answer: string }) => {
      setQuizGameState('answered');
      setHasAnswered(true);
      setAnswer(data.answer);
      if (!buzzedUser) setBuzzedUser(data.user);
    };
    const handleScoreUpdate = (data: { scores: Score[] }) => {
      setScores(data.scores);
    };
    const handleQuizJudged = (data: { userId: string; isCorrect: boolean; score: number }) => {
      setRecentJudgments(prev => {
        const filtered = prev.filter(judgment => judgment.userId !== data.userId);
        return [...filtered, {
          userId: data.userId,
          answer: answer,
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
      setBuzzedUser(null);
      setBuzzedUsers([]);
      setHasAnswered(false);
      setAnswer('');
      setQuizGameState('finished');
    };
    const handleRevealAnswer = () => setShowAnswer(true);
    socket.on('quiz:added', handleQuizAdded);
    socket.on('quiz:removed', handleQuizRemoved);
    socket.on('quiz:started', handleQuizStarted);
    socket.on('quiz:ended', handleQuizEnded);
    socket.on('game:buzz', handleBuzzIn);
    socket.on('game:answer', handleAnswerSubmitted);
    socket.on('game:score', handleScoreUpdate);
    socket.on('quiz:judged', handleQuizJudged);
    socket.on('quiz:revealAnswer', handleRevealAnswer);
    return () => {
      socket.off('quiz:added', handleQuizAdded);
      socket.off('quiz:removed', handleQuizRemoved);
      socket.off('quiz:started', handleQuizStarted);
      socket.off('quiz:ended', handleQuizEnded);
      socket.off('game:buzz', handleBuzzIn);
      socket.off('game:answer', handleAnswerSubmitted);
      socket.off('game:score', handleScoreUpdate);
      socket.off('quiz:judged', handleQuizJudged);
      socket.off('quiz:revealAnswer', handleRevealAnswer);
    };
  }, [room.users, buzzedUser, answer, isHost, roomQuizzes]);

  // ハンドラ群
  const handleLeaveRoom = () => {
    leaveRoom();
    onLeave?.();
  };
  const handleStartQuiz = async () => {
    if (roomQuizzes.length === 0) return;
    try {
      await startQuiz(roomQuizzes[0].id);
      setCurrentQuizIndex(0);
      setCurrentQuiz(roomQuizzes[0]);
      setGameState('quiz-active');
      setQuizGameState('active');
      setBuzzedUser(null);
      setBuzzedUsers([]);
      handleResetAnswerForm();
      setRecentJudgments([]);
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
    setBuzzedUser(null);
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
      setBuzzedUser(null);
      setBuzzedUsers([]);
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
  const handleSubmitAnswer = () => {
    if (answer.trim()) {
      const socket = getSocket();
      if (socket) {
        const submittedAnswer = answer.trim();
        socket.emit('game:answer', { user: currentUser, answer: submittedAnswer });
        setHasAnswered(true);
      }
    }
  };
  const handleShowAnswer = () => {
    setShowAnswer(true);
  };
  const handleResetAnswerForm = () => {
    setAnswer('');
    setHasAnswered(false);
    setShowAnswer(false);
  };
  const handleJudgeAnswer = (isCorrect: boolean) => {
    if (buzzedUser) {
      const socket = getSocket();
      if (socket) {
        socket.emit('quiz:judge', { userId: buzzedUser.id, isCorrect });
        socket.emit('quiz:revealAnswer');
      }
      setBuzzedUser(null);
      setHasAnswered(false);
      setAnswer('');
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
    handleOpenQuizCreator,
    handleQuizCreated,
    handleBuzzInUser,
    handleSubmitAnswer,
    handleShowAnswer,
    handleJudgeAnswer,
  };
} 
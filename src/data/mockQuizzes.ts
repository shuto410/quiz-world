/**
 * Mock quiz data for development and testing
 * - Provides sample quiz questions across different categories
 * - Includes both text-based and image-based quizzes
 * - Used for initial room setup and testing purposes
 */

import type { Quiz } from '@/types';

/**
 * Sample quiz questions for development and testing
 */
export const mockQuizzes: Quiz[] = [
  {
    id: 'quiz-1',
    type: 'text',
    question: '日本の首都はどこですか？',
    answer: '東京',
    choices: ['大阪', '京都', '東京', '名古屋'],
  },
  {
    id: 'quiz-2',
    type: 'text',
    question: '世界で最も高い山はどれですか？',
    answer: 'エベレスト',
    choices: ['富士山', 'エベレスト', 'キリマンジャロ', 'K2'],
  },
  {
    id: 'quiz-3',
    type: 'text',
    question: '1 + 1 = ?',
    answer: '2',
    choices: ['1', '2', '3', '4'],
  },
  {
    id: 'quiz-4',
    type: 'text',
    question: 'JavaScriptで変数を宣言するキーワードはどれですか？',
    answer: 'let',
    choices: ['var', 'let', 'const', 'すべて正しい'],
  },
  {
    id: 'quiz-5',
    type: 'text',
    question: 'Next.jsはどの会社が開発していますか？',
    answer: 'Vercel',
    choices: ['Google', 'Meta', 'Vercel', 'Microsoft'],
  },
  {
    id: 'quiz-6',
    type: 'text',
    question: 'TypeScriptは何をベースにしていますか？',
    answer: 'JavaScript',
    choices: ['Java', 'JavaScript', 'Python', 'C++'],
  },
  {
    id: 'quiz-7',
    type: 'image',
    question: 'この有名な建物の名前は何ですか？',
    answer: '東京タワー',
    image: {
      type: 'url',
      data: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',
    },
    choices: ['東京タワー', '東京スカイツリー', '通天閣', '京都タワー'],
  },
  {
    id: 'quiz-8',
    type: 'image',
    question: 'この動物の名前は何ですか？',
    answer: 'パンダ',
    image: {
      type: 'url',
      data: 'https://images.unsplash.com/photo-1548407260-da850faa41e3?w=400&h=300&fit=crop',
    },
    choices: ['コアラ', 'パンダ', 'クマ', 'レッサーパンダ'],
  },
  {
    id: 'quiz-9',
    type: 'text',
    question: '地球の衛星の名前は何ですか？',
    answer: '月',
    choices: ['太陽', '月', '火星', '木星'],
  },
  {
    id: 'quiz-10',
    type: 'text',
    question: 'HTTPSのデフォルトポート番号はいくつですか？',
    answer: '443',
    choices: ['80', '443', '8080', '3000'],
  },
];

/**
 * Get a random selection of quizzes
 * @param count - Number of quizzes to select
 * @returns Array of randomly selected quizzes
 */
export function getRandomQuizzes(count: number = 5): Quiz[] {
  const shuffled = [...mockQuizzes].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, mockQuizzes.length));
}

/**
 * Get quizzes by category
 * @param category - Category to filter by ('general', 'programming', 'geography', 'math')
 * @returns Array of quizzes in the specified category
 */
export function getQuizzesByCategory(category: 'general' | 'programming' | 'geography' | 'math'): Quiz[] {
  switch (category) {
    case 'programming':
      return mockQuizzes.filter(quiz => 
        quiz.question.includes('JavaScript') || 
        quiz.question.includes('TypeScript') || 
        quiz.question.includes('Next.js') ||
        quiz.question.includes('HTTP')
      );
    case 'geography':
      return mockQuizzes.filter(quiz => 
        quiz.question.includes('首都') || 
        quiz.question.includes('山') ||
        quiz.question.includes('建物') ||
        quiz.question.includes('地球')
      );
    case 'math':
      return mockQuizzes.filter(quiz => 
        quiz.question.includes('1 + 1') ||
        quiz.question.includes('ポート番号')
      );
    default:
      return mockQuizzes;
  }
}

/**
 * Create a demo room with mock quizzes
 * @param quizCount - Number of quizzes to include
 * @returns Mock room configuration
 */
export function createDemoRoomConfig(quizCount: number = 3) {
  return {
    name: '🎯 デモルーム',
    isPublic: true,
    maxPlayers: 8,
    quizzes: getRandomQuizzes(quizCount),
  };
} 
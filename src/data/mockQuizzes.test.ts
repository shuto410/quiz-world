/**
 * Tests for mock quiz data utilities
 * - Validates quiz data structure
 * - Tests helper functions
 * - Ensures data integrity
 */

import { describe, it, expect } from 'vitest';
import { mockQuizzes, getRandomQuizzes, getQuizzesByCategory, createDemoRoomConfig } from './mockQuizzes';
import type { Quiz } from '@/types';

describe('mockQuizzes', () => {
  describe('mockQuizzes data', () => {
    it('should contain quiz data', () => {
      expect(mockQuizzes).toBeDefined();
      expect(mockQuizzes.length).toBeGreaterThan(0);
    });

    it('should contain valid quiz objects', () => {
      mockQuizzes.forEach((quiz: Quiz) => {
        expect(quiz).toHaveProperty('id');
        expect(quiz).toHaveProperty('type');
        expect(quiz).toHaveProperty('question');
        expect(quiz).toHaveProperty('answer');
        expect(typeof quiz.id).toBe('string');
        expect(['text', 'image']).toContain(quiz.type);
        expect(typeof quiz.question).toBe('string');
        expect(typeof quiz.answer).toBe('string');
        expect(quiz.question.length).toBeGreaterThan(0);
        expect(quiz.answer.length).toBeGreaterThan(0);
      });
    });

    it('should have image quizzes with valid image data', () => {
      const imageQuizzes = mockQuizzes.filter(quiz => quiz.type === 'image');
      expect(imageQuizzes.length).toBeGreaterThan(0);
      
      imageQuizzes.forEach(quiz => {
        expect(quiz.image).toBeDefined();
        expect(quiz.image?.type).toBe('url');
        expect(quiz.image?.data).toBeDefined();
        expect(typeof quiz.image?.data).toBe('string');
        expect(quiz.image?.data.startsWith('http')).toBe(true);
      });
    });

    it('should have text quizzes without image data', () => {
      const textQuizzes = mockQuizzes.filter(quiz => quiz.type === 'text');
      expect(textQuizzes.length).toBeGreaterThan(0);
      
      textQuizzes.forEach(quiz => {
        expect(quiz.image).toBeUndefined();
      });
    });

    it('should have choices for all quizzes', () => {
      mockQuizzes.forEach(quiz => {
        expect(quiz.choices).toBeDefined();
        expect(Array.isArray(quiz.choices)).toBe(true);
        expect(quiz.choices!.length).toBeGreaterThan(0);
        expect(quiz.choices).toContain(quiz.answer);
      });
    });

    it('should have unique quiz IDs', () => {
      const ids = mockQuizzes.map(quiz => quiz.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getRandomQuizzes', () => {
    it('should return random quizzes', () => {
      const count = 3;
      const randomQuizzes = getRandomQuizzes(count);
      
      expect(randomQuizzes).toBeDefined();
      expect(randomQuizzes.length).toBe(count);
      
      randomQuizzes.forEach(quiz => {
        expect(mockQuizzes).toContain(quiz);
      });
    });

    it('should return default count when no count provided', () => {
      const randomQuizzes = getRandomQuizzes();
      expect(randomQuizzes.length).toBe(5);
    });

    it('should not return more quizzes than available', () => {
      const count = mockQuizzes.length + 5;
      const randomQuizzes = getRandomQuizzes(count);
      expect(randomQuizzes.length).toBe(mockQuizzes.length);
    });

    it('should return empty array when count is 0', () => {
      const randomQuizzes = getRandomQuizzes(0);
      expect(randomQuizzes.length).toBe(0);
    });

    it('should return different results on multiple calls', () => {
      const result1 = getRandomQuizzes(mockQuizzes.length);
      const result2 = getRandomQuizzes(mockQuizzes.length);
      
      // Note: This test might occasionally fail due to randomness
      // but statistically should pass most of the time
      const isDifferent = result1.some((quiz, index) => quiz.id !== result2[index].id);
      expect(isDifferent).toBe(true);
    });
  });

  describe('getQuizzesByCategory', () => {
    it('should return programming quizzes', () => {
      const programmingQuizzes = getQuizzesByCategory('programming');
      expect(programmingQuizzes.length).toBeGreaterThan(0);
      
      programmingQuizzes.forEach(quiz => {
        const question = quiz.question.toLowerCase();
        expect(
          question.includes('javascript') ||
          question.includes('typescript') ||
          question.includes('next.js') ||
          question.includes('http')
        ).toBe(true);
      });
    });

    it('should return geography quizzes', () => {
      const geographyQuizzes = getQuizzesByCategory('geography');
      expect(geographyQuizzes.length).toBeGreaterThan(0);
      
      geographyQuizzes.forEach(quiz => {
        const question = quiz.question;
        expect(
          question.includes('首都') ||
          question.includes('山') ||
          question.includes('建物') ||
          question.includes('地球')
        ).toBe(true);
      });
    });

    it('should return math quizzes', () => {
      const mathQuizzes = getQuizzesByCategory('math');
      expect(mathQuizzes.length).toBeGreaterThan(0);
      
      mathQuizzes.forEach(quiz => {
        const question = quiz.question;
        expect(
          question.includes('1 + 1') ||
          question.includes('ポート番号')
        ).toBe(true);
      });
    });

    it('should return all quizzes for general category', () => {
      const generalQuizzes = getQuizzesByCategory('general');
      expect(generalQuizzes.length).toBe(mockQuizzes.length);
      expect(generalQuizzes).toEqual(mockQuizzes);
    });
  });

  describe('createDemoRoomConfig', () => {
    it('should create demo room config', () => {
      const config = createDemoRoomConfig();
      
      expect(config).toBeDefined();
      expect(config.name).toBe('🎯 デモルーム');
      expect(config.isPublic).toBe(true);
      expect(config.maxPlayers).toBe(8);
      expect(config.quizzes).toBeDefined();
      expect(config.quizzes.length).toBe(3);
    });

    it('should create demo room config with custom quiz count', () => {
      const quizCount = 5;
      const config = createDemoRoomConfig(quizCount);
      
      expect(config.quizzes.length).toBe(quizCount);
    });

    it('should have valid quiz objects in config', () => {
      const config = createDemoRoomConfig();
      
      config.quizzes.forEach(quiz => {
        expect(quiz).toHaveProperty('id');
        expect(quiz).toHaveProperty('type');
        expect(quiz).toHaveProperty('question');
        expect(quiz).toHaveProperty('answer');
        expect(mockQuizzes).toContain(quiz);
      });
    });
  });
}); 
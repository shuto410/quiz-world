/**
 * Unit tests for domain models in src/types/index.ts
 */
import { test, expect } from 'vitest';
import type { User, ImageResource, Quiz, Score, Room } from './index';

test('User type usage', () => {
  const user: User = { id: 'u1', name: 'Alice', isHost: true };
  expect(user.name).toBe('Alice');
});

test('ImageResource type usage', () => {
  const img1: ImageResource = { type: 'upload', data: 'base64string' };
  const img2: ImageResource = { type: 'url', data: 'https://example.com/img.png' };
  expect(img1.type).toBe('upload');
  expect(img2.type).toBe('url');
});

test('Quiz type usage', () => {
  const quiz: Quiz = {
    id: 'q1',
    type: 'image',
    question: 'Who is this character?',
    image: { type: 'url', data: 'https://example.com/char.png' },
    answer: 'Naruto',
  };
  expect(quiz.type).toBe('image');
});

test('Score type usage', () => {
  const score: Score = { userId: 'u1', value: 10 };
  expect(score.value).toBe(10);
});

test('Room type usage', () => {
  const room: Room = {
    id: 'r1',
    name: 'Anime Quiz',
    isPublic: true,
    users: [{ id: 'u1', name: 'Alice', isHost: true }],
    quizzes: [],
    hostId: 'u1',
    maxPlayers: 8,
    createdAt: Date.now(),
  };
  expect(room.maxPlayers).toBe(8);
}); 
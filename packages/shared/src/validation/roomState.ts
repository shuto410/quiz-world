/** Validates persisted room JSON and explicitly rebuilds fields before recovery or broadcast. */
import { GAME_STATUSES, PAUSED_REASONS, type InternalRoomState } from '../types/game';

function invalid(field: string): never {
  throw new Error(`invalid room state: ${field}`);
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid('object');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : invalid('string');
}
function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalid('number');
}
function boolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid('boolean');
}
function array<T>(value: unknown, parse: (entry: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) return invalid('array');
  return value.map((entry) => parse(record(entry)));
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  return choices.find((candidate) => candidate === value) ?? invalid('enum');
}

export function parseRoomState(value: unknown): InternalRoomState {
  const item = record(value);
  const state: InternalRoomState = {
    tournamentId: text(item['tournamentId']),
    status: choice(item['status'], GAME_STATUSES),
    hostId: text(item['hostId']),
    hostOnline: boolean(item['hostOnline']),
    participants: array(item['participants'], (p) => ({
      id: text(p['id']),
      name: text(p['name']),
      online: boolean(p['online']),
      joinedAt: number(p['joinedAt']),
      score: number(p['score']),
    })),
    buzzOrder: array(item['buzzOrder'], (p) => ({
      participantId: text(p['participantId']),
      receivedAt: number(p['receivedAt']),
    })),
    updatedAt: number(item['updatedAt']),
  };
  if (item['initialHostId'] !== undefined) state.initialHostId = text(item['initialHostId']);
  if (item['statusBeforePause'] !== undefined)
    state.statusBeforePause = choice(item['statusBeforePause'], GAME_STATUSES);
  if (item['pausedReason'] !== undefined)
    state.pausedReason = choice(item['pausedReason'], PAUSED_REASONS);
  if (item['currentResponderId'] !== undefined)
    state.currentResponderId = text(item['currentResponderId']);
  if (item['currentBuzzSession'] !== undefined) {
    const p = record(item['currentBuzzSession']);
    state.currentBuzzSession = { id: text(p['id']), startedAt: number(p['startedAt']) };
  }
  if (item['currentSubmittedAnswer'] !== undefined) {
    const p = record(item['currentSubmittedAnswer']);
    state.currentSubmittedAnswer = {
      participantId: text(p['participantId']),
      answerText: text(p['answerText']),
      receivedAt: number(p['receivedAt']),
    };
  }
  if (item['lastResult'] !== undefined) {
    const p = record(item['lastResult']);
    state.lastResult = {
      participantId: text(p['participantId']),
      isCorrect: boolean(p['isCorrect']),
      scoreDelta: number(p['scoreDelta']),
    };
  }
  return state;
}

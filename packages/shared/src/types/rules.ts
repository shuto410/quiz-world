/** Shared rule definitions keep server decisions and client presentation consistent. */
import type { ParticipantState } from './game';

/** Fixed scoring or independent correct/wrong thresholds for an n-maru m-batsu match. */
export type GameRules =
  | { type: 'points'; correctPoints: number; wrongPoints: number }
  | { type: 'maruBatsu'; correctTarget: number; wrongLimit: number };

export const DEFAULT_GAME_RULES: GameRules = { type: 'points', correctPoints: 1, wrongPoints: 0 };
export const SEVEN_MARU_THREE_BATSU: GameRules = {
  type: 'maruBatsu',
  correctTarget: 7,
  wrongLimit: 3,
};

/** Derived standing; the server enforces it before accepting a buzz or judgement. */
export type ParticipantStanding = 'playing' | 'won' | 'lost';
export function getParticipantStanding(
  participant: ParticipantState,
  rules: GameRules,
): ParticipantStanding {
  if (rules.type === 'points') return 'playing';
  if (participant.wrongCount >= rules.wrongLimit) return 'lost';
  if (participant.correctCount >= rules.correctTarget) return 'won';
  return 'playing';
}

/** A score change is resolved from persisted rules, never supplied by the judging client. */
export function getJudgeScoreDelta(rules: GameRules, isCorrect: boolean): number {
  return rules.type === 'points'
    ? isCorrect
      ? rules.correctPoints
      : rules.wrongPoints
    : isCorrect
      ? 1
      : 0;
}

/** Existing points also lock legacy rooms whose historical counts are unavailable. */
export function hasJudgements(participants: readonly ParticipantState[]): boolean {
  return participants.some((p) => p.score !== 0 || p.correctCount !== 0 || p.wrongCount !== 0);
}

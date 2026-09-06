/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the judgement readout shown on the result screen.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LastResult } from './LastResult';

afterEach(() => {
  cleanup();
});

const participants = [
  { id: 'p1', name: 'ホスト', online: true, joinedAt: 1, score: 0 },
  { id: 'p2', name: '太郎', online: true, joinedAt: 2, score: 2 },
];

describe('LastResult', () => {
  it('shows who was judged, the verdict and the points', () => {
    render(
      <LastResult
        participants={participants}
        result={{ participantId: 'p2', isCorrect: true, scoreDelta: 2 }}
      />,
    );

    expect(screen.getByText('太郎')).toBeTruthy();
    expect(screen.getByText('正解')).toBeTruthy();
    expect(screen.getByText('+2点')).toBeTruthy();
  });

  it('marks a wrong answer and its deduction', () => {
    render(
      <LastResult
        participants={participants}
        result={{ participantId: 'p2', isCorrect: false, scoreDelta: -1 }}
      />,
    );

    expect(screen.getByText('不正解')).toBeTruthy();
    expect(screen.getByText('-1点')).toBeTruthy();
  });

  it('falls back when the judged participant is no longer in the roster', () => {
    render(
      <LastResult
        participants={participants}
        result={{ participantId: 'gone', isCorrect: true, scoreDelta: 0 }}
      />,
    );

    expect(screen.getByText('不明な参加者')).toBeTruthy();
    expect(screen.getByText('±0点')).toBeTruthy();
  });

  it('renders nothing before any judgement', () => {
    const { container } = render(<LastResult participants={participants} result={undefined} />);

    expect(container.textContent).toBe('');
  });
});

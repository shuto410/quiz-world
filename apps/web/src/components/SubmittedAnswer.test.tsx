/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the submitted-answer panel.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SubmittedAnswer } from './SubmittedAnswer';

afterEach(() => {
  cleanup();
});

describe('SubmittedAnswer', () => {
  const participants = [
    { id: 'p1', name: 'ホスト', online: true, joinedAt: 1, score: 0 },
    { id: 'p2', name: '太郎', online: true, joinedAt: 2, score: 0 },
  ];

  it('shows the answer and who sent it', () => {
    render(
      <SubmittedAnswer
        participants={participants}
        answer={{ participantId: 'p2', answerText: '東京', receivedAt: 10 }}
      />,
    );

    expect(screen.getByText('東京')).toBeTruthy();
    expect(screen.getByText('太郎 の回答')).toBeTruthy();
  });

  it('falls back when the sender is no longer in the roster', () => {
    render(
      <SubmittedAnswer
        participants={participants}
        answer={{ participantId: 'gone', answerText: '東京', receivedAt: 10 }}
      />,
    );

    expect(screen.getByText('不明な参加者 の回答')).toBeTruthy();
  });

  it('says so when nothing has been submitted', () => {
    render(<SubmittedAnswer participants={participants} />);

    expect(screen.getByText('まだ回答は送信されていません')).toBeTruthy();
  });
});

/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the buzz-order roster.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BuzzOrderList } from './BuzzOrderList';

afterEach(() => {
  cleanup();
});

describe('BuzzOrderList', () => {
  const participants = [
    { id: 'p1', name: 'ホスト', online: true, joinedAt: 1, score: 0 },
    { id: 'p2', name: '太郎', online: true, joinedAt: 2, score: 0 },
    { id: 'p3', name: '花子', online: true, joinedAt: 3, score: 0 },
  ];

  it('renders ranks and marks the current responder', () => {
    render(
      <BuzzOrderList
        participants={participants}
        currentResponderId="p2"
        buzzOrder={[
          { participantId: 'p2', receivedAt: 10 },
          { participantId: 'p3', receivedAt: 20 },
        ]}
      />,
    );

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('太郎')).toBeTruthy();
    expect(screen.getByText('花子')).toBeTruthy();
    expect(screen.getByText('回答権')).toBeTruthy();
  });

  it('shows an empty message when nobody has buzzed', () => {
    render(<BuzzOrderList participants={participants} buzzOrder={[]} />);
    expect(screen.getByText('まだ早押しはありません')).toBeTruthy();
  });
});

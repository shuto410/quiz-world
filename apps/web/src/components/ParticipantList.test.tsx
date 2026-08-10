/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the shared participant roster.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ParticipantList } from './ParticipantList';

afterEach(() => {
  cleanup();
});

describe('ParticipantList', () => {
  it('renders names, online state and score', () => {
    render(
      <ParticipantList
        hostId="p1"
        selfParticipantId="p2"
        participants={[
          { id: 'p1', name: '出題者A', online: true, joinedAt: 1, score: 0 },
          { id: 'p2', name: '花子', online: false, joinedAt: 2, score: 3 },
        ]}
      />,
    );

    expect(screen.getByText('出題者A')).toBeTruthy();
    expect(screen.getByText('花子')).toBeTruthy();
    expect(screen.getByText('オフライン')).toBeTruthy();
    expect(screen.getByText('3点')).toBeTruthy();
    expect(screen.getByText('あなた')).toBeTruthy();
    expect(screen.getByText('ホスト')).toBeTruthy();
  });

  it('shows an empty message when nobody has joined', () => {
    render(<ParticipantList participants={[]} />);
    expect(screen.getByText('まだ参加者はいません')).toBeTruthy();
  });
});

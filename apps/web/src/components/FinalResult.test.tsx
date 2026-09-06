/**
 * @vitest-environment jsdom
 *
 * Tests for the closing screen.
 *
 * The ordering rules have their own tests; what is checked here is that a joint first place
 * reaches the screen as several names rather than one, since that is the outcome the design
 * calls out and the easiest to render away.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FinalResult } from './FinalResult';

afterEach(() => {
  cleanup();
});

const host = { id: 'p1', name: 'ホスト', online: true, joinedAt: 1, score: 0 };

describe('FinalResult', () => {
  it('names the winner and lists everyone with their score', () => {
    render(
      <FinalResult
        hostId="p1"
        participants={[
          host,
          { id: 'p2', name: '太郎', online: true, joinedAt: 2, score: 5 },
          { id: 'p3', name: '花子', online: false, joinedAt: 3, score: 2 },
        ]}
      />,
    );

    // The winner is named twice: once as the headline, once in the table.
    expect(screen.getAllByText('太郎')).toHaveLength(2);
    expect(screen.getByText('花子')).toBeTruthy();
    expect(screen.getByText('1位')).toBeTruthy();
    expect(screen.getByText('2位')).toBeTruthy();
    expect(screen.getByText('5点')).toBeTruthy();
    expect(screen.getByText('2点')).toBeTruthy();
    // The host is not a player and must not appear in the table.
    expect(screen.queryByText('ホスト')).toBeNull();
  });

  it('shows every tied leader as a winner', () => {
    render(
      <FinalResult
        hostId="p1"
        participants={[
          host,
          { id: 'p2', name: '太郎', online: true, joinedAt: 2, score: 3 },
          { id: 'p3', name: '花子', online: true, joinedAt: 3, score: 3 },
        ]}
      />,
    );

    expect(screen.getByText('太郎、花子')).toBeTruthy();
    expect(screen.getByText('2名が同点1位')).toBeTruthy();
  });

  it('says so when nobody but the host was in the room', () => {
    render(<FinalResult hostId="p1" participants={[host]} />);

    expect(screen.getByText('参加者がいないまま終了しました')).toBeTruthy();
  });
});

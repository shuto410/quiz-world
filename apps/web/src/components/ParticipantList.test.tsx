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
  it('keeps a seat color through score reordering, renaming, reconnect and remount', () => {
    const first = {
      correctCount: 0,
      wrongCount: 0,
      id: 'a',
      name: 'あおい',
      online: true,
      joinedAt: 1,
      score: 10,
    };
    const second = {
      correctCount: 0,
      wrongCount: 0,
      id: 'b',
      name: 'はる',
      online: true,
      joinedAt: 2,
      score: 3,
    };
    const tokenFor = (name: string) => {
      const token = screen.getByText(name).closest('li')?.querySelector('.qw-participant-token');
      if (!token) throw new Error(`Missing token for ${name}`);
      return token;
    };
    const view = render(<ParticipantList participants={[first, second]} currentResponderId="a" />);
    const token = tokenFor('あおい');
    const tone = token.getAttribute('data-tone');
    expect(tone).toBeTruthy();
    expect(tokenFor('はる').getAttribute('data-tone')).not.toBe(tone);
    const renamed = { ...first, name: 'あお', online: false, score: -1 };
    view.rerender(<ParticipantList participants={[second, renamed]} currentResponderId="a" />);
    expect(screen.getAllByRole('listitem')[1]?.textContent).toContain('あお');
    expect(tokenFor('あお')).toBe(token);
    expect(tokenFor('あお').getAttribute('data-tone')).toBe(tone);
    expect(tokenFor('あお').getAttribute('data-active')).toBe('true');
    view.rerender(<ParticipantList participants={[second, renamed]} currentResponderId="b" />);
    expect(tokenFor('あお').getAttribute('data-active')).toBe('false');
    expect(tokenFor('はる').getAttribute('data-active')).toBe('true');
    view.unmount();
    render(<ParticipantList participants={[{ ...renamed, online: true }, second]} />);
    expect(tokenFor('あお').getAttribute('data-tone')).toBe(tone);
    expect(tokenFor('あお').getAttribute('data-active')).toBe('false');
  });
  it('marks the current responder independently of the viewer and score leader', () => {
    render(
      <ParticipantList
        selfParticipantId="a"
        currentResponderId="b"
        participants={[
          {
            correctCount: 0,
            wrongCount: 0,
            id: 'a',
            name: 'あおい',
            online: true,
            joinedAt: 1,
            score: 10,
          },
          {
            correctCount: 0,
            wrongCount: 0,
            id: 'b',
            name: 'はる',
            online: true,
            joinedAt: 2,
            score: 3,
          },
        ]}
      />,
    );
    expect(screen.getByText('回答中').closest('li')?.textContent).toContain('はる');
    expect(screen.getByText('あなた').closest('li')?.textContent).toContain('あおい');
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('あおい');
  });
  it('renders names, online state and score', () => {
    render(
      <ParticipantList
        hostId="p1"
        selfParticipantId="p2"
        participants={[
          {
            correctCount: 0,
            wrongCount: 0,
            id: 'p1',
            name: '出題者A',
            online: true,
            joinedAt: 1,
            score: 0,
          },
          {
            correctCount: 0,
            wrongCount: 0,
            id: 'p2',
            name: '花子',
            online: false,
            joinedAt: 2,
            score: 3,
          },
        ]}
      />,
    );

    expect(screen.getByText('出題者A')).toBeTruthy();
    expect(screen.getByText('花子')).toBeTruthy();
    expect(screen.getByText('オフライン')).toBeTruthy();
    expect(screen.getByLabelText('3点')).toBeTruthy();
    expect(screen.getByText('あなた')).toBeTruthy();
    expect(screen.getByText('進行役')).toBeTruthy();
    expect(screen.queryByText('0点')).toBeNull();
  });

  it('shows an empty message when nobody has joined', () => {
    render(<ParticipantList participants={[]} />);
    expect(screen.getByText('まだ参加者はいません')).toBeTruthy();
  });
});

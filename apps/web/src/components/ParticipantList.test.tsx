/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the shared participant roster.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SEVEN_MARU_THREE_BATSU, type ParticipantState } from '@quiz-world/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  describe('host corrections', () => {
    const seat: ParticipantState = {
      id: 'a',
      name: 'あおい',
      online: true,
      joinedAt: 1,
      score: 4,
      correctCount: 4,
      wrongCount: 2,
    };
    const open = () =>
      fireEvent.click(screen.getByRole('button', { name: 'あおいさんの得点を修正' }));

    it('offers no edit control unless the parent allows corrections', () => {
      render(<ParticipantList participants={[seat]} />);
      expect(screen.queryByRole('button', { name: 'あおいさんの得点を修正' })).toBeNull();
    });

    it('sends the new score for the named seat under points, then closes', () => {
      const onAdjust = vi.fn();
      render(<ParticipantList participants={[seat]} onAdjust={onAdjust} />);
      open();
      expect(screen.getByLabelText<HTMLInputElement>('得点').value).toBe('4');
      fireEvent.change(screen.getByLabelText('得点'), { target: { value: '-2' } });
      fireEvent.click(screen.getByRole('button', { name: '保存' }));
      expect(onAdjust).toHaveBeenCalledExactlyOnceWith({
        participantId: 'a',
        adjustment: { type: 'points', score: -2 },
      });
      expect(screen.queryByLabelText('得点')).toBeNull();
    });

    it('edits the counts under n○m× and explains a value it will not send', () => {
      const onAdjust = vi.fn();
      render(
        <ParticipantList
          participants={[seat]}
          rules={SEVEN_MARU_THREE_BATSU}
          onAdjust={onAdjust}
        />,
      );
      open();
      expect(screen.queryByLabelText('得点')).toBeNull();
      fireEvent.change(screen.getByLabelText('×の数'), { target: { value: '' } });
      // Submitted directly: the browser's own field validation is not the last line of defence.
      fireEvent.submit(screen.getByRole('form', { name: 'あおいさんの得点を修正' }));
      expect(screen.getByRole('alert').textContent).toContain('○数・×数は0〜99の整数');
      expect(onAdjust).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText('×の数'), { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: '保存' }));
      expect(onAdjust).toHaveBeenCalledExactlyOnceWith({
        participantId: 'a',
        adjustment: { type: 'maruBatsu', correctCount: 4, wrongCount: 1 },
      });
    });

    it('abandons a draft on cancel and when corrections stop being allowed', () => {
      const onAdjust = vi.fn();
      const view = render(<ParticipantList participants={[seat]} onAdjust={onAdjust} />);
      open();
      fireEvent.click(screen.getByRole('button', { name: 'やめる' }));
      expect(screen.queryByLabelText('得点')).toBeNull();
      open();
      view.rerender(<ParticipantList participants={[seat]} />);
      expect(screen.queryByLabelText('得点')).toBeNull();
      expect(onAdjust).not.toHaveBeenCalled();
    });

    it('cannot be used while the connection is down', () => {
      render(<ParticipantList participants={[seat]} onAdjust={vi.fn()} adjustDisabled />);
      expect(
        screen.getByRole('button', { name: 'あおいさんの得点を修正' }).matches(':disabled'),
      ).toBe(true);
    });
  });

  it('shows an empty message when nobody has joined', () => {
    render(<ParticipantList participants={[]} />);
    expect(screen.getByText('まだ参加者はいません')).toBeTruthy();
  });
});

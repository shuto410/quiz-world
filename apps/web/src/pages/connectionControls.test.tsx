/** @vitest-environment jsdom
 * Confirms retained room views never leave actionable controls enabled during resynchronization.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { useRoomSocket, type UseRoomSocketResult } from '../hooks/useRoomSocket';
import { saveHostToken, saveInviteDetails, saveParticipantName } from '../storage/sessionKeys';
import { HostPage } from './HostPage';
import { PlayPage } from './PlayPage';
vi.mock('../hooks/useRoomSocket');
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function setup(
  role: 'host' | 'participant',
  roomStatus: 'idle' | 'answering' | 'result' | 'matchResult' | 'finished' | 'paused',
) {
  saveHostToken('t1', 'test-token');
  const connection: UseRoomSocketResult = {
    status: 'joined',
    participantId: role === 'host' ? 'h' : 'p',
    roomState: {
      rules: { type: 'points', correctPoints: 1, wrongPoints: 0 },
      tournamentId: 't1',
      status: roomStatus,
      hostId: 'h',
      hostOnline: true,
      updatedAt: 1,
      participants: [
        {
          correctCount: 0,
          wrongCount: 0,
          id: 'h',
          name: 'ホスト',
          score: 0,
          online: true,
          joinedAt: 1,
        },
        {
          correctCount: 0,
          wrongCount: 0,
          id: 'p',
          name: '太郎',
          score: 5,
          online: true,
          joinedAt: 1,
        },
      ],
      buzzOrder: [],
      currentResponderId: 'p',
      currentBuzzSession: { id: 'round', startedAt: 1 },
    },
    errorMessage: undefined,
    socketError: undefined,
    roomClosed: false,
    claimHost: vi.fn(),
    rename: vi.fn().mockResolvedValue(true),
    renaming: false,
    clearSocketError: vi.fn(),
    leave: vi.fn(),
    buzz: vi.fn(),
    submitAnswer: vi.fn(),
    judge: vi.fn(),
    resetGame: vi.fn(),
    nextResponder: vi.fn(),
    updateRules: vi.fn(),
    judgeEffect: undefined,
    playEffect: vi.fn(),
    adjustScore: vi.fn(),
    finishMatch: vi.fn(),
    nextMatch: vi.fn(),
    finishTournament: vi.fn(),
    closeRoom: vi.fn(),
  };
  vi.mocked(useRoomSocket).mockImplementation(() => connection);
  const view = () => (
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: '/room/t1', state: { displayName: '太郎' } }]}>
        <Routes>
          <Route
            path="/room/:tournamentId"
            element={role === 'host' ? <HostPage /> : <PlayPage />}
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
  const rendered = render(view());
  return { connection, refresh: () => rendered.rerender(view()) };
}

it.each(['idle', 'answering', 'result', 'finished'] as const)(
  'disables host controls during reconnect in %s, including an armed confirmation',
  (status) => {
    const { connection, refresh } = setup('host', status);
    if (status === 'idle' || status === 'result')
      fireEvent.click(screen.getByRole('button', { name: '大会終了' }));
    if (status === 'finished')
      fireEvent.click(screen.getByRole('button', { name: 'ルームを閉じる' }));
    connection.status = 'connecting';
    refresh();
    expect(screen.getByText('接続が切れました。再接続しています…')).toBeTruthy();
    for (const button of screen.getAllByRole('button'))
      expect(button.matches(':disabled')).toBe(true);
    expect(screen.getAllByText('太郎').length).toBeGreaterThan(0);
    connection.status = 'joined';
    refresh();
    const action = status === 'answering' ? '正解' : status === 'finished' ? '閉じる' : '終了する';
    fireEvent.click(screen.getByRole('button', { name: action }));
    const callback =
      status === 'answering'
        ? connection.judge
        : status === 'finished'
          ? connection.closeRoom
          : connection.finishTournament;
    expect(callback).toHaveBeenCalledTimes(1);
  },
);

it.each(['idle', 'answering'] as const)(
  'disables participant actions without losing the score in %s',
  (status) => {
    const { connection, refresh } = setup('participant', status);
    if (status === 'answering')
      fireEvent.change(screen.getByLabelText('回答'), { target: { value: '入力途中' } });
    connection.status = 'connecting';
    refresh();
    if (status === 'answering')
      expect(screen.getByLabelText<HTMLInputElement>('回答').value).toBe('入力途中');
    expect(
      screen
        .getByRole('button', { name: status === 'answering' ? '送信' : '早押し' })
        .matches(':disabled'),
    ).toBe(true);
    expect(screen.getAllByText('太郎').length).toBeGreaterThan(0);
    connection.status = 'joined';
    refresh();
    if (status === 'idle') {
      fireEvent.click(screen.getByRole('button', { name: '早押し' }));
      expect(connection.buzz).toHaveBeenCalledOnce();
    }
    if (status === 'answering' && connection.roomState) {
      connection.roomState = {
        ...connection.roomState,
        status: 'paused',
        statusBeforePause: 'answering',
        pausedReason: 'hostDisconnected',
      };
      refresh();
      expect(screen.getByLabelText<HTMLInputElement>('回答').value).toBe('入力途中');
      expect(screen.getByRole('button', { name: '送信' }).matches(':disabled')).toBe(true);
      connection.roomState = { ...connection.roomState, status: 'answering' };
      refresh();
      expect(screen.getByLabelText<HTMLInputElement>('回答').value).toBe('入力途中');
      expect(screen.getByRole('button', { name: '送信' }).matches(':disabled')).toBe(false);
    }
  },
);

it.each(['idle', 'result', 'matchResult', 'answering', 'paused', 'finished'] as const)(
  'offers the host score corrections only while the server accepts them, tested in %s',
  (status) => {
    const { connection } = setup('host', status);
    const edit = screen.queryByRole('button', { name: '太郎さんの得点を修正' });
    const offered = status === 'idle' || status === 'result' || status === 'matchResult';
    expect(edit !== null).toBe(offered);
    if (edit === null) return;
    fireEvent.click(edit);
    fireEvent.change(screen.getByLabelText('得点'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(connection.adjustScore).toHaveBeenCalledExactlyOnceWith({
      participantId: 'p',
      adjustment: { type: 'points', score: 7 },
    });
  },
);

it.each(['idle', 'result', 'matchResult'] as const)(
  'keeps the verdict buttons up as a cue that scores nobody, tested in %s',
  (status) => {
    const { connection } = setup('host', status);
    if (status === 'matchResult') fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    fireEvent.click(screen.getByRole('button', { name: '不正解' }));
    expect(connection.playEffect).toHaveBeenCalledExactlyOnceWith(false);
    expect(connection.judge).not.toHaveBeenCalled();
  },
);

it('judges, and does not merely cue, while a responder waits', () => {
  const { connection } = setup('host', 'answering');
  fireEvent.click(screen.getByRole('button', { name: '不正解' }));
  expect(connection.judge).toHaveBeenCalledExactlyOnceWith({
    participantId: 'p',
    buzzSessionId: 'round',
    isCorrect: false,
  });
  expect(connection.playEffect).not.toHaveBeenCalled();
});

it('shows the cue to participants and lets each of them silence it', () => {
  const { connection, refresh } = setup('participant', 'idle');
  expect(screen.queryByRole('button', { name: '正解' })).toBeNull();
  connection.judgeEffect = { id: 1, isCorrect: true, receivedAt: Date.now() };
  refresh();
  expect(screen.getByText('正解！')).toBeTruthy();
  fireEvent.click(screen.getByText('参加情報'));
  const toggle = screen.getByLabelText<HTMLInputElement>('効果音を鳴らす');
  expect(toggle.checked).toBe(true);
  fireEvent.click(toggle);
  expect(localStorage.getItem('qw:soundMuted')).toBe('1');
});

it.each(['host', 'participant'] as const)(
  'shows the invitation once in the header to a %s',
  (role) => {
    saveInviteDetails('t1', {
      inviteCode: 'AB23CD45',
      inviteUrl: 'https://quiz.example/join?code=AB23CD45',
      name: '春の大会',
    });
    setup(role, 'idle');
    expect(screen.getAllByText('AB23CD45')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '招待コード AB23CD45 をコピー' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'URLをコピー' })).toBeTruthy();
    expect(screen.queryByText('ルームコード')).toBeNull();
  },
);

it('never offers score corrections to a participant', () => {
  setup('participant', 'idle');
  expect(screen.queryByRole('button', { name: /得点を修正/ })).toBeNull();
});

it('lets the host end a match and start the next one, and participants only watch', () => {
  const host = setup('host', 'idle');
  fireEvent.click(screen.getByRole('button', { name: '試合終了' }));
  fireEvent.click(screen.getByRole('button', { name: '試合を終了する' }));
  expect(host.connection.finishMatch).toHaveBeenCalledOnce();
  expect(host.connection.finishTournament).not.toHaveBeenCalled();
  if (host.connection.roomState === undefined) throw new Error('missing room');
  host.connection.roomState = { ...host.connection.roomState, status: 'matchResult' };
  host.refresh();
  const dialog = screen.getByRole('dialog', { name: '試合結果' });
  expect(dialog.textContent).toContain('太郎');
  expect(screen.queryByRole('button', { name: '試合終了' })).toBeNull();
  // The popup can be put away; the same action stays reachable from the room controls.
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  fireEvent.click(screen.getByRole('button', { name: '次の試合へ' }));
  expect(host.connection.nextMatch).toHaveBeenCalledOnce();
  cleanup();

  setup('participant', 'matchResult');
  expect(screen.getByRole('dialog', { name: '試合結果' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '次の試合へ' })).toBeNull();
  expect(screen.getByRole('button', { name: '早押し' }).matches(':disabled')).toBe(true);
});

it('retains final standings after room close and offers no active close action', () => {
  const { connection, refresh } = setup('host', 'finished');
  connection.roomClosed = true;
  connection.status = 'connecting';
  refresh();
  expect(screen.getByRole('heading', { name: '最終結果' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'ルームを閉じる' })).toBeNull();
});

it('switches a participant to host controls when the server confirms takeover', () => {
  const { connection, refresh } = setup('participant', 'paused');
  if (connection.roomState === undefined) throw new Error('missing room');
  connection.roomState = {
    ...connection.roomState,
    hostOnline: false,
    pausedReason: 'hostDisconnected',
    statusBeforePause: 'idle',
  };
  refresh();
  fireEvent.click(screen.getByRole('button', { name: 'ホストを引き継ぐ' }));
  expect(connection.claimHost).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: '大会終了' })).toBeNull();
  connection.roomState = { ...connection.roomState, status: 'idle', hostId: 'p', hostOnline: true };
  refresh();
  expect(screen.getByRole('button', { name: '大会終了' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '早押し' })).toBeNull();
});

it('renders the old host as a participant without giving them judge controls', () => {
  const { connection, refresh } = setup('host', 'idle');
  if (connection.roomState === undefined) throw new Error('missing room');
  connection.roomState = { ...connection.roomState, hostId: 'p' };
  refresh();
  expect(screen.getByRole('button', { name: '早押し' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '大会終了' })).toBeNull();
});

it('keeps the rename form disabled during reconnect and displays a connection banner', () => {
  const { connection, refresh } = setup('participant', 'answering');
  fireEvent.click(screen.getByText('参加情報'));
  fireEvent.click(screen.getByRole('button', { name: '表示名を変更' }));
  fireEvent.change(screen.getByLabelText('新しい表示名'), { target: { value: '次郎' } });
  connection.status = 'connecting';
  refresh();
  expect(screen.getByRole('alert').textContent).toContain('接続が切れました');
  expect(screen.getByLabelText('新しい表示名').matches(':disabled')).toBe(true);
  expect(screen.getByRole('button', { name: '変更する' }).matches(':disabled')).toBe(true);
  connection.status = 'joined';
  refresh();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByLabelText<HTMLInputElement>('新しい表示名').value).toBe('次郎');
});
it('shows server rejections as error toasts', () => {
  const { connection, refresh } = setup('participant', 'idle');
  connection.socketError = {
    code: 'DUPLICATE_DISPLAY_NAME',
    message: 'その表示名は既に使われています',
  };
  refresh();
  expect(screen.getByRole('alert').textContent).toBe('その表示名は既に使われています');
  expect(connection.clearSocketError).toHaveBeenCalled();
});

it('uses the saved renamed seat rather than stale navigation history on reload', () => {
  saveParticipantName('t1', '新しい名前');
  const { refresh } = setup('participant', 'idle');
  expect(vi.mocked(useRoomSocket).mock.calls[0]?.[0]).toMatchObject({ displayName: '新しい名前' });
  saveParticipantName('t1', '配信された名前');
  refresh();
  expect(vi.mocked(useRoomSocket).mock.lastCall?.[0]).toMatchObject({ displayName: '新しい名前' });
});

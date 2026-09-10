/** @vitest-environment jsdom
 * Confirms retained room views never leave actionable controls enabled during resynchronization.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { useRoomSocket, type UseRoomSocketResult } from '../hooks/useRoomSocket';
import { saveHostToken } from '../storage/sessionKeys';
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
  roomStatus: 'idle' | 'answering' | 'result' | 'finished' | 'paused',
) {
  saveHostToken('t1', 'test-token');
  const connection: UseRoomSocketResult = {
    status: 'joined',
    participantId: role === 'host' ? 'h' : 'p',
    roomState: {
      tournamentId: 't1',
      status: roomStatus,
      hostId: 'h',
      hostOnline: true,
      updatedAt: 1,
      participants: [
        { id: 'h', name: 'ホスト', score: 0, online: true, joinedAt: 1 },
        { id: 'p', name: '太郎', score: 5, online: true, joinedAt: 1 },
      ],
      buzzOrder: [],
      currentResponderId: 'p',
    },
    errorMessage: undefined,
    socketError: undefined,
    roomClosed: false,
    claimHost: vi.fn(),
    clearSocketError: vi.fn(),
    leave: vi.fn(),
    buzz: vi.fn(),
    submitAnswer: vi.fn(),
    judge: vi.fn(),
    resetGame: vi.fn(),
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
    if (status === 'answering') fireEvent.click(screen.getByRole('button', { name: '正解' }));
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
    const action =
      status === 'answering' ? '結果を表示' : status === 'finished' ? '閉じる' : '終了する';
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
    connection.status = 'connecting';
    refresh();
    expect(screen.getByRole('button', { name: '早押し' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: '送信' }).matches(':disabled')).toBe(true);
    expect(screen.getAllByText('太郎').length).toBeGreaterThan(0);
    connection.status = 'joined';
    refresh();
    if (status === 'idle') {
      fireEvent.click(screen.getByRole('button', { name: '早押し' }));
      expect(connection.buzz).toHaveBeenCalledOnce();
    }
  },
);

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

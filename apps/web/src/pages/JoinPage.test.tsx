/** @vitest-environment jsdom
 * Joining is one form and one submit, whether the code was typed or came with the URL.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resolveInviteCode } from '../api/tournaments';
import { ToastProvider } from '../components/Toast';
import { loadInviteDetails } from '../storage/sessionKeys';
import { JoinPage } from './JoinPage';

vi.mock('../api/tournaments');
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function Arrived() {
  const location = useLocation();
  return <p>{`${location.pathname} ${JSON.stringify(location.state)}`}</p>;
}
function open(path: string, canJoin = true) {
  vi.mocked(resolveInviteCode).mockResolvedValue({
    ok: true,
    value: { tournamentId: 't1', name: '春の大会', status: canJoin ? 'active' : 'closed', canJoin },
  });
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/join" element={<JoinPage />} />
          <Route path="/play/:tournamentId" element={<Arrived />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: '参加する' }));

it('joins with a typed code in a single submit and remembers the invitation', async () => {
  open('/join');
  expect(resolveInviteCode).not.toHaveBeenCalled();
  fill('招待コード', 'ab23cd45');
  fill('表示名', ' 太郎 ');
  submit();
  expect(await screen.findByText('/play/t1 {"displayName":"太郎"}')).toBeTruthy();
  expect(resolveInviteCode).toHaveBeenCalledExactlyOnceWith('AB23CD45');
  expect(loadInviteDetails('t1')).toEqual({
    inviteCode: 'AB23CD45',
    inviteUrl: `${window.location.origin}/join?code=AB23CD45`,
    name: '春の大会',
  });
});

it('names the tournament for an invite URL and does not look the code up twice', async () => {
  open('/join?code=AB23CD45');
  expect(
    await screen.findByText('「春の大会」に参加します。表示名を入力してください。'),
  ).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>('招待コード').value).toBe('AB23CD45');
  fill('表示名', '花子');
  submit();
  expect(await screen.findByText('/play/t1 {"displayName":"花子"}')).toBeTruthy();
  expect(resolveInviteCode).toHaveBeenCalledTimes(1);
});

it('explains both fields at once and asks the server nothing while either is invalid', () => {
  open('/join');
  fill('招待コード', 'short');
  submit();
  // Each message sits under its own field; the toast repeats only the first.
  for (const id of ['invite-code', 'display-name'])
    expect(document.getElementById(id)?.getAttribute('aria-invalid')).toBe('true');
  expect(screen.getAllByText('招待コードは8文字の英数字です').length).toBeGreaterThan(0);
  expect(screen.getByText('表示名を入力してください')).toBeTruthy();
  expect(resolveInviteCode).not.toHaveBeenCalled();
});

it('stays on the form when the code is unknown or the tournament has ended', async () => {
  open('/join');
  vi.mocked(resolveInviteCode).mockResolvedValueOnce({
    ok: false,
    status: 404,
    code: 'TOURNAMENT_NOT_FOUND',
    message: '大会が見つかりません',
  });
  fill('招待コード', 'AB23CD45');
  fill('表示名', '太郎');
  submit();
  await waitFor(() =>
    expect(screen.getAllByText('大会が見つかりません').length).toBeGreaterThan(0),
  );
  expect(screen.getByRole('button', { name: '参加する' }).matches(':disabled')).toBe(false);
  cleanup();

  open('/join', false);
  fill('招待コード', 'AB23CD45');
  fill('表示名', '太郎');
  submit();
  expect(await screen.findByText('この大会は終了しています')).toBeTruthy();
  expect(loadInviteDetails('t1')).toBeUndefined();
  expect(screen.queryByText(/^\/play/)).toBeNull();
});

/**
 * @vitest-environment jsdom
 *
 * Smoke test for the route table. `/join` must keep rendering because invite URLs point at
 * it; host and play screens must accept a tournament id in the path.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the home shell at /', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Quiz World' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '大会を作成' })).toBeTruthy();
  });

  it('renders the join screen for invite URLs', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tournamentId: 'tournament-1',
            name: 'テスト大会',
            status: 'active',
            canJoin: true,
          }),
      }),
    );
    window.history.pushState({}, '', '/join?code=AB23CD45');
    render(<App />);
    expect(screen.getByRole('heading', { name: '大会に参加' })).toBeTruthy();
    expect(screen.getByLabelText('招待コード')).toBeTruthy();
  });

  it('renders the bare join screen when no code is supplied', () => {
    window.history.pushState({}, '', '/join');
    render(<App />);
    expect(screen.getByText('招待コードを入力してください。')).toBeTruthy();
  });

  it('renders host and play screens keyed by tournament id', () => {
    window.history.pushState({}, '', '/host/tournament-1');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'ホスト進行' })).toBeTruthy();

    cleanup();
    window.history.pushState({}, '', '/play/tournament-1');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'プレイ' })).toBeTruthy();
    expect(screen.getByText('参加するには表示名の入力が必要です。')).toBeTruthy();
  });

  it('redirects unknown paths home', () => {
    window.history.pushState({}, '', '/no-such-page');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Quiz World' })).toBeTruthy();
  });
});

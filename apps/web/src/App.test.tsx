/**
 * @vitest-environment jsdom
 *
 * Smoke test for the route table. Step 7 only mounts placeholders; what must not regress is
 * that `/join` (the path baked into invite URLs) renders a screen rather than falling through
 * to the home redirect.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

describe('App', () => {
  it('renders the home shell at /', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Quiz World' })).toBeTruthy();
  });

  it('renders the join screen for invite URLs', () => {
    window.history.pushState({}, '', '/join?code=AB23CD45');
    render(<App />);
    expect(screen.getByRole('heading', { name: '大会に参加' })).toBeTruthy();
    expect(screen.getByText('AB23CD45')).toBeTruthy();
  });

  it('renders the bare join screen when no code is supplied', () => {
    window.history.pushState({}, '', '/join');
    render(<App />);
    expect(screen.getByText('招待コードはまだ入力されていません。')).toBeTruthy();
  });

  it('renders host and play screens keyed by tournament id', () => {
    window.history.pushState({}, '', '/host/tournament-1');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'ホスト進行' })).toBeTruthy();
    expect(screen.getByText('tournament-1')).toBeTruthy();

    cleanup();
    window.history.pushState({}, '', '/play/tournament-1');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'プレイ' })).toBeTruthy();
  });

  it('redirects unknown paths home', () => {
    window.history.pushState({}, '', '/no-such-page');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Quiz World' })).toBeTruthy();
  });
});

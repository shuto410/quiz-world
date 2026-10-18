/**
 * Shared steps for end-to-end scenarios: opening separate browsers and getting people into a
 * room through the same screens a person would use.
 *
 * Each person gets their own browser context. A seat is remembered in localStorage, so two
 * people sharing a context would be treated as one participant reconnecting; separate contexts
 * are the automated equivalent of the three windows `npm run debug:windows` opens.
 *
 * Elements are found by role and accessible name, never by CSS class or test id. A scenario
 * that passes therefore also says the screen is usable by its labels.
 */

import { expect, type Browser, type Page } from '@playwright/test';

/** A person's page together with everything the server has sent to it. */
export type Seat = {
  page: Page;
  /**
   * Socket.io frames received by this browser, in arrival order. What a screen draws is not
   * proof of what it was sent: a participant's screen hides an unjudged answer on its own, so
   * only the frames can show whether the server withheld it.
   */
  received: string[];
};

/** Opens a page in a browser context of its own, so that it holds its own seat. */
export async function openSeat(browser: Browser): Promise<Seat> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const received: string[] = [];
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/socket.io/')) {
      return;
    }
    socket.on('framereceived', ({ payload }) => {
      received.push(typeof payload === 'string' ? payload : payload.toString('utf8'));
    });
  });
  return { page, received };
}

/**
 * Creates a tournament from the landing page and returns the invite code shown in the host's
 * header, which is the only place a host would read it from.
 */
export async function createTournament(host: Page, name: string): Promise<string> {
  await host.goto('/');
  await host.getByLabel('大会名').fill(name);
  await host.getByRole('button', { name: '大会を作成' }).click();

  await expect(host).toHaveURL(/\/host\//);
  await expect(host.getByRole('heading', { name: '参加者を待っています' })).toBeVisible();

  const copyCode = host.getByRole('button', { name: /^招待コード \S+ をコピー$/ });
  const label = (await copyCode.getAttribute('aria-label')) ?? '';
  const inviteCode = /^招待コード (\S+) をコピー$/.exec(label)?.[1];
  if (inviteCode === undefined) {
    throw new Error(`could not read the invite code from "${label}"`);
  }
  return inviteCode;
}

/** Joins by typing the invite code and a display name, and waits until the buzzer is live. */
export async function joinTournament(
  participant: Page,
  inviteCode: string,
  displayName: string,
): Promise<void> {
  await participant.goto('/join');
  await participant.getByLabel('招待コード').fill(inviteCode);
  await participant.getByLabel('表示名').fill(displayName);
  await participant.getByRole('button', { name: '参加する' }).click();

  await expect(participant).toHaveURL(/\/play\//);
  await expect(buzzer(participant)).toBeEnabled();
}

/** The buzzer. Its accessible name is the visible label; "PUSH" is decoration. */
export function buzzer(participant: Page) {
  return participant.getByRole('button', { name: '早押し' });
}

/** One person's row in the score ranking, as shown on the given screen. */
export function scoreRow(page: Page, displayName: string) {
  return page
    .getByRole('complementary', { name: '参加者とスコア' })
    .getByRole('listitem')
    .filter({ hasText: displayName });
}

/** The buzz order list, as shown on the given screen. */
export function buzzOrder(page: Page) {
  return page.getByRole('region', { name: '早押し順' });
}

/** A room with a host and two participants already in it, each in a browser of their own. */
export type Room = {
  host: Page;
  taro: Page;
  hanako: Page;
  everyone: readonly Page[];
  inviteCode: string;
};

/**
 * Opens a room the way people do, through the landing and join screens, and stops once both
 * participants can buzz. Scenarios that are about something later than joining start here.
 */
export async function openRoom(browser: Browser, tournamentName: string): Promise<Room> {
  const { page: host } = await openSeat(browser);
  const { page: taro } = await openSeat(browser);
  const { page: hanako } = await openSeat(browser);

  const inviteCode = await createTournament(host, tournamentName);
  await joinTournament(taro, inviteCode, '太郎');
  await joinTournament(hanako, inviteCode, '花子');
  await expect(host.getByRole('heading', { name: '早押しを待っています' })).toBeVisible();

  return { host, taro, hanako, everyone: [host, taro, hanako], inviteCode };
}

/**
 * Presses the buzzer and waits until this person's own screen says what the press earned.
 * Waiting here is what fixes the buzz order of a scenario: the next person only presses once
 * the server has already answered this one.
 */
export async function buzz(participant: Page, outcome: 'answers' | 'queues'): Promise<void> {
  await buzzer(participant).click();
  await expect(
    participant.getByRole('heading', {
      name: outcome === 'answers' ? 'あなたの回答番です' : '早押しを受け付けました',
    }),
  ).toBeVisible();
}

/** The line that announces the latest judgement, as shown on the given screen. */
export function lastResult(page: Page, verdict: '正解' | '不正解') {
  return page.getByRole('status').filter({ hasText: verdict === '正解' ? '○ 正解' : '× 不正解' });
}

/**
 * Judges the named responder and waits for the host's screen to show the result.
 *
 * It first waits until the host is being asked to judge that person. The verdict buttons are
 * always on screen, and with nobody answering a press only plays the sound cue, so pressing
 * too early would pass silently without judging anyone.
 */
export async function judge(
  host: Page,
  responderName: string,
  verdict: '正解' | '不正解',
): Promise<void> {
  await expect(host.getByText(`${responderName} の回答を判定`)).toBeVisible();
  await host.getByRole('button', { name: verdict, exact: true }).click();
  await expect(lastResult(host, verdict)).toContainText(responderName);
}

/** Moves on to the next question and waits until the host is back to waiting for a buzz. */
export async function nextQuestion(host: Page): Promise<void> {
  await host.getByRole('button', { name: '次の問題へ' }).click();
  await expect(host.getByRole('heading', { name: '早押しを待っています' })).toBeVisible();
}

/** Hands the answer right to whoever buzzed next. */
export async function nextResponder(host: Page): Promise<void> {
  await host.getByRole('button', { name: '次の回答者へ' }).click();
}

/** A person's points in the score ranking. Only present under the points rule. */
export function points(page: Page, displayName: string, score: number) {
  return scoreRow(page, displayName).getByLabel(`${score}点`, { exact: true });
}

/** A person's ○ and × counts in the score ranking, shown under every rule. */
export function marks(page: Page, displayName: string, correct: number, wrong: number) {
  return scoreRow(page, displayName).getByLabel(`正解${correct}回、誤答${wrong}回`, {
    exact: true,
  });
}

/** The always-visible line of the rule settings: the rule in force and whether it can change. */
export function ruleSummary(page: Page) {
  return page.locator('summary').filter({ hasText: '試合ルール' });
}

/** The popup everyone gets when the host ends a match. */
export function matchResult(page: Page) {
  return page.getByRole('dialog', { name: '試合結果' });
}

/** Ends the current match from the host's screen, through its confirmation. */
export async function finishMatch(host: Page): Promise<void> {
  await host.getByRole('button', { name: '試合終了', exact: true }).click();
  await host.getByRole('button', { name: '試合を終了する' }).click();
  await expect(matchResult(host)).toBeVisible();
}

/**
 * Takes this person offline the way closing the tab does, and returns the address to come back
 * to. Unlike a reload this leaves a gap, so the other screens can be checked while they are away.
 */
export async function goAway(page: Page): Promise<string> {
  const address = page.url();
  await page.goto('about:blank');
  return address;
}

/** The notice participants get while the host is away, with the button to take over. */
export function hostAwayNotice(page: Page) {
  return page.getByRole('region', { name: 'ホストの切断' });
}

/** The final standings shown to everyone once the tournament has ended. */
export function finalResult(page: Page) {
  return page.getByRole('region', { name: '最終結果' });
}

/** The line under the ranking that names who is running the game. */
export function hostLine(page: Page) {
  return page
    .getByRole('complementary', { name: '参加者とスコア' })
    .getByText('進行役')
    .locator('..');
}

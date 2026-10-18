/**
 * Leaving and coming back: a closed tab, a reload in the middle of an answer, and a host who
 * drops out for a moment.
 *
 * A seat is remembered by the browser and re-claimed on every connection. The promise to the
 * people playing is that a flaky connection costs them nothing: the same seat, the same score,
 * the same answer right, and nobody else's game left hanging. Each step breaks one connection
 * and checks what the people who stayed can see, then what the person who came back gets.
 */

import { expect, test } from '@playwright/test';
import {
  buzz,
  buzzer,
  goAway,
  hostAwayNotice,
  judge,
  nextQuestion,
  openRoom,
  points,
  scoreRow,
} from './support/room';

test('people who drop out come back to the same seat, score and turn', async ({ browser }) => {
  const { host, taro, hanako, everyone } = await openRoom(browser, 'E2E再接続');

  await test.step('a participant earns a point before anything goes wrong', async () => {
    await buzz(taro, 'answers');
    await judge(host, '太郎', '正解');
    await nextQuestion(host);
  });

  await test.step('a participant who leaves is shown offline and keeps the score', async () => {
    const address = await goAway(taro);

    for (const page of [host, hanako]) {
      await expect(scoreRow(page, '太郎')).toContainText('オフライン');
      await expect(points(page, '太郎', 1)).toBeVisible();
    }

    await taro.goto(address);
    await expect(buzzer(taro)).toBeEnabled();
    await expect(scoreRow(taro, '太郎')).toContainText('あなた');
    for (const page of everyone) {
      // The same seat again, not a second one beside it.
      await expect(scoreRow(page, '太郎')).toHaveCount(1);
      await expect(scoreRow(page, '太郎')).toContainText('オンライン');
      await expect(points(page, '太郎', 1)).toBeVisible();
    }
  });

  await test.step('reloading while holding the answer right keeps the turn', async () => {
    await buzz(hanako, 'answers');
    await hanako.reload();

    await expect(hanako.getByRole('heading', { name: 'あなたの回答番です' })).toBeVisible();
    await hanako.getByLabel('回答', { exact: true }).fill('琵琶湖');
    await hanako.getByRole('button', { name: '送信' }).click();
    await expect(host.getByText('琵琶湖')).toBeVisible();
  });

  await test.step('the game pauses while the host is away and resumes on return', async () => {
    const address = await goAway(host);

    for (const page of [taro, hanako]) {
      await expect(hostAwayNotice(page)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'ゲームを一時停止しています' })).toBeVisible();
    }
    await expect(buzzer(taro)).toBeDisabled();
    await expect(hanako.getByLabel('回答', { exact: true })).toBeDisabled();

    await host.goto(address);
    for (const page of [taro, hanako]) {
      await expect(hostAwayNotice(page)).toHaveCount(0);
    }
    // Back where it stopped: the same responder, with the answer she had already sent.
    await expect(host.getByText('琵琶湖')).toBeVisible();
    await judge(host, '花子', '正解');
    for (const page of everyone) {
      await expect(points(page, '花子', 1)).toBeVisible();
      await expect(points(page, '太郎', 1)).toBeVisible();
    }
  });
});

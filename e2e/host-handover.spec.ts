/**
 * The host disappears for good and a participant takes over.
 *
 * Without this a lost host would end the tournament for everyone. The scenario stops the game
 * in the worst place, with one participant answering and the other queued behind them, and has
 * the queued one take over. The new host must not be left in a queue they would have to judge
 * themselves, the waiting responder must keep the turn, and the old host, if they come back, is
 * an ordinary participant: their host screen address no longer gives them the controls.
 */

import { expect, test } from '@playwright/test';
import {
  buzz,
  buzzer,
  buzzOrder,
  goAway,
  hostAwayNotice,
  hostLine,
  judge,
  nextQuestion,
  openRoom,
  points,
  scoreRow,
} from './support/room';

test('a participant takes over from a host who left and the game carries on', async ({
  browser,
}) => {
  const { host, taro, hanako } = await openRoom(browser, 'E2Eホスト引き継ぎ');
  let hostAddress = '';

  await test.step('the host leaves while a participant is answering', async () => {
    await buzz(taro, 'answers');
    await buzz(hanako, 'queues');
    hostAddress = await goAway(host);

    for (const page of [taro, hanako]) {
      await expect(hostAwayNotice(page)).toBeVisible();
      await expect(hostLine(page)).toContainText('オフライン');
    }
  });

  await test.step('the queued participant takes over and becomes the host', async () => {
    await hostAwayNotice(hanako).getByRole('button', { name: 'ホストを引き継ぐ' }).click();

    for (const page of [taro, hanako]) {
      await expect(hostAwayNotice(page)).toHaveCount(0);
      await expect(hostLine(page)).toContainText('花子');
      await expect(hostLine(page)).toContainText('オンライン');
      // She runs the game now, so she is out of the queue and out of the ranking.
      const rows = buzzOrder(page).getByRole('listitem');
      await expect(rows).toHaveCount(1);
      await expect(rows.nth(0)).toContainText('太郎');
      await expect(scoreRow(page, '花子')).toHaveCount(0);
    }
    await expect(buzzer(hanako)).toHaveCount(0);
    // The responder who was waiting still has the turn.
    await expect(taro.getByRole('heading', { name: 'あなたの回答番です' })).toBeVisible();
  });

  await test.step('the new host judges and moves the game on', async () => {
    await judge(hanako, '太郎', '正解');
    await expect(points(taro, '太郎', 1)).toBeVisible();
    await nextQuestion(hanako);
    await expect(buzzer(taro)).toBeEnabled();
  });

  await test.step('the old host comes back as an ordinary participant', async () => {
    await host.goto(hostAddress);

    await expect(buzzer(host)).toBeEnabled();
    await expect(host.getByRole('button', { name: '正解', exact: true })).toHaveCount(0);
    await expect(host.getByRole('button', { name: '大会終了' })).toHaveCount(0);
    await expect(hostLine(host)).toContainText('花子');

    await buzz(host, 'answers');
    await judge(hanako, 'ホスト', '正解');
    for (const page of [host, taro, hanako]) {
      await expect(points(page, 'ホスト', 1)).toBeVisible();
      await expect(points(page, '太郎', 1)).toBeVisible();
    }
  });
});

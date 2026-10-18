/**
 * One full question, played by a host and two participants in three separate browsers.
 *
 * This is the path every tournament takes, and the one that was previously only checked by
 * hand with `npm run debug:windows`: create, join by invite code, buzz, answer, judge, see the
 * score, move on. It asserts what each person can see on their own screen, because the rules
 * that matter here are about who is shown what and when:
 *
 * - the buzz order is the server's, and all three screens agree on it;
 * - an unjudged text answer is on the host's screen only, and is not even sent to the others;
 * - a judgement reaches everyone, with the score the server calculated.
 */

import { expect, test } from '@playwright/test';
import {
  buzzer,
  buzzOrder,
  createTournament,
  joinTournament,
  openSeat,
  scoreRow,
} from './support/room';

test('host and two participants play one question from invite to score', async ({ browser }) => {
  const { page: host } = await openSeat(browser);
  const { page: taro, received: sentToTaro } = await openSeat(browser);
  const { page: hanako, received: sentToHanako } = await openSeat(browser);

  await test.step('host creates a tournament and both participants join by code', async () => {
    const inviteCode = await createTournament(host, 'E2E早押し大会');
    await joinTournament(taro, inviteCode, '太郎');
    await joinTournament(hanako, inviteCode, '花子');

    await expect(host.getByRole('heading', { name: '早押しを待っています' })).toBeVisible();
    for (const page of [host, taro, hanako]) {
      await expect(scoreRow(page, '太郎').getByLabel('0点', { exact: true })).toBeVisible();
      await expect(scoreRow(page, '花子').getByLabel('0点', { exact: true })).toBeVisible();
    }
  });

  await test.step('the first buzz takes the answer right and the second queues', async () => {
    await buzzer(taro).click();
    await expect(taro.getByRole('heading', { name: 'あなたの回答番です' })).toBeVisible();

    await buzzer(hanako).click();
    await expect(hanako.getByRole('heading', { name: '早押しを受け付けました' })).toBeVisible();

    await expect(host.getByText('太郎 の回答を判定')).toBeVisible();
    for (const page of [host, taro, hanako]) {
      const rows = buzzOrder(page).getByRole('listitem');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText('太郎');
      await expect(rows.nth(0)).toContainText('回答権');
      await expect(rows.nth(1)).toContainText('花子');
    }
  });

  await test.step('a text answer is shown to the host only until it is judged', async () => {
    await taro.getByLabel('回答', { exact: true }).fill('富士山');
    await taro.getByRole('button', { name: '送信' }).click();

    await expect(host.getByText('富士山')).toBeVisible();
    await expect(hanako.getByText('富士山')).toHaveCount(0);
    // Not echoed to the sender either: the field is cleared and nothing repeats the text.
    await expect(taro.getByLabel('回答', { exact: true })).toHaveValue('');
    await expect(taro.getByText('富士山')).toHaveCount(0);
  });

  await test.step('the judgement and the new score reach every screen', async () => {
    await host.getByRole('button', { name: '正解', exact: true }).click();

    for (const page of [host, taro, hanako]) {
      const result = page.getByRole('status').filter({ hasText: '○ 正解' });
      await expect(result).toContainText('太郎');
      await expect(result).toContainText('+1点');
      await expect(page.getByText('富士山')).toBeVisible();
      await expect(scoreRow(page, '太郎').getByLabel('1点', { exact: true })).toBeVisible();
      await expect(scoreRow(page, '花子').getByLabel('0点', { exact: true })).toBeVisible();
    }

    // The screens above hide an unjudged answer by themselves, so they cannot show a leak.
    // The frames can: the first one to carry the text must be the one announcing the result.
    for (const received of [sentToTaro, sentToHanako]) {
      const firstWithAnswer = received.find((frame) => frame.includes('富士山'));
      expect(firstWithAnswer).toContain('"status":"result"');
    }
  });

  await test.step('the next question reopens the buzzer and keeps the score', async () => {
    await host.getByRole('button', { name: '次の問題へ' }).click();

    await expect(buzzer(taro)).toBeEnabled();
    await expect(buzzer(hanako)).toBeEnabled();
    await expect(host.getByRole('heading', { name: '早押しを待っています' })).toBeVisible();
    for (const page of [host, taro, hanako]) {
      await expect(buzzOrder(page).getByRole('listitem')).toHaveCount(0);
      await expect(scoreRow(page, '太郎').getByLabel('1点', { exact: true })).toBeVisible();
    }
  });
});

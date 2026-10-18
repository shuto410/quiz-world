/**
 * Ending a match and starting the next one in the same room.
 *
 * Before matches existed the only way to play a second game was a new tournament that everyone
 * had to join again. This scenario is that second game: the result popup reaches all three
 * screens, closing it is each person's own business, and the next match starts from zero for
 * everybody with the rules open for change again, without anyone leaving the room.
 */

import { expect, test } from '@playwright/test';
import {
  buzz,
  buzzer,
  buzzOrder,
  finishMatch,
  judge,
  marks,
  matchResult,
  openRoom,
  points,
  ruleSummary,
} from './support/room';

test('a finished match shows its result and the next match starts from zero', async ({
  browser,
}) => {
  const { host, taro, hanako, everyone } = await openRoom(browser, 'E2E試合の区切り');

  await test.step('a judgement puts a score on the board and fixes the rules', async () => {
    await expect(ruleSummary(host)).toContainText('設定');

    await buzz(taro, 'answers');
    await judge(host, '太郎', '正解');

    for (const page of everyone) {
      await expect(points(page, '太郎', 1)).toBeVisible();
    }
    await expect(ruleSummary(host)).toContainText('確認');
  });

  await test.step('ending the match shows the same result to everyone', async () => {
    await finishMatch(host);

    for (const page of everyone) {
      const result = matchResult(page);
      await expect(result).toBeVisible();
      await expect(result).toContainText('優勝');
      const rows = result.getByRole('listitem');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText('1位');
      await expect(rows.nth(0)).toContainText('太郎');
      await expect(rows.nth(0)).toContainText('1点');
      await expect(rows.nth(1)).toContainText('2位');
      await expect(rows.nth(1)).toContainText('花子');
      await expect(rows.nth(1)).toContainText('0点');
    }
    // Only the host can start the next match.
    await expect(matchResult(taro).getByRole('button', { name: '次の試合へ' })).toHaveCount(0);
    await expect(matchResult(hanako).getByRole('button', { name: '次の試合へ' })).toHaveCount(0);
  });

  await test.step('closing the popup only affects the person who closed it', async () => {
    await matchResult(hanako).getByRole('button', { name: '閉じる' }).click();

    await expect(matchResult(hanako)).toHaveCount(0);
    await expect(matchResult(taro)).toBeVisible();
    await expect(matchResult(host)).toBeVisible();
    // The match is still over for her: closing the popup does not reopen the buzzer.
    await expect(hanako.getByRole('heading', { name: '試合が終了しました' })).toBeVisible();
    await expect(buzzer(hanako)).toBeDisabled();
  });

  await test.step('the next match starts from zero with the rules open again', async () => {
    await matchResult(host).getByRole('button', { name: '次の試合へ' }).click();

    for (const page of everyone) {
      await expect(matchResult(page)).toHaveCount(0);
      await expect(points(page, '太郎', 0)).toBeVisible();
      await expect(points(page, '花子', 0)).toBeVisible();
      await expect(marks(page, '太郎', 0, 0)).toBeVisible();
      await expect(buzzOrder(page).getByRole('listitem')).toHaveCount(0);
    }
    await expect(host.getByRole('heading', { name: '早押しを待っています' })).toBeVisible();
    await expect(ruleSummary(host)).toContainText('設定');
  });

  await test.step('the new match scores on its own', async () => {
    await buzz(hanako, 'answers');
    await judge(host, '花子', '正解');

    for (const page of everyone) {
      await expect(points(page, '花子', 1)).toBeVisible();
      await expect(points(page, '太郎', 0)).toBeVisible();
    }
  });
});

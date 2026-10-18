/**
 * Ending the tournament: final standings, a closed door, and closing the room.
 *
 * Ending is the one step that cannot be taken back, and what follows it has three audiences.
 * The people in the room get the final standings and can still come back to read them. Someone
 * holding the invite code is told the tournament is over instead of being let in to a dead
 * room. And when the host closes the room, the others are told so rather than left watching a
 * screen that silently stopped updating.
 */

import { expect, test } from '@playwright/test';
import { buzz, buzzer, finalResult, judge, openRoom, openSeat } from './support/room';

test('ending the tournament shows final standings and stops new joins', async ({ browser }) => {
  const { host, taro, hanako, everyone, inviteCode } = await openRoom(browser, 'E2E大会終了');

  await test.step('a point is scored so the standings have a winner', async () => {
    await buzz(taro, 'answers');
    await judge(host, '太郎', '正解');
  });

  await test.step('ending the tournament shows the final standings to everyone', async () => {
    await host.getByRole('button', { name: '大会終了', exact: true }).click();
    await host.getByRole('button', { name: '終了する', exact: true }).click();

    for (const page of everyone) {
      const result = finalResult(page);
      await expect(result).toBeVisible();
      await expect(result).toContainText('優勝');
      const rows = result.getByRole('listitem');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText('1位');
      await expect(rows.nth(0)).toContainText('太郎');
      await expect(rows.nth(0)).toContainText('1点');
      await expect(rows.nth(1)).toContainText('花子');
      await expect(rows.nth(1)).toContainText('0点');
      await expect(buzzer(page)).toHaveCount(0);
    }
    // Nothing is left that could change the result.
    await expect(host.getByRole('button', { name: '正解', exact: true })).toHaveCount(0);
    await expect(host.getByRole('button', { name: '試合終了', exact: true })).toHaveCount(0);
  });

  await test.step('the invite code no longer lets anyone new in', async () => {
    const { page: latecomer } = await openSeat(browser);
    await latecomer.goto(`/join?code=${inviteCode}`);

    await expect(latecomer.getByText('（この大会は終了しています）')).toBeVisible();
    await expect(latecomer.getByRole('button', { name: '参加する' })).toBeDisabled();
  });

  await test.step('someone already in the room can come back to read the result', async () => {
    await hanako.reload();

    await expect(finalResult(hanako)).toBeVisible();
    await expect(finalResult(hanako).getByRole('listitem').nth(0)).toContainText('太郎');
  });

  await test.step('closing the room tells everyone it is closed', async () => {
    await host.getByRole('button', { name: 'ルームを閉じる' }).click();
    await host.getByRole('button', { name: '閉じる', exact: true }).click();

    await expect(host.getByText('ルームを閉じました。')).toBeVisible();
    for (const page of [taro, hanako]) {
      await expect(page.getByText('ルームを閉じました')).toBeVisible();
      // The standings stay on screen; only the connection is gone.
      await expect(finalResult(page)).toBeVisible();
    }
  });
});

/**
 * One seat opened in two tabs: the newer tab wins and the older one is switched off.
 *
 * Two live connections for one seat would let a person buzz twice, or leave a forgotten tab
 * fighting the one in use. The rule is that the newest connection is the seat. The older tab
 * says why it stopped and, importantly, stays stopped: if it reconnected by itself the two
 * tabs would take the seat from each other forever. The same must hold for the host's seat
 * without the room pausing as though the host had left.
 */

import { expect, test, type Page } from '@playwright/test';
import { buzz, buzzer, hostAwayNotice, judge, openRoom, points, scoreRow } from './support/room';

const INVALIDATED = '別のタブで接続したため、この接続は無効になりました';

/** Opens the same address in a second tab of the same browser, which shares the stored seat. */
async function openSecondTab(first: Page): Promise<Page> {
  const second = await first.context().newPage();
  await second.goto(first.url());
  return second;
}

test('opening a seat in a second tab switches the first tab off', async ({ browser }) => {
  const { host, taro, hanako } = await openRoom(browser, 'E2E多重接続');

  const taroSecond = await test.step('a participant opens a second tab', async () => {
    const second = await openSecondTab(taro);

    await expect(buzzer(second)).toBeEnabled();
    await expect(taro.getByText(INVALIDATED).first()).toBeVisible();
    await expect(buzzer(taro)).toHaveCount(0);
    for (const page of [host, hanako, second]) {
      await expect(scoreRow(page, '太郎')).toHaveCount(1);
      await expect(scoreRow(page, '太郎')).toContainText('オンライン');
    }
    return second;
  });

  await test.step('the first tab stays off and the second one plays', async () => {
    // Longer than the client's reconnection delay: a tab that was going to take the seat back
    // by reconnecting would have done so by now.
    await taro.waitForTimeout(2_000);

    await expect(taro.getByText(INVALIDATED).first()).toBeVisible();
    await buzz(taroSecond, 'answers');
    await judge(host, '太郎', '正解');
    for (const page of [host, hanako, taroSecond]) {
      await expect(points(page, '太郎', 1)).toBeVisible();
    }
  });

  await test.step('a second host tab takes over without pausing the room', async () => {
    const hostSecond = await openSecondTab(host);

    await expect(hostSecond.getByRole('button', { name: '次の問題へ' })).toBeEnabled();
    await expect(host.getByText(INVALIDATED).first()).toBeVisible();
    await expect(host.getByRole('button', { name: '次の問題へ' })).toHaveCount(0);

    await hostSecond.getByRole('button', { name: '次の問題へ' }).click();
    for (const page of [taroSecond, hanako]) {
      await expect(hostAwayNotice(page)).toHaveCount(0);
      await expect(buzzer(page)).toBeEnabled();
    }
    await buzz(hanako, 'answers');
    await judge(hostSecond, '花子', '正解');
    await expect(points(hanako, '花子', 1)).toBeVisible();
  });
});

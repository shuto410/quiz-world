/**
 * A wrong answer hands the answer right to the next person in the buzz order.
 *
 * The host does this in two presses: the verdict, then "next responder". Judging and moving on
 * are separate on purpose, so what is checked is what each screen shows in between and that
 * the right passes to exactly the person who buzzed second, with the score going to them and
 * not to the one who was wrong. When nobody else buzzed there is no one to pass to, and the
 * host is not offered a button that the server would refuse.
 */

import { expect, test } from '@playwright/test';
import {
  buzz,
  buzzer,
  buzzOrder,
  judge,
  lastResult,
  marks,
  nextQuestion,
  nextResponder,
  openRoom,
  points,
} from './support/room';

test('a wrong answer passes the answer right to the next person who buzzed', async ({
  browser,
}) => {
  const { host, taro, hanako, everyone } = await openRoom(browser, 'E2E回答権の移動');

  await test.step('the first responder is judged wrong and everyone sees it', async () => {
    await buzz(taro, 'answers');
    await buzz(hanako, 'queues');
    await judge(host, '太郎', '不正解');

    for (const page of everyone) {
      await expect(lastResult(page, '不正解')).toContainText('太郎');
      await expect(marks(page, '太郎', 0, 1)).toBeVisible();
      await expect(points(page, '太郎', 0)).toBeVisible();
    }
    // The answer right has not moved yet: that is the host's next decision.
    await expect(hanako.getByRole('heading', { name: 'あなたの回答番です' })).toHaveCount(0);
  });

  await test.step('the host passes the right to the second buzzer', async () => {
    await nextResponder(host);

    await expect(hanako.getByRole('heading', { name: 'あなたの回答番です' })).toBeVisible();
    await expect(hanako.getByLabel('回答', { exact: true })).toBeEnabled();
    await expect(taro.getByRole('heading', { name: 'この問題の回答は終了しました' })).toBeVisible();
    for (const page of everyone) {
      const rows = buzzOrder(page).getByRole('listitem');
      await expect(rows.nth(0)).toContainText('太郎');
      await expect(rows.nth(0)).not.toContainText('回答権');
      await expect(rows.nth(1)).toContainText('花子');
      await expect(rows.nth(1)).toContainText('回答権');
    }
  });

  await test.step('the score goes to the second responder only', async () => {
    await judge(host, '花子', '正解');

    for (const page of everyone) {
      await expect(lastResult(page, '正解')).toContainText('花子');
      await expect(points(page, '花子', 1)).toBeVisible();
      await expect(points(page, '太郎', 0)).toBeVisible();
      await expect(marks(page, '花子', 1, 0)).toBeVisible();
      await expect(marks(page, '太郎', 0, 1)).toBeVisible();
    }
    // A correct answer ends the question; there is nobody left to pass it to.
    await expect(host.getByRole('button', { name: '次の回答者へ' })).toHaveCount(0);
  });

  await test.step('with no one else in the queue the right cannot be passed', async () => {
    await nextQuestion(host);
    await buzz(taro, 'answers');
    await judge(host, '太郎', '不正解');

    await expect(host.getByRole('button', { name: '次の回答者へ' })).toBeDisabled();
    // Someone who has not buzzed cannot join a question that has already been judged.
    await expect(buzzer(hanako)).toHaveCount(0);

    await nextQuestion(host);
    await expect(buzzer(taro)).toBeEnabled();
    await expect(buzzer(hanako)).toBeEnabled();
    for (const page of everyone) {
      await expect(marks(page, '太郎', 0, 2)).toBeVisible();
      await expect(points(page, '花子', 1)).toBeVisible();
    }
  });
});

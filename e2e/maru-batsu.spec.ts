/**
 * A whole match under the 7○3× preset: one participant is eliminated, the other wins through.
 *
 * The thresholds themselves are unit tested. What only a browser can show is the rest of the
 * path: that the host's preset reaches every screen, that the person who is out loses their
 * buzzer while the match carries on around them, and that the result names who won through
 * rather than who has the most points.
 *
 * It is played with the real preset rather than a shortened one, so it takes seven questions.
 * Hanako buzzes first and is wrong three times while Taro picks up each of those questions,
 * then Taro answers four more alone.
 */

import { expect, test } from '@playwright/test';
import {
  buzz,
  buzzer,
  finishMatch,
  judge,
  marks,
  matchResult,
  nextQuestion,
  nextResponder,
  openRoom,
  ruleSummary,
  scoreRow,
} from './support/room';

test('under 7○3× three wrong answers eliminate and seven correct answers win', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { host, taro, hanako, everyone } = await openRoom(browser, 'E2E7○3×');

  await test.step('the host applies the preset and everyone sees the rule', async () => {
    await ruleSummary(host).click();
    await host.getByRole('button', { name: '7○3×' }).click();
    await host.getByRole('button', { name: 'ルールを適用' }).click();

    for (const page of everyone) {
      await expect(ruleSummary(page)).toContainText('7○3× · 7正解で勝ち抜け / 3誤答で失格');
    }
    await ruleSummary(host).click();
  });

  await test.step('two wrong answers leave a participant in the match', async () => {
    for (const wrongSoFar of [1, 2]) {
      await buzz(hanako, 'answers');
      await buzz(taro, 'queues');
      await judge(host, '花子', '不正解');
      await nextResponder(host);
      await judge(host, '太郎', '正解');
      await nextQuestion(host);

      for (const page of everyone) {
        await expect(marks(page, '花子', 0, wrongSoFar)).toBeVisible();
        await expect(marks(page, '太郎', wrongSoFar, 0)).toBeVisible();
      }
      await expect(buzzer(hanako)).toBeEnabled();
    }
  });

  await test.step('the third wrong answer eliminates her and the match goes on', async () => {
    await buzz(hanako, 'answers');
    await buzz(taro, 'queues');
    await judge(host, '花子', '不正解');

    for (const page of everyone) {
      await expect(scoreRow(page, '花子')).toContainText('失格');
    }

    await nextResponder(host);
    await judge(host, '太郎', '正解');
    await nextQuestion(host);

    await expect(
      hanako.getByRole('heading', { name: 'この試合の回答は終了しました' }),
    ).toBeVisible();
    await expect(buzzer(hanako)).toBeDisabled();
    await expect(hanako.getByText('失格です。ほかの参加者の結果をお待ちください。')).toBeVisible();
    await expect(buzzer(taro)).toBeEnabled();
  });

  await test.step('the seventh correct answer wins through', async () => {
    for (const correctSoFar of [4, 5, 6, 7]) {
      await buzz(taro, 'answers');
      await judge(host, '太郎', '正解');
      for (const page of everyone) {
        await expect(marks(page, '太郎', correctSoFar, 0)).toBeVisible();
      }
      if (correctSoFar < 7) {
        await expect(scoreRow(host, '太郎')).not.toContainText('勝ち抜け');
      }
      await nextQuestion(host);
    }

    for (const page of everyone) {
      await expect(scoreRow(page, '太郎')).toContainText('勝ち抜け');
      await expect(scoreRow(page, '花子')).toContainText('失格');
    }
    await expect(taro.getByRole('heading', { name: '勝ち抜けです！' })).toBeVisible();
    await expect(buzzer(taro)).toBeDisabled();
    await expect(buzzer(hanako)).toBeDisabled();
  });

  await test.step('the match result names who won through and who is out', async () => {
    await finishMatch(host);

    for (const page of everyone) {
      const result = matchResult(page);
      await expect(result).toContainText('勝ち抜け');
      const rows = result.getByRole('listitem');
      await expect(rows.nth(0)).toContainText('太郎');
      await expect(rows.nth(0)).toContainText('7○ 0×');
      await expect(rows.nth(1)).toContainText('花子');
      await expect(rows.nth(1)).toContainText('0○ 3× · 失格');
    }
  });
});

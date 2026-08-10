/**
 * Japanese copy shown to clients for each socket error code.
 *
 * Kept in one map so handlers never invent wording at the call site, and so a future toast
 * catalogue can stay aligned with what the server actually sends.
 */

import type { SocketErrorCode } from '@quiz-world/shared';

export const SOCKET_ERROR_MESSAGES: Record<SocketErrorCode, string> = {
  UNAUTHORIZED: 'ホスト権限を確認できませんでした',
  VALIDATION_ERROR: '入力内容を確認してください',
  TOURNAMENT_NOT_FOUND: '大会が見つかりません',
  TOURNAMENT_NOT_JOINABLE: 'この大会には参加できません',
  TOURNAMENT_FULL: '定員に達しているため参加できません',
  DUPLICATE_DISPLAY_NAME: 'その表示名は既に使われています',
  NOT_HOST: 'ホストのみが実行できる操作です',
  NOT_CURRENT_RESPONDER: '回答権のある参加者だけが回答できます',
  INVALID_STATE: '現在の状態ではその操作はできません',
  NO_NEXT_RESPONDER: '次の回答者がいません',
  STALE_CONNECTION: '別の接続に引き継がれました',
  INTERNAL_ERROR: 'サーバーエラーが発生しました',
};

export function socketErrorMessage(code: SocketErrorCode): string {
  return SOCKET_ERROR_MESSAGES[code];
}

/** Derives guidance only; permissions, answer rights and scores remain server-owned. */
import { getParticipantStanding } from '@quiz-world/shared';
import type { RoomStateEvent } from '@quiz-world/shared';

/** Mode copy passed into the shared game stage. */
type BuzzerPrompt = { phase: string; title: string; description: string };

export function getBuzzerPrompt(
  room: RoomStateEvent | undefined,
  participantId: string | undefined,
  connected: boolean,
): BuzzerPrompt {
  if (!connected || room === undefined)
    return {
      phase: '接続待ち',
      title: '接続を確認しています',
      description: '接続が完了すると操作できるようになります。',
    };
  const isHost = participantId === room.hostId;
  const self = room.participants.find((p) => p.id === participantId);
  if (!isHost && self && (room.status === 'idle' || room.status === 'answering')) {
    const standing = getParticipantStanding(self, room.rules);
    if (standing !== 'playing')
      return {
        phase: standing === 'won' ? '勝ち抜け' : '失格',
        title: standing === 'won' ? '勝ち抜けです！' : 'この試合の回答は終了しました',
        description: 'ほかの参加者の回答と、ホストの進行をお待ちください。',
      };
  }
  switch (room.status) {
    case 'finished':
      return {
        phase: '大会終了',
        title: '大会が終了しました',
        description: '最終結果をご確認ください。',
      };
    case 'paused':
      return {
        phase: '一時停止',
        title: 'ゲームを一時停止しています',
        description: 'ホストの接続が戻ると再開します。',
      };
    case 'result':
      return {
        phase: '判定結果',
        title: '判定結果',
        description: isHost
          ? '結果を確認したら、次の進行を選んでください。'
          : 'ホストが次へ進めるまでお待ちください。',
      };
    case 'idle':
      if (isHost) {
        const hasPlayers = room.participants.some((person) => person.id !== room.hostId);
        return {
          phase: '受付中',
          title: hasPlayers ? '早押しを待っています' : '参加者を待っています',
          description: hasPlayers ? '問題を読み上げてください。' : '',
        };
      }
      return {
        phase: '受付中',
        title: 'わかったら、早押し',
        description: '',
      };
    case 'answering': {
      const responder =
        room.participants.find((person) => person.id === room.currentResponderId)?.name ?? '参加者';
      if (isHost)
        return {
          phase: '回答中',
          title: `${responder}さんの回答を判定`,
          description: '声またはテキストの回答を確認し、正解・不正解を押してください。',
        };
      if (participantId === room.currentResponderId)
        return {
          phase: 'あなたの番',
          title: 'あなたの回答番です',
          description: '声で答えるか、下の入力欄から回答を送信してください。',
        };
      const ownIndex = room.buzzOrder.findIndex((entry) => entry.participantId === participantId);
      const currentIndex = room.buzzOrder.findIndex(
        (entry) => entry.participantId === room.currentResponderId,
      );
      if (ownIndex !== -1)
        return ownIndex < currentIndex
          ? {
              phase: '回答済み',
              title: 'この問題の回答は終了しました',
              description: 'ほかの参加者の回答と、ホストの進行をお待ちください。',
            }
          : {
              phase: '受付済み',
              title: '早押しを受け付けました',
              description: `${responder}さんが回答中です。回答権が移ったらお知らせします。`,
            };
      return {
        phase: '回答中',
        title: `${responder}さんが回答中`,
        description: 'まだ早押しできます。押すと回答待ちの列に加わります。',
      };
    }
  }
}

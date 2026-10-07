/** Owns shared room presentation and lifecycle controls independently of the selected game mode. */
import { useState, type ReactNode } from 'react';
import { rankParticipants } from '../game/ranking';
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import {
  loadInviteDetails,
  loadSoundMuted,
  loadTournamentName,
  saveSoundMuted,
  type StoredInviteDetails,
} from '../storage/sessionKeys';
import { Button } from './Button';
import { ConfirmButton } from './ConfirmButton';
import { FinalResult } from './FinalResult';
import { InviteControl } from './InviteControl';
import { JudgeEffect } from './JudgeEffect';
import { MatchResultDialog } from './MatchResultDialog';
import { ParticipantList } from './ParticipantList';
import { RenameForm } from './RenameForm';
import { RuleSettings } from './RuleSettings';
import { RoomFrame } from './RoomFrame';
import { useToast } from './Toast';

/** Mode content stays separate from membership, connectivity and tournament lifecycle. */
type RoomSessionProps = {
  connection: UseRoomSocketResult;
  inviteDetails?: StoredInviteDetails | undefined;
  displayName?: string;
  /** Name of the game mode rendered inside, shown in the room header. */
  modeName?: string;
  children: ReactNode;
};

export function RoomSession({
  connection,
  inviteDetails,
  displayName,
  modeName,
  children,
}: RoomSessionProps) {
  const { status, roomState, participantId, errorMessage, roomClosed } = connection;
  const toast = useToast();
  const [soundMuted, setSoundMuted] = useState(loadSoundMuted);
  const tournamentId = roomState?.tournamentId;
  const invitation = inviteDetails ?? (tournamentId ? loadInviteDetails(tournamentId) : undefined);
  const tournamentName =
    invitation?.name ?? (tournamentId ? loadTournamentName(tournamentId) : undefined);
  const players = roomState?.participants.filter((person) => person.id !== roomState.hostId) ?? [];
  const isHost = participantId !== undefined && roomState?.hostId === participantId;
  const self = roomState?.participants.find((participant) => participant.id === participantId);
  // Header summary only: the same display ranking the score board already shows.
  const selfStanding =
    roomState && !isHost
      ? rankParticipants({
          participants: roomState.participants,
          hostId: roomState.hostId,
          rules: roomState.rules,
        }).find((entry) => entry.participant.id === participantId)
      : undefined;
  const identityDetail = selfStanding
    ? `${selfStanding.rank}位 ・ ${
        roomState?.rules.type === 'maruBatsu'
          ? `${selfStanding.participant.correctCount}○ ${selfStanding.participant.wrongCount}×`
          : `${selfStanding.participant.score}点`
      }`
    : undefined;
  const connectionLabel = roomClosed
    ? 'ルームを閉じました'
    : status === 'joined'
      ? '接続中'
      : (errorMessage ??
        (roomState === undefined ? '接続しています…' : '接続が切れました。再接続しています…'));
  return (
    <RoomFrame
      title={tournamentName ?? 'クイズ大会'}
      modeName={modeName}
      identity={self?.name ?? displayName ?? '接続しています…'}
      identityDetail={identityDetail}
      roleLabel={isHost ? 'ホスト' : '参加者'}
      connectionLabel={connectionLabel}
      reconnecting={status === 'connecting' && roomState !== undefined && !roomClosed}
      settings={<RuleSettings connection={connection} />}
      invite={
        invitation ? (
          <InviteControl inviteCode={invitation.inviteCode} inviteUrl={invitation.inviteUrl} />
        ) : undefined
      }
      rosterCount={players.length}
      roster={
        <ParticipantList
          rules={roomState?.rules}
          participants={roomState?.participants ?? []}
          selfParticipantId={participantId}
          hostId={roomState?.hostId}
          currentResponderId={
            roomState?.status === 'answering' ? roomState.currentResponderId : undefined
          }
          // Offered where the server accepts it: never while somebody holds the answer right.
          onAdjust={
            isHost &&
            (roomState?.status === 'idle' ||
              roomState?.status === 'result' ||
              roomState?.status === 'matchResult')
              ? connection.adjustScore
              : undefined
          }
          adjustDisabled={status !== 'joined' || roomClosed}
        />
      }
      actions={
        <div className="qw-room-actions">
          <label className="qw-sound-toggle">
            <input
              type="checkbox"
              checked={!soundMuted}
              onChange={(event) => {
                setSoundMuted(!event.target.checked);
                saveSoundMuted(!event.target.checked);
              }}
            />
            効果音を鳴らす
          </label>
          <RenameForm connection={connection} />
          <Button
            disabled={status !== 'joined' || roomClosed}
            onClick={() => {
              connection.leave();
              toast.show('退出しました');
            }}
          >
            退出
          </Button>
        </div>
      }
    >
      {roomState?.status === 'paused' &&
      roomState.pausedReason === 'hostDisconnected' &&
      !isHost ? (
        <section className="qw-room-notice" aria-label="ホストの切断">
          <h2>ホストの接続が切れたため一時停止中です</h2>
          <p>ホストの復帰を待つか、進行役を引き継いで再開できます。</p>
          <Button disabled={status !== 'joined' || roomClosed} onClick={connection.claimHost}>
            ホストを引き継ぐ
          </Button>
        </section>
      ) : null}
      {roomState?.status === 'finished' ? (
        <section className="qw-room-results" aria-label="最終結果">
          <p className="qw-eyebrow">大会終了</p>
          <h2>最終結果</h2>
          <FinalResult
            rules={roomState.rules}
            participants={roomState.participants}
            hostId={roomState.hostId}
          />
          {isHost ? (
            <fieldset disabled={status !== 'joined'} className="qw-room-controls qw-host-progress">
              {roomClosed ? (
                <p>ルームを閉じました。</p>
              ) : (
                <ConfirmButton
                  label="ルームを閉じる"
                  question="ルームを閉じると全員の接続が切れます。よろしいですか？"
                  confirmLabel="閉じる"
                  onConfirm={connection.closeRoom}
                />
              )}
            </fieldset>
          ) : null}
        </section>
      ) : (
        children
      )}
      <JudgeEffect effect={connection.judgeEffect} muted={soundMuted} />
      {roomState?.status === 'matchResult' ? (
        <MatchResultDialog
          rules={roomState.rules}
          participants={roomState.participants}
          hostId={roomState.hostId}
          isHost={isHost}
          disabled={status !== 'joined' || roomClosed}
          onNextMatch={connection.nextMatch}
        />
      ) : null}
      {isHost &&
      (roomState?.status === 'idle' ||
        roomState?.status === 'result' ||
        roomState?.status === 'matchResult') ? (
        <fieldset
          className="qw-room-controls qw-tournament-actions"
          disabled={status !== 'joined' || roomClosed}
          aria-label="大会の管理"
        >
          {roomState.status === 'matchResult' ? (
            <Button onClick={connection.nextMatch}>次の試合へ</Button>
          ) : (
            <ConfirmButton
              label="試合終了"
              question="この試合を終了して結果を表示しますか？ 得点は次の試合を始めるとリセットされます。"
              confirmLabel="試合を終了する"
              onConfirm={connection.finishMatch}
            />
          )}
          <ConfirmButton
            label="大会終了"
            question="大会を終了して最終結果を表示しますか？ 終了後は早押しできません。"
            confirmLabel="終了する"
            onConfirm={connection.finishTournament}
          />
        </fieldset>
      ) : null}
    </RoomFrame>
  );
}

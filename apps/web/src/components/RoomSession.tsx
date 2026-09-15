/** Owns shared room presentation and lifecycle controls independently of the selected game mode. */
import type { ReactNode } from 'react';
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import {
  loadInviteDetails,
  loadTournamentName,
  type StoredInviteDetails,
} from '../storage/sessionKeys';
import { Button } from './Button';
import { ConfirmButton } from './ConfirmButton';
import { FinalResult } from './FinalResult';
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
  children: ReactNode;
};

export function RoomSession({
  connection,
  inviteDetails,
  displayName,
  children,
}: RoomSessionProps) {
  const { status, roomState, participantId, errorMessage, roomClosed } = connection;
  const toast = useToast();
  const tournamentId = roomState?.tournamentId;
  const invitation = inviteDetails ?? (tournamentId ? loadInviteDetails(tournamentId) : undefined);
  const tournamentName =
    invitation?.name ?? (tournamentId ? loadTournamentName(tournamentId) : undefined);
  const players = roomState?.participants.filter((person) => person.id !== roomState.hostId) ?? [];
  const isHost = participantId !== undefined && roomState?.hostId === participantId;
  const self = roomState?.participants.find((participant) => participant.id === participantId);
  const connectionLabel = roomClosed
    ? 'ルームを閉じました'
    : status === 'joined'
      ? '接続中'
      : (errorMessage ??
        (roomState === undefined ? '接続しています…' : '接続が切れました。再接続しています…'));
  return (
    <RoomFrame
      title={tournamentName ?? 'クイズ大会'}
      identity={self?.name ?? displayName ?? '接続しています…'}
      roleLabel={isHost ? 'ホスト' : '参加者'}
      connectionLabel={connectionLabel}
      reconnecting={status === 'connecting' && roomState !== undefined && !roomClosed}
      roomInfo={
        isHost && invitation ? (
          <section className="qw-invite-panel" aria-label="招待情報">
            <p>
              招待コード <code>{invitation.inviteCode}</code>
            </p>
            <p className="qw-invite-panel__url">{invitation.inviteUrl}</p>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(invitation.inviteUrl).then(
                  () => toast.show('招待URLをコピーしました'),
                  () => toast.show('コピーに失敗しました', 'error'),
                );
              }}
            >
              招待URLをコピー
            </Button>
          </section>
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
        />
      }
      actions={
        <div className="qw-room-actions">
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
      <RuleSettings connection={connection} />
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
      {isHost && (roomState?.status === 'idle' || roomState?.status === 'result') ? (
        <fieldset
          className="qw-room-controls qw-tournament-actions"
          disabled={status !== 'joined' || roomClosed}
          aria-label="大会の管理"
        >
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

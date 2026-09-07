/**
 * Participant play screen: join with a display name, watch the roster, and press the buzzer.
 *
 * The buzzer and the answer field share the central gameplay area, both always
 * present so the layout does not move between rounds. Whether either is enabled is derived
 * from the broadcast state (`canBuzz`, `canSubmitAnswer`) so a disabled control matches what
 * the server would refuse. A sent answer is not echoed back: participants are not shown an
 * unjudged answer, not even their own.
 *
 * The judgement section appears only while the room is showing a result, which is also the
 * only time the server includes the answer text in a participant's state. Both come straight
 * from that state, so this screen never decides what may be revealed.
 */

import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AnswerForm } from '../components/AnswerForm';
import { RoomFrame } from '../components/RoomFrame';
import { Button } from '../components/Button';
import { BuzzOrderList } from '../components/BuzzOrderList';
import { FinalResult } from '../components/FinalResult';
import { LastResult } from '../components/LastResult';
import { ParticipantList } from '../components/ParticipantList';
import { SubmittedAnswer } from '../components/SubmittedAnswer';
import { useToast } from '../components/Toast';
import { canBuzz } from '../game/canBuzz';
import { canSubmitAnswer } from '../game/canSubmitAnswer';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { joinPath, ROUTE_PATHS } from '../routes';
import { loadParticipantId } from '../storage/sessionKeys';
import type { PlayNavigationState } from './JoinPage';

export function PlayPage() {
  const { tournamentId } = useParams();
  const location = useLocation();
  const toast = useToast();
  const navState = location.state as PlayNavigationState | null;
  const displayName = navState?.displayName;

  const joinRequest = useMemo(() => {
    if (tournamentId === undefined || displayName === undefined) {
      return undefined;
    }
    return {
      kind: 'participant' as const,
      tournamentId,
      displayName,
      participantId: loadParticipantId(tournamentId),
    };
  }, [tournamentId, displayName]);

  const {
    status,
    roomState,
    participantId,
    errorMessage,
    socketError,
    clearSocketError,
    leave,
    buzz,
    submitAnswer,
    roomClosed,
  } = useRoomSocket(joinRequest);

  useEffect(() => {
    if (socketError === undefined) {
      return;
    }
    toast.show(socketError.message, 'error');
    clearSocketError();
  }, [socketError, clearSocketError, toast.show]);

  const buzzEnabled =
    status === 'joined' &&
    canBuzz({
      status: roomState?.status,
      participantId,
      hostId: roomState?.hostId,
      buzzOrder: roomState?.buzzOrder,
    });

  const answerEnabled =
    status === 'joined' &&
    canSubmitAnswer({
      status: roomState?.status,
      participantId,
      currentResponderId: roomState?.currentResponderId,
    });

  const connectionLabel = roomClosed
    ? 'ホストがルームを閉じました'
    : status === 'joined'
      ? '接続中'
      : '接続しています…';

  if (tournamentId === undefined) {
    return (
      <main className="app-shell">
        <h1>プレイ</h1>
        <p>大会が見つかりません。</p>
      </main>
    );
  }

  if (displayName === undefined) {
    return (
      <main className="app-shell">
        <h1>プレイ</h1>
        <p>参加するには表示名の入力が必要です。</p>
        <p>
          <Link to={joinPath()}>参加画面へ</Link>
        </p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app-shell">
        <h1>プレイ</h1>
        <p>{errorMessage ?? '参加に失敗しました'}</p>
        <p>
          <Link to={ROUTE_PATHS.join}>参加画面へ</Link>
        </p>
      </main>
    );
  }

  return (
    <RoomFrame
      title="プレイ"
      connectionLabel={connectionLabel}
      sidebar={<p className="qw-sidebar__identity">{displayName} として参加中</p>}
      roster={
        <section className="qw-room-section" aria-label="参加者一覧">
          <h2>参加者</h2>
          <ParticipantList
            participants={roomState?.participants ?? []}
            selfParticipantId={participantId}
            hostId={roomState?.hostId}
          />
        </section>
      }
      actions={
        <div className="qw-room-actions">
          <Button
            type="button"
            onClick={() => {
              leave();
              toast.show('退出しました');
            }}
          >
            退出
          </Button>
        </div>
      }
    >
      <div className="qw-stage-intro">
        <h2>
          {roomState?.status === 'finished'
            ? '大会終了'
            : answerEnabled
              ? 'あなたの回答番です。'
              : buzzEnabled
                ? '早押し受付中'
                : 'ホストの進行を待っています'}
        </h2>
        <p>
          {roomState?.status === 'finished'
            ? '最終スコアと順位をご確認ください。'
            : '回答権を得たら、声またはテキストで回答してください。'}
        </p>
      </div>

      {roomState?.status === 'finished' ? (
        <section className="qw-room-section" aria-label="最終結果">
          <h2>最終結果</h2>
          <FinalResult participants={roomState.participants} hostId={roomState.hostId} />
        </section>
      ) : null}

      {roomState?.status === 'result' ? (
        <section className="qw-room-section" aria-label="判定結果">
          <h2>判定</h2>
          <LastResult result={roomState.lastResult} participants={roomState.participants} />
          <SubmittedAnswer
            answer={roomState.currentSubmittedAnswer}
            participants={roomState.participants}
          />
        </section>
      ) : null}

      {roomState?.status !== 'finished' ? (
        <div className="qw-buzz-bar">
          <AnswerForm
            disabled={!answerEnabled}
            onSubmit={(answerText) => {
              submitAnswer(answerText);
              toast.show('回答を送信しました');
            }}
          />
          <Button
            type="button"
            disabled={!buzzEnabled}
            onClick={() => {
              buzz();
            }}
          >
            早押し
          </Button>
          {!buzzEnabled && status === 'joined' ? (
            <p className="qw-buzz-bar__hint">いまは押せません</p>
          ) : null}
        </div>
      ) : null}
      {roomState?.status !== 'finished' ? (
        <section className="qw-room-section" aria-label="早押し順">
          <h2>早押し順</h2>
          <BuzzOrderList
            buzzOrder={roomState?.buzzOrder ?? []}
            participants={roomState?.participants ?? []}
            currentResponderId={roomState?.currentResponderId}
          />
        </section>
      ) : null}
    </RoomFrame>
  );
}

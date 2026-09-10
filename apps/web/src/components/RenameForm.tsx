/** Edits the current seat's label and waits for the server before confirming success. */
import { INPUT_CONSTRAINTS, validateDisplayName } from '@quiz-world/shared';
import { useState, type FormEvent } from 'react';
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import { Button } from './Button';
import { Input } from './Input';
import { useToast } from './Toast';
/** Uses the existing room connection so editing never opens a second socket. */
type RenameFormProps = { connection: UseRoomSocketResult };
export function RenameForm({ connection }: RenameFormProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const toast = useToast();
  const currentName =
    connection.roomState?.participants.find((p) => p.id === connection.participantId)?.name ?? '';
  const disabled = connection.status !== 'joined' || connection.roomClosed || connection.renaming;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const validated = validateDisplayName(name);
    if (!validated.ok) {
      toast.show(validated.message, 'error');
      return;
    }
    if (await connection.rename(validated.value)) {
      setEditing(false);
      toast.show('表示名を変更しました');
    }
  }
  if (!editing)
    return (
      <Button
        disabled={disabled}
        onClick={() => {
          setName(currentName);
          setEditing(true);
        }}
      >
        表示名を変更
      </Button>
    );
  return (
    <form
      className="qw-rename-form"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <fieldset disabled={disabled} className="qw-room-controls qw-form">
        <Input
          id="rename-display-name"
          label="新しい表示名"
          value={name}
          maxLength={INPUT_CONSTRAINTS.displayName.maxLength}
          onChange={(event) => setName(event.target.value)}
          autoComplete="nickname"
        />
        <Button type="submit" busy={connection.renaming}>
          変更する
        </Button>
        <Button onClick={() => setEditing(false)}>キャンセル</Button>
      </fieldset>
    </form>
  );
}

/** Delayed I/O exposes ordering failures that immediate database mocks cannot detect. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoomRegistry } from '../rooms/roomRegistry';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { createTestAppDependencies } from '../testing/appDependencies';
import { createSnapshotLifecycle } from './lifecycle';
import type { SnapshotRepository } from './repository';
function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup() {
  const dependencies = createTestAppDependencies();
  const registry = createRoomRegistry({ now: () => 10 });
  const repository: SnapshotRepository = {
    find: vi.fn(() => Promise.resolve(undefined)),
    save: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  };
  const lifecycle = createSnapshotLifecycle({
    registry,
    snapshots: repository,
    repository: dependencies.repository,
    logger: dependencies.logger,
    now: () => 10,
  });
  return { registry, repository, lifecycle, dependencies };
}
afterEach(() => vi.useRealTimers());
describe('snapshot writes', () => {
  it('does not postpone persistence indefinitely during a continuous burst', async () => {
    vi.useFakeTimers();
    const { registry, repository, lifecycle } = setup();
    const room = registry.claim('t', createRoomStateFixture({ tournamentId: 't' }));
    await vi.advanceTimersByTimeAsync(150);
    room.update((s) => ({ ok: true, state: { ...s, status: 'answering' } }));
    await vi.advanceTimersByTimeAsync(50);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repository.save).mock.calls[0]?.[0].status).toBe('answering');
    await lifecycle.shutdown();
  });
  it('does not retry an old failure after a newer queued snapshot has succeeded', async () => {
    vi.useFakeTimers();
    const { registry, repository, lifecycle } = setup();
    let fail: (error: Error) => void = () => {};
    const blocked = new Promise<void>((_resolve, reject) => {
      fail = reject;
    });
    vi.mocked(repository.save).mockImplementationOnce(() => blocked);
    const room = registry.claim('t', createRoomStateFixture({ tournamentId: 't' }));
    await vi.advanceTimersByTimeAsync(200);
    room.update((s) => ({ ok: true, state: { ...s, status: 'finished' } }));
    await vi.advanceTimersByTimeAsync(200);
    fail(new Error('old request failed'));
    await lifecycle.flush('t');
    await lifecycle.shutdown();
    expect(vi.mocked(repository.save).mock.calls.map(([s]) => s.status)).toEqual([
      'idle',
      'finished',
    ]);
  });

  it('coalesces bursts, serializes writes and keeps the latest change behind slow I/O', async () => {
    vi.useFakeTimers();
    const { registry, repository, lifecycle } = setup();
    const gate = deferred();
    vi.mocked(repository.save).mockImplementationOnce(() => gate.promise);
    const room = registry.claim('t', createRoomStateFixture({ tournamentId: 't' }));
    room.update((s) => ({ ok: true, state: { ...s, status: 'answering' } }));
    await vi.advanceTimersByTimeAsync(199);
    expect(repository.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    room.update((s) => ({ ok: true, state: { ...s, status: 'finished' } }));
    await vi.advanceTimersByTimeAsync(200);
    expect(repository.save).toHaveBeenCalledTimes(1);
    gate.resolve();
    await lifecycle.flush('t');
    expect(vi.mocked(repository.save).mock.calls.map(([s]) => s.status)).toEqual([
      'answering',
      'finished',
    ]);
    await lifecycle.shutdown();
  });
  it('stops pending writes, drains an in-flight write, then deletes without resurrection', async () => {
    vi.useFakeTimers();
    const { registry, repository, lifecycle } = setup();
    const gate = deferred();
    vi.mocked(repository.save).mockImplementationOnce(() => gate.promise);
    const room = registry.claim('t', createRoomStateFixture({ tournamentId: 't' }));
    await vi.advanceTimersByTimeAsync(200);
    room.update((s) => ({ ok: true, state: { ...s, status: 'finished' } }));
    const removal = lifecycle.remove('t');
    expect(lifecycle.isClosing('t')).toBe(true);
    expect(repository.remove).not.toHaveBeenCalled();
    gate.resolve();
    await removal;
    room.update((s) => ({ ok: true, state: s }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.remove).toHaveBeenCalledTimes(1);
    await lifecycle.shutdown();
  });
  it('retries failed saves on flush and resumes saving if deletion fails', async () => {
    vi.useFakeTimers();
    const { registry, repository, lifecycle } = setup();
    vi.mocked(repository.save).mockRejectedValueOnce(new Error('unavailable'));
    registry.claim('t', createRoomStateFixture({ tournamentId: 't' }));
    await vi.advanceTimersByTimeAsync(200);
    await lifecycle.flush('t');
    expect(repository.save).toHaveBeenCalledTimes(2);
    vi.mocked(repository.remove).mockRejectedValueOnce(new Error('unavailable'));
    await expect(lifecycle.remove('t')).rejects.toThrow('unavailable');
    expect(lifecycle.isClosing('t')).toBe(false);
    await lifecycle.shutdown();
    expect(repository.save).toHaveBeenCalledTimes(3);
  });
  it('flushes the last pending state on shutdown', async () => {
    vi.useFakeTimers();
    const { registry, repository, lifecycle } = setup();
    registry.claim('t', createRoomStateFixture({ tournamentId: 't' }));
    await lifecycle.shutdown();
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('lazy recovery', () => {
  it('shares concurrent reads and restores before any empty room can be claimed', async () => {
    const { registry, repository, lifecycle, dependencies } = setup();
    await dependencies.repository.create({
      id: 't',
      name: 'test',
      inviteCode: '12345678',
      maxParticipants: 10,
      status: 'active',
      hostTokenHash: 'hash',
      createdAt: 1,
      updatedAt: 1,
    });
    const gate = deferred();
    const state = createRoomStateFixture({ tournamentId: 't', status: 'answering' });
    vi.mocked(repository.find).mockImplementation(async () => {
      await gate.promise;
      return state;
    });
    const a = lifecycle.load('t');
    const b = lifecycle.load('t');
    expect(a).toBe(b);
    expect(registry.find('t')).toBeUndefined();
    gate.resolve();
    const room = await a;
    expect(room?.read()).toMatchObject({
      status: 'paused',
      statusBeforePause: 'answering',
      hostOnline: false,
    });
    expect(repository.find).toHaveBeenCalledTimes(1);
    expect((await lifecycle.load('t'))?.read()).toBe(room?.read());
    await lifecycle.shutdown();
    expect(await lifecycle.load('t')).toBeUndefined();
  });
  it('refuses missing or closed tournaments without results and never overwrites failed reads', async () => {
    const { registry, repository, lifecycle, dependencies } = setup();
    expect(await lifecycle.load('missing')).toBeUndefined();
    await dependencies.repository.create({
      id: 't',
      name: 'test',
      inviteCode: '12345678',
      maxParticipants: 10,
      status: 'closed',
      hostTokenHash: 'hash',
      createdAt: 1,
      updatedAt: 1,
    });
    expect(await lifecycle.load('t')).toBeUndefined();
    vi.mocked(repository.find).mockRejectedValueOnce(new Error('database unavailable'));
    await expect(lifecycle.load('t')).rejects.toThrow();
    expect(registry.find('t')).toBeUndefined();
    vi.mocked(repository.find).mockResolvedValue(
      createRoomStateFixture({ tournamentId: 't', status: 'finished' }),
    );
    expect((await lifecycle.load('t'))?.read().status).toBe('finished');
    await lifecycle.remove('t');
    expect(await lifecycle.load('t')).toBeUndefined();
    await lifecycle.shutdown();
  });
  it('seeds an active room only after a successful missing-snapshot read', async () => {
    const { lifecycle, dependencies } = setup();
    await dependencies.repository.create({
      id: 't',
      name: 'test',
      inviteCode: '12345678',
      maxParticipants: 10,
      status: 'active',
      hostTokenHash: 'hash',
      createdAt: 1,
      updatedAt: 1,
    });
    expect((await lifecycle.load('t'))?.read()).toMatchObject({ hostId: '', participants: [] });
    await lifecycle.shutdown();
  });
  it('does not resurrect a room when close overtakes a pending load', async () => {
    const { lifecycle, repository, registry, dependencies } = setup();
    await dependencies.repository.create({
      id: 't',
      name: 'test',
      inviteCode: '12345678',
      maxParticipants: 10,
      status: 'closed',
      hostTokenHash: 'hash',
      createdAt: 1,
      updatedAt: 1,
    });
    const gate = deferred();
    vi.mocked(repository.find).mockImplementation(async () => {
      await gate.promise;
      return createRoomStateFixture({ tournamentId: 't', status: 'finished' });
    });
    const loading = lifecycle.load('t');
    await lifecycle.remove('t');
    gate.resolve();
    expect(await loading).toBeUndefined();
    expect(registry.find('t')).toBeUndefined();
    await lifecycle.shutdown();
  });
});

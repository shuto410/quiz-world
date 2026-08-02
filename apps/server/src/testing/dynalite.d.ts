/**
 * Types for `dynalite`, which ships none.
 *
 * Only the surface this repository uses is declared. `dynalite` is a development dependency
 * used to run the repository tests against a real DynamoDB implementation in process, so this
 * file never affects the production build.
 */

declare module 'dynalite' {
  import type { Server } from 'node:http';

  type DynaliteOptions = {
    /** Directory for the LevelDB files. Left unset to keep everything in memory. */
    path?: string;
    /** Milliseconds a table stays in CREATING. Zero makes creation synchronous for tests. */
    createTableMs?: number;
    deleteTableMs?: number;
    updateTableMs?: number;
  };

  export default function dynalite(options?: DynaliteOptions): Server;
}

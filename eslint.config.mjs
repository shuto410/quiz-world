/**
 * ESLint configuration for the quiz-world monorepo.
 *
 * Beyond the usual recommended rule sets, this configuration encodes the architectural
 * invariants described in AGENTS.md so that they are enforced mechanically instead of
 * relying on reviewer memory:
 *
 * - `any` and non-null assertions are banned everywhere, so that the shared types stay
 *   the single source of truth instead of being escaped from.
 * - `apps/server/src/domain/**` must contain synchronous, deterministic, side-effect free
 *   state transitions. Imports of I/O libraries, `await`, timers, `Date.now()` and
 *   `Math.random()` are rejected there; the current time and generated identifiers must be
 *   passed in as arguments so that game logic stays atomic and reproducible in tests.
 */

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Room state must travel through `broadcastRoomState()`, which is the only place that knows
 * to convert the state before it reaches participants. A raw emit would leak an unjudged
 * answer to everyone in the room.
 */
const noRawRoomStateEmit = {
  selector: 'CallExpression[callee.property.name="emit"][arguments.0.value="room:state"]',
  message: 'Send room state through broadcastRoomState(); participants need the converted view.',
};

/** Selectors that make a module non-deterministic or non-atomic. */
const impureSyntax = [
  {
    selector: 'AwaitExpression',
    message:
      'Domain logic must be synchronous: an await between reading and writing RoomState breaks atomicity. Do the I/O in the caller.',
  },
  {
    selector: ':function[async=true]',
    message:
      'Domain logic must be synchronous: an await between reading and writing RoomState breaks atomicity. Do the I/O in the caller.',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    message: 'Pass the current time in as an argument so that state transitions stay testable.',
  },
  {
    selector: 'NewExpression[callee.name="Date"]',
    message: 'Pass the current time in as an argument so that state transitions stay testable.',
  },
  {
    selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
    message: 'Pass generated identifiers in as arguments so that state transitions stay testable.',
  },
  {
    selector: 'CallExpression[callee.name=/^(setTimeout|setInterval|setImmediate)$/]',
    message: 'Timers belong in the application layer, not in the domain layer.',
  },
];

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/cdk.out/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          // Destructuring a key out in order to drop it is how a field is withheld from a
          // payload, so the discarded binding is intentional rather than forgotten.
          ignoreRestSiblings: true,
          // Some signatures are fixed by the framework rather than by the implementation:
          // Express identifies error middleware by its arity, so the unused fourth parameter
          // is what makes the function work. An underscore marks the omission as deliberate,
          // matching what `noUnusedParameters` already accepts in tsconfig.
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['apps/server/src/**/*.ts'],
    ignores: ['apps/server/src/socket/broadcast.ts'],
    rules: {
      'no-restricted-syntax': ['error', noRawRoomStateEmit],
    },
  },

  {
    files: ['apps/server/src/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'socket.io',
                'socket.io-client',
                'express',
                'ioredis',
                '@aws-sdk/*',
                'aws-cdk-lib',
                'node:*',
                'fs',
                'http',
              ],
              message:
                'Domain logic must stay free of I/O. Keep sockets, storage and HTTP in the application layer.',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', ...impureSyntax, noRawRoomStateEmit],
      'no-console': 'error',
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);

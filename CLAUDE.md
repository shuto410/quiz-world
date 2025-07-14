# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preference

**Please communicate in Japanese (日本語) when working with this user.** The user prefers Japanese language responses for all interactions, explanations, and code comments.

## Project Overview

Quiz World is a real-time multiplayer quiz application built with Next.js and Socket.io. The project follows Test-Driven Development (TDD) practices with 318 tests and 92.17% coverage.

## Development Commands

### Common Commands
- `npm run dev` - Start both frontend and server concurrently
- `npm run dev:web` - Start Next.js development server on port 3000
- `npm run dev:server` - Start Socket.io server on port 3002
- `npm run build` - Build for production
- `npm run start` - Start production server

### Testing Commands
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run all tests once
- `npm run test:coverage` - Run tests with coverage report

### Quality Assurance
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run check` - Run all checks (type, lint, test with coverage)

## Architecture

### Dual-Server Architecture
The application uses a dual-server setup:
1. **Next.js Server** (port 3000): Handles frontend rendering and API routes
2. **Socket.io Server** (port 3002): Handles real-time communication

Both servers must be running during development. The frontend connects to the Socket.io server for real-time features.

### Feature-Based Structure
The codebase follows a feature-based architecture organized in `src/features/`:
- `room/` - Room management (create, join, leave, host transfer)
- `quiz/` - Quiz creation and management
- `chat/` - Real-time chat functionality
- `room-list/` - Public room listing

Each feature contains:
- `components/` - Feature-specific React components
- `hooks/` - Custom hooks for feature logic

### Key Components
- `src/lib/socketClient.ts` - Socket.io client connection management
- `src/server/socket.ts` - Socket.io server event handlers
- `src/lib/roomManager.ts` - Room state management
- `src/lib/userStorage.ts` - User session persistence

### Socket.io Event System
Real-time communication uses typed Socket.io events:
- Room events: `room:create`, `room:join`, `room:leave`, `room:list`
- Quiz events: `quiz:add`, `quiz:start`, `quiz:answer`, `quiz:judge`
- Game events: `game:buzz`, `game:answer`
- Chat events: `chat:message`

## Testing

### Test Framework
- **Vitest** for unit and integration tests
- **@testing-library/react** for component testing
- **jsdom** environment for DOM testing

### Test Coverage Requirements
- Maintain 90%+ test coverage
- All new features must include comprehensive tests
- Tests are located alongside source files (`.test.ts` or `.test.tsx`)

### Running Single Tests
```bash
# Run specific test file
npm run test -- src/components/ui/Button.test.tsx

# Run tests matching pattern
npm run test -- --grep "Button"
```

## Key Architectural Patterns

### Socket Connection Management
The `socketClient.ts` handles connection lifecycle, reconnection, and typed event handling. Always use the provided client functions rather than direct socket operations.

### Room State Management
Room state is managed server-side in `roomManager.ts`. All room operations go through the Socket.io server, ensuring consistency across clients.

### User Session Persistence
User sessions persist across browser refreshes using `userStorage.ts`, which implements fallback storage (localStorage → sessionStorage → memory).

### TypeScript Types
All Socket.io events and data structures are strictly typed in `src/types/`. Follow existing type definitions when adding new features.

## Development Guidelines

### TDD Workflow (t-wada Style)
1. **Red**: Write failing tests first
2. **Green**: Implement minimal code to pass tests
3. **Refactor**: Improve code while maintaining test coverage
4. Maintain test coverage above 90%
5. Always run `npm run test:run` after code modifications

### Code Documentation Standards
- **All files must start with English specification comments**
- Include SPECIFICATION section describing purpose and behavior
- Add KEY BEHAVIORS section for important implementation details
- List DEPENDENCIES section for external modules
- For test files, include TEST SPECIFICATION and TESTING STRATEGY sections

### Code Quality
- All code must pass TypeScript type checking
- Follow ESLint rules (enforced by `npm run lint`)
- Use existing UI components from `src/components/ui/`
- Follow feature-based organization for new functionality

### File Creation Template
```typescript
/**
 * [Component/Hook/Utility Name] - [Brief Description]
 * 
 * SPECIFICATION:
 * - [Main purpose and responsibilities]
 * - [Key features and behaviors]
 * - [Integration points with other components]
 * 
 * KEY BEHAVIORS:
 * - [Important implementation details]
 * - [State management patterns]
 * - [Event handling approaches]
 * 
 * DEPENDENCIES:
 * - [External libraries or modules]
 * - [Internal dependencies]
 */
```

### Test File Template
```typescript
/**
 * [Component/Hook/Utility Name] Test Suite
 * 
 * TEST SPECIFICATION:
 * - [What aspects are being tested]
 * - [Testing approach and strategy]
 * - [Coverage goals]
 * 
 * TESTING STRATEGY:
 * - Red: Write failing tests first
 * - Green: Implement minimal code to pass tests
 * - Refactor: Improve code while maintaining test coverage
 * 
 * KEY TEST CASES:
 * - [Important test scenarios]
 * - [Edge cases covered]
 * - [Error handling tests]
 */
```

### Socket.io Development
- Test Socket.io events thoroughly with mock socket instances
- Use typed events from `src/types/socket.ts`
- Handle connection states properly in components
- Always validate user permissions server-side

## Production Considerations

### Health Monitoring
- Socket.io server provides health check at `/health`
- Server logs connection events and errors
- Graceful shutdown handling for SIGTERM/SIGINT

### Security
- CORS configuration for production domains
- User validation for all socket events
- Host-only permissions for room management operations

## Coding Guidelines

### File Documentation
- 各ファイルの冒頭には英語のコメントで仕様を記述して

## Coding Conventions

### Comment Guidelines
- コメントは必ず英語で書いて
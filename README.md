# Quiz World

[![Tests](https://img.shields.io/badge/Tests-318-green)](https://github.com/shuto410/quiz-world)
[![Coverage](https://img.shields.io/badge/Coverage-92.17%25-brightgreen)](https://github.com/shuto410/quiz-world)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://github.com/shuto410/quiz-world)

A real-time multiplayer quiz application built with Next.js and Socket.io, developed using Test-Driven Development practices.

## Overview

Quiz World is a real-time multiplayer quiz application where users can create rooms, join existing ones, and participate in interactive quiz games. The application supports both text-based and image-based questions with real-time synchronization of user states and game progress.

## Key Features

- **Real-time multiplayer rooms** with Socket.io
- **Quiz creation and management** with text and image support  
- **Host management** with role transfer capabilities
- **Persistent user sessions** across browser refreshes
- **Comprehensive test coverage** (318 tests, 92.17% coverage)
- **Feature-based architecture** for maintainability

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── room/[id]/         # Dynamic room pages
│   ├── quiz-creator/      # Quiz creation page
│   ├── quiz-game/         # Quiz game page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── features/              # Feature-based modules
│   ├── room/             # Room management feature
│   │   ├── components/   # Room-specific components
│   │   └── hooks/        # Room-specific hooks
│   ├── quiz/             # Quiz management feature
│   │   ├── components/   # Quiz-specific components
│   │   └── hooks/        # Quiz-specific hooks
│   └── chat/             # Chat feature
│       └── hooks/        # Chat-specific hooks
├── components/            # Shared components
│   └── ui/               # Reusable UI components
├── lib/                  # Utility libraries
│   ├── socketClient.ts   # Socket.io client
│   ├── userStorage.ts    # User data persistence
│   └── roomManager.ts    # Room management logic
├── server/               # Socket.io server
│   ├── index.ts          # Server entry point
│   └── socket.ts         # Socket event handlers
├── types/                # TypeScript type definitions
└── test/                 # Test utilities
```

## Development Methodology

This project follows Test-Driven Development (TDD) practices:

- **Red-Green-Refactor cycle**: Write failing tests first, implement minimal code, then refactor
- **High test coverage**: Maintaining 92.17% test coverage across the codebase
- **Quality assurance**: 318 tests ensure code reliability and prevent regressions
- **Continuous testing**: All changes are validated through comprehensive test suites

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd quiz-world
```

2. Install dependencies:
```bash
npm install
```

3. Start the development environment:

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Socket.io Server:**
```bash
npm run dev:server
```

4. Open your browser and navigate to:
   - Frontend: http://localhost:3000
   - Server Health Check: http://localhost:3002/health

### Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run dev:server` - Start Socket.io server in development
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run all tests once
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run check` - Run all checks (type, lint, test)

## Socket.io Events

### Client to Server
- `room:join` - Join a specific room
- `room:leave` - Leave current room
- `room:create` - Create new room
- `room:requestList` - Get available public rooms
- `quiz:start` - Begin quiz game
- `quiz:answer` - Submit quiz answer
- `host:transfer` - Transfer host role
- `chat:message` - Send chat message

### Server to Client
- `room:joined` - Confirmation of successful room join
- `room:userJoined` - Notification of new user joining
- `room:userLeft` - Notification of user leaving
- `room:updated` - Room state changes
- `room:list` - Available rooms with current status
- `quiz:started` - Quiz game initiation
- `quiz:ended` - Quiz completion with results
- `host:transferred` - Host role transfer confirmation
- `chat:message` - Broadcast chat message
- `error` - Error handling

## Testing

### Test Structure
- **Unit Tests**: Individual components and functions
- **Integration Tests**: Socket event handling
- **Component Tests**: React components with full lifecycle
- **Hook Tests**: Custom hooks with edge cases

### Running Tests
```bash
# Run all tests
npm run test:run

# Run tests in watch mode
npm run test

# Generate coverage report
npm run test:coverage
```

### Test Coverage
Current coverage: 92.17%
- UI Components: 98.26%
- Feature Modules: 95%+
- Socket Client: Comprehensive event handling
- User Storage: Multi-storage fallback testing
- Room Management: Complete room lifecycle testing

## Contributing

### Development Workflow

1. Fork and clone the repository
2. Create a feature branch
3. Write tests for your changes
4. Implement the feature
5. Ensure all tests pass
6. Maintain test coverage above 90%
7. Submit a pull request

### Quality Standards

- All tests must pass
- Test coverage must be maintained at 90%+
- TypeScript type checking must pass
- ESLint rules must be followed
- Code should be well-documented

## License

This project is licensed under the MIT License.

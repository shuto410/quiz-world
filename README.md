# Quiz World 🎯

A real-time multiplayer quiz game built with Next.js and Socket.io.

## 🎮 Game Overview

Quiz World is a real-time multiplayer quiz application where users can create rooms, join existing ones, and participate in interactive quiz games. The game supports both text-based and image-based questions with real-time synchronization of user states and game progress.

## 🏗️ Architecture

- **Frontend**: Next.js 15 with React 19, TypeScript, and Tailwind CSS
- **Backend**: Socket.io server with Node.js
- **Real-time Communication**: Socket.io for bidirectional communication
- **Testing**: Vitest with React Testing Library
- **State Management**: React hooks with Socket.io events

## 🎯 Core Features

### ✅ Implemented Features

1. **User Management**
   - User registration with persistent storage
   - User authentication and session management
   - Real-time user presence tracking

2. **Room System**
   - Create public and private rooms
   - Join existing rooms with real-time updates
   - Room listing with current user count
   - Host management (room creator becomes host)

3. **Real-time Communication**
   - Socket.io client-server communication
   - Real-time user list updates
   - Room state synchronization
   - Connection status management

4. **Quiz System**
   - Text-based quiz creation
   - Image-based quiz support (upload/URL)
   - Quiz management interface
   - Answer validation system

5. **Game Flow**
   - Room joining/leaving
   - Quiz selection and starting
   - Real-time score tracking
   - Game state management

### 🚧 In Progress / Planned Features

1. **Game Mechanics**
   - Quiz game execution
   - Timer system for questions
   - Score calculation and leaderboards
   - Game results and statistics

2. **Enhanced Features**
   - Quiz categories and difficulty levels
   - Custom quiz creation tools
   - Image upload functionality
   - Chat system during games

3. **User Experience**
   - Responsive design improvements
   - Animation and transitions
   - Sound effects and notifications
   - Accessibility features

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── room/[id]/         # Dynamic room pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── Room.tsx          # Room component
│   ├── RoomList.tsx      # Room listing
│   ├── QuizGame.tsx      # Quiz game interface
│   └── QuizCreator.tsx   # Quiz creation tool
├── lib/                  # Utility libraries
│   ├── socketClient.ts   # Socket.io client
│   └── userStorage.ts    # User data persistence
├── server/               # Socket.io server
│   ├── index.ts          # Server entry point
│   └── socket.ts         # Socket event handlers
├── types/                # TypeScript type definitions
│   └── index.ts          # Domain models
└── test/                 # Test utilities
```

## 🎯 Domain Models

### Core Types

- **User**: Player information with host status
- **Room**: Game room with users, quizzes, and settings
- **Quiz**: Questions with text or image support
- **Score**: User performance tracking
- **ImageResource**: Image handling for visual questions

## 🚀 Getting Started

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
   - Server Health Check: http://localhost:3001/health

### Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run dev:server` - Start Socket.io server in development
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run check` - Run all checks (type, lint, test)

## 🧪 Testing

The project follows TDD principles with comprehensive test coverage:

- **Unit Tests**: Vitest with React Testing Library
- **Coverage Target**: 100% test coverage
- **Test Files**: `*.test.ts` for each `*.ts` implementation
- **Mock Strategy**: Socket.io events and Next.js router

Run tests with coverage:
```bash
npm run test:coverage
```

## 🔌 Socket.io Events

### Client to Server
- `joinRoom` - Join a specific room
- `leaveRoom` - Leave current room
- `requestRoomList` - Get available rooms
- `createRoom` - Create new room
- `startQuiz` - Begin quiz game

### Server to Client
- `room:joined` - Confirmation of room join
- `room:userJoined` - New user joined room
- `room:userLeft` - User left room
- `room:updated` - Room state changed
- `roomList` - Available rooms list

## 🎨 UI Components

### Core Components
- **RoomList**: Display and manage available rooms
- **Room**: Main game room interface
- **QuizGame**: Quiz execution interface
- **QuizCreator**: Quiz creation and management

### Design System
- **Styling**: Tailwind CSS with custom utilities
- **Responsive**: Mobile-first design approach
- **Accessibility**: ARIA labels and keyboard navigation

## 🔧 Development Guidelines

### Code Quality
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **TDD**: Test-driven development approach

### File Structure
- **Components**: Functional components with hooks
- **Types**: Centralized in `src/types/index.ts`
- **Tests**: Co-located with implementation files
- **Documentation**: JSDoc comments for all public APIs

### State Management
- **Local State**: React useState for component state
- **Real-time State**: Socket.io events for server synchronization
- **Persistence**: LocalStorage for user preferences

## 🚀 Deployment

### Production Build
```bash
npm run build
npm run start
```

### Environment Variables
- `PORT` - Socket.io server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)

## 📊 Current Progress

### ✅ Completed (100%)
- [x] Project setup and configuration
- [x] User authentication and storage
- [x] Socket.io server implementation
- [x] Room creation and management
- [x] Real-time user synchronization
- [x] Basic quiz creation interface
- [x] Navigation and routing
- [x] Comprehensive test coverage

### 🚧 In Progress (75%)
- [x] Quiz game execution logic
- [ ] Timer and scoring system
- [ ] Game state management
- [ ] Results and statistics

### 📋 Planned (0%)
- [ ] Enhanced UI/UX improvements
- [ ] Advanced quiz features
- [ ] Performance optimizations
- [ ] Mobile app version

## 🤝 Contributing

1. Follow TDD principles
2. Maintain 100% test coverage
3. Use TypeScript for type safety
4. Follow existing code style and patterns
5. Add JSDoc comments for new functions

## 📝 License

This project is licensed under the MIT License.

---

**Quiz World** - Where knowledge meets real-time competition! 🎯

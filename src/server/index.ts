/**
 * Socket.io server entry point for Quiz World application
 * - Standalone server for development and production
 * - Handles HTTP server creation and Socket.io initialization
 */

import { createServer } from 'http';
import { initializeSocket } from './socket';

const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = createServer((req, res) => {
  // Basic health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }
  
  // Default response for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Socket.io server is running');
});

// Initialize Socket.io
initializeSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
  console.log(`📡 CORS enabled for: ${process.env.NODE_ENV === 'production' ? 'production' : 'http://localhost:3000, http://localhost:3001'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 
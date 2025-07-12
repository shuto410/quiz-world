/**
 * Domain models for Quiz World application
 * - Room (public/private)
 * - User
 * - Quiz (text/image)
 * - Score
 * - ImageResource (upload/URL)
 */

/**
 * Represents a user in the quiz room
 * @property id - Unique identifier for the user
 * @property name - Display name of the user
 * @property isHost - Whether the user is the host (quiz master)
 */
export type User = {
  id: string;
  name: string;
  isHost: boolean;
};

/**
 * Represents an image resource, either uploaded or by URL
 * @property type - 'upload' or 'url'
 * @property data - For 'upload', a base64 string; for 'url', the image URL
 */
export type ImageResource =
  | { type: 'upload'; data: string }
  | { type: 'url'; data: string };

/**
 * Represents a quiz question (text or image)
 * @property id - Unique identifier for the quiz
 * @property type - 'text' or 'image'
 * @property question - The question text
 * @property image - Image resource (for image quiz)
 * @property answer - The correct answer (for reference)
 * @property choices - Optional choices (for future extension)
 */
export type Quiz = {
  id: string;
  type: 'text' | 'image';
  question: string;
  image?: ImageResource;
  answer: string;
  choices?: string[];
};

/**
 * Represents a score entry for a user
 * @property userId - The user's id
 * @property score - The score value
 */
export type Score = {
  userId: string;
  score: number;
};

/**
 * Represents a quiz room
 * @property id - Unique identifier for the room
 * @property name - Room name
 * @property isPublic - Whether the room is public
 * @property users - Users in the room
 * @property quizzes - Quizzes in the room
 * @property hostId - Current host's user id
 * @property maxPlayers - Maximum number of players
 * @property createdAt - Creation timestamp for accurate chronological sorting
 */
export type Room = {
  id: string;
  name: string;
  isPublic: boolean;
  users: User[];
  quizzes: Quiz[];
  hostId: string;
  maxPlayers: number;
  createdAt: number;
}; 
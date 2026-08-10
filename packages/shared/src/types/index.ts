/**
 * Aggregated entry point of the domain model.
 *
 * Every type describing the application's data lives under this directory, so that the web
 * client and the socket server cannot drift apart by maintaining their own copies.
 */

export * from './api';
export * from './game';
export * from './socket';
export * from './tournament';
export * from './validation';

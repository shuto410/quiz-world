/**
 * Public entry point of the shared package.
 *
 * Domain types, socket event contracts and validation helpers are re-exported from
 * this module so that the web client and the socket server always agree on the same
 * definitions. Nothing in this package may import runtime-specific modules such as
 * `socket.io`, `express`, the AWS SDK or browser globals: it must stay usable from
 * both a Node process and a browser bundle.
 *
 * The contents are filled in by step 2 (domain types) and step 3 (socket contracts).
 */

export {};

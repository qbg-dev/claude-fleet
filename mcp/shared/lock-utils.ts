/**
 * Re-export from canonical location at shared/lock-utils.ts.
 * Kept for backward compatibility — MCP server imports from here.
 */
export { acquireLock, releaseLock, withLocked } from "../../shared/lock-utils";

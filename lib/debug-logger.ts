/**
 * STRUCTURED DEBUG LOGGER with correlation IDs.
 * All critical actions log through here for consistent format.
 * Logs are written to console (server) and stored in memory (client) for the diagnostics page.
 */

let _correlationCounter = 0;

export function generateCorrelationId(prefix: string): string {
  _correlationCounter++;
  return `${prefix}_${Date.now()}_${_correlationCounter}`;
}

export interface DebugLogEntry {
  timestamp: string;
  correlationId?: string;
  action: string;
  userId?: string;
  role?: string;
  accountId?: string;
  orderId?: string;
  data?: any;
  result?: 'start' | 'success' | 'failure';
  error?: string;
  durationMs?: number;
}

// In-memory ring buffer for recent logs (client-side diagnostics)
const MAX_LOG_ENTRIES = 200;
const _logBuffer: DebugLogEntry[] = [];

export function getRecentLogs(): DebugLogEntry[] {
  return [..._logBuffer];
}

export function clearLogs(): void {
  _logBuffer.length = 0;
}

/**
 * Core structured log function.
 * @param action - Action name (e.g., 'CUSTOMER_LOGIN', 'CREATE_ORDER', 'CALC_TAX')
 * @param data - Payload/context object
 * @param context - Optional user/order context
 */
export function debugLog(
  action: string,
  data?: any,
  context?: { correlationId?: string; userId?: string; role?: string; accountId?: string; orderId?: string; result?: 'start' | 'success' | 'failure'; error?: string; durationMs?: number }
): void {
  const entry: DebugLogEntry = {
    timestamp: new Date().toISOString(),
    action,
    correlationId: context?.correlationId,
    userId: context?.userId,
    role: context?.role,
    accountId: context?.accountId,
    orderId: context?.orderId,
    data: data ?? undefined,
    result: context?.result,
    error: context?.error,
    durationMs: context?.durationMs,
  };

  // Console output (structured)
  const prefix = `[DEBUG:${action}]`;
  const meta = [
    context?.correlationId && `cid=${context.correlationId}`,
    context?.userId && `uid=${context.userId}`,
    context?.role && `role=${context.role}`,
    context?.accountId && `acct=${context.accountId}`,
    context?.orderId && `order=${context.orderId}`,
    context?.result && `result=${context.result}`,
    context?.durationMs !== undefined && `${context.durationMs}ms`,
  ].filter(Boolean).join(' ');

  if (context?.result === 'failure' || context?.error) {
    console.error(prefix, meta, data, context?.error ? `ERROR: ${context.error}` : '');
  } else {
    console.log(prefix, meta, typeof data === 'object' ? JSON.stringify(data, null, 0) : data);
  }

  // Ring buffer
  _logBuffer.push(entry);
  if (_logBuffer.length > MAX_LOG_ENTRIES) _logBuffer.shift();
}

/**
 * Convenience: log start + return a finish() function that logs success/failure with duration.
 */
export function debugLogAction(
  action: string,
  context: { correlationId?: string; userId?: string; role?: string; accountId?: string; orderId?: string },
  startData?: any
): { success: (data?: any) => void; failure: (error: string, data?: any) => void; correlationId: string } {
  const correlationId = context.correlationId || generateCorrelationId(action);
  const startTime = Date.now();

  debugLog(action, startData, { ...context, correlationId, result: 'start' });

  return {
    correlationId,
    success: (data?: any) => {
      debugLog(action, data, { ...context, correlationId, result: 'success', durationMs: Date.now() - startTime });
    },
    failure: (error: string, data?: any) => {
      debugLog(action, data, { ...context, correlationId, result: 'failure', error, durationMs: Date.now() - startTime });
    },
  };
}

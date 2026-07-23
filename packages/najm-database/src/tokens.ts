// ============================================================================
// Database Module Tokens
// ============================================================================

import { createAlsToken } from 'najm-core';

export const DATABASE_CONFIG = Symbol.for('najm:database:config');
export const DATABASE_META = Symbol.for('najm:database');
export const TRANSACTIONS = createAlsToken<Map<string, any>>('transactions');
export const TRANSACTION_DEPTH = createAlsToken<number>('transactionDepth');

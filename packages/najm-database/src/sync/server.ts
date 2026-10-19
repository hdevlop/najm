import { assertOperationContext, canonicalJson, SyncError, verifyOperation, type OperationReceipt, type SyncContext, type SyncOperation, type SyncOutcome } from './contracts';

/** Throw only inside a savepoint, after validation or a domain refusal. */
export class CommandRefusal extends Error {
  constructor(public readonly outcome: Exclude<SyncOutcome, { state: 'acknowledged' }>) { super(outcome.code); }
}
export interface OperationTransaction {
  /** Installation ordering comes before every domain/operation row lock. */
  lock(context: SyncContext, operationId: string): Promise<void>;
  find(context: SyncContext, operationId: string): Promise<(OperationReceipt & { deviceId: string }) | null>;
  save(context: SyncContext, receipt: OperationReceipt, deviceId: string): Promise<void>;
  /** A refusal rolls back partial domain work before its outcome is persisted. */
  savepoint<T>(work: () => Promise<T>): Promise<T>;
}
export interface OperationStore {
  transaction<T>(work: (transaction: OperationTransaction) => Promise<T>): Promise<T>;
}
export interface ApplyOperationOptions<I, R> {
  store: OperationStore;
  operation: SyncOperation<I>;
  hashFormat: string;
  /** Resolve current actor/epoch/year/rights; never trust a supplied actor. */
  authorize: (operation: SyncOperation<I>) => Promise<SyncContext>;
  /** Recheck current domain rights and expected revision INSIDE the transaction. */
  apply: (operation: SyncOperation<I>, transaction: OperationTransaction, context: SyncContext) => Promise<SyncOutcome<R>>;
}

/** One durable result per scoped immutable operation, including after lost replies. */
export async function applyOperation<I, R>(options: ApplyOperationOptions<I, R>): Promise<OperationReceipt<R>> {
  const operation = JSON.parse(canonicalJson(options.operation)) as SyncOperation<I>;
  await verifyOperation(operation, options.hashFormat);
  // authorize is repeated on duplicates; an operation ID never bypasses disclosure.
  const context = await options.authorize(operation);
  assertOperationContext(operation, context);
  return options.store.transaction(async transaction => {
    await transaction.lock(context, operation.operationId);
    // Membership can change while this request waits for the ordering lock.
    const current = await options.authorize(operation);
    assertOperationContext(operation, current);
    if (current.authorizationGeneration !== context.authorizationGeneration) throw new SyncError('AUTHORIZATION_CHANGED');
    const existing = await transaction.find(current, operation.operationId);
    if (existing) {
      if (existing.payloadHash !== operation.payloadHash) throw new SyncError('OPERATION_HASH_MISMATCH');
      return { operationId: existing.operationId, payloadHash: existing.payloadHash, outcome: existing.outcome } as OperationReceipt<R>;
    }
    for (const id of operation.dependencies) {
      const predecessor = await transaction.find(current, id);
      if (!predecessor || predecessor.deviceId !== operation.deviceId || predecessor.outcome.state !== 'acknowledged') {
        // No durable refusal: an unsent/in-flight dependency can become known later.
        throw new SyncError(predecessor ? 'DEPENDENCY_REJECTED' : 'DEPENDENCY_PENDING');
      }
    }
    let outcome: SyncOutcome<R>;
    try { outcome = await transaction.savepoint(() => options.apply(operation, transaction, current)); }
    catch (error) {
      if (!(error instanceof CommandRefusal)) throw error;
      outcome = error.outcome;
    }
    const receipt: OperationReceipt<R> = { operationId: operation.operationId, payloadHash: operation.payloadHash, outcome };
    await transaction.save(current, receipt, operation.deviceId);
    return receipt;
  });
}

/** Reconcile uncertainty under the same current disclosure/identity checks as push. */
export async function lookupOperation<I>(options: Omit<ApplyOperationOptions<I, unknown>, 'apply'>): Promise<
  { state: 'known'; receipt: OperationReceipt } | { state: 'not_found' }
> {
  const operation = JSON.parse(canonicalJson(options.operation)) as SyncOperation<I>;
  await verifyOperation(operation, options.hashFormat);
  const context = await options.authorize(operation);
  assertOperationContext(operation, context);
  return options.store.transaction(async transaction => {
    await transaction.lock(context, operation.operationId);
    const current = await options.authorize(operation);
    assertOperationContext(operation, current);
    if (current.authorizationGeneration !== context.authorizationGeneration) throw new SyncError('AUTHORIZATION_CHANGED');
    const receipt = await transaction.find(current, operation.operationId);
    if (!receipt) return { state: 'not_found' };
    if (receipt.payloadHash !== operation.payloadHash) throw new SyncError('OPERATION_HASH_MISMATCH');
    return { state: 'known', receipt: { operationId: receipt.operationId, payloadHash: receipt.payloadHash, outcome: receipt.outcome } };
  });
}

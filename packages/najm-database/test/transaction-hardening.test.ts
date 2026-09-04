import { describe, expect, test } from 'bun:test';
import { TransactionService } from '../dist/index.mjs';

describe('@Transaction configuration hardening', () => {
  test('rejects a transaction injection for a different constructor', () => {
    class ExpectedService {
      run() {}
    }
    class ActualService {
      run() {}
    }

    const service = new TransactionService();
    let injector: any;
    (service as any).container = {
      use(value: any) {
        injector = value;
      },
      getInjectionsFor() {
        return [{
          target: ExpectedService,
          propertyKey: 'run',
          options: { database: 'ledger' },
        }];
      },
    };

    (service as any).registerInjector();

    expect(() => injector.inject(new ActualService(), ActualService)).toThrow(
      /expectedConstructor=ExpectedService; actualConstructor=ActualService; method=run; database=ledger/,
    );
  });

  test('rejects missing and duplicate transaction metadata during activation', async () => {
    class PaymentService {
      charge() {}
    }

    const service = new TransactionService();
    (service as any).databaseService = { has: () => true };
    (service as any).container = {
      getInjections() {
        return [
          { target: PaymentService, propertyKey: 'charge', options: {} },
          { target: PaymentService, propertyKey: 'charge', options: {} },
        ];
      },
    };

    let duplicateError: unknown;
    try {
      await service.activate();
    } catch (error) {
      duplicateError = error;
    }

    expect(duplicateError).toBeInstanceOf(Error);
    const duplicateMessage = (duplicateError as Error).message;
    expect(duplicateMessage).toContain('Duplicate transaction injection detected');
    expect(duplicateMessage).toContain('constructor=PaymentService; method=charge; database=default');
    expect(duplicateMessage).toContain('multiple loaded copies of najm-database');
    expect(duplicateMessage).not.toContain('expectedConstructor=');
    expect(duplicateMessage).not.toContain('actualConstructor=');

    (service as any).container.getInjections = () => [
      { target: PaymentService, propertyKey: 'missing', options: {} },
    ];

    await expect(service.activate()).rejects.toThrow(
      /Decorated transaction property is not a method.*method=missing/,
    );
  });

  test('rejects wrapping the same transaction method twice', () => {
    class PaymentService {
      charge() {
        return 'ok';
      }
    }

    const service = new TransactionService();
    const instance = new PaymentService();

    (service as any).wrapMethod(instance, PaymentService, PaymentService, 'charge', {});

    expect(() => {
      (service as any).wrapMethod(instance, PaymentService, PaymentService, 'charge', {});
    }).toThrow(/Duplicate transaction wrapper detected/);
  });
});

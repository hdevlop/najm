import { describe, expect, it } from 'bun:test';
import { calculateFee } from './fee-calculator';

describe('FeeService', () => {
  it('calculates the default fee quote', () => {
    const result = calculateFee({ amount: 100 });

    expect(result.currency).toBe('USD');
    expect(result.subtotal).toBe(100);
    expect(result.percentageFee).toBe(2.9);
    expect(result.totalFee).toBe(3.2);
    expect(result.netAmount).toBe(96.8);
    expect(result.effectiveRate).toBe(3.2);
  });

  it('applies min and max fee guards', () => {
    const minimumFee = calculateFee({ amount: 1, percentageRate: 1, flatFee: 0, minimumFee: 0.5 });
    const maximumFee = calculateFee({ amount: 1000, percentageRate: 5, flatFee: 10, maximumFee: 20 });

    expect(minimumFee.totalFee).toBe(0.5);
    expect(maximumFee.totalFee).toBe(20);
  });
});

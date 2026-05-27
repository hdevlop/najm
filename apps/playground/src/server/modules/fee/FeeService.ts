import { Service } from 'najm-api';
import type { CalculateFeeDto } from './FeeDto';
import { calculateFee, FEE_DEFAULTS } from './fee-calculator';

@Service()
export class FeeService {
  defaults() {
    return FEE_DEFAULTS;
  }

  testConnection() {
    return {
      module: 'fees',
      status: 'ready',
      defaults: this.defaults(),
      tools: ['fees_test', 'fees_calculate'],
    };
  }

  calculate(input: CalculateFeeDto) {
    return calculateFee(input);
  }
}

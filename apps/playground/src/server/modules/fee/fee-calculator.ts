import type { CalculateFeeDto, FeeRoundingMode } from './FeeDto';

export const FEE_DEFAULTS = {
  percentageRate: 2.9,
  flatFee: 0.3,
  currency: 'USD',
  quantity: 1,
  rounding: 'nearest' as FeeRoundingMode,
};

const roundCurrency = (value: number, mode: FeeRoundingMode): number => {
  const scaled = value * 100;

  if (mode === 'up') {
    return Math.ceil(scaled - Number.EPSILON) / 100;
  }

  if (mode === 'down') {
    return Math.floor(scaled + Number.EPSILON) / 100;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const roundPercent = (value: number): number =>
  Math.round((value + Number.EPSILON) * 10000) / 10000;

export const calculateFee = (input: CalculateFeeDto) => {
  const percentageRate = input.percentageRate ?? FEE_DEFAULTS.percentageRate;
  const flatFee = input.flatFee ?? FEE_DEFAULTS.flatFee;
  const currency = (input.currency ?? FEE_DEFAULTS.currency).toUpperCase();
  const quantity = input.quantity ?? FEE_DEFAULTS.quantity;
  const rounding = input.rounding ?? FEE_DEFAULTS.rounding;

  const rawSubtotal = input.amount * quantity;
  const rawPercentageFee = rawSubtotal * (percentageRate / 100);

  let rawTotalFee = rawPercentageFee + flatFee;

  if (input.minimumFee !== undefined) {
    rawTotalFee = Math.max(rawTotalFee, input.minimumFee);
  }

  if (input.maximumFee !== undefined) {
    rawTotalFee = Math.min(rawTotalFee, input.maximumFee);
  }

  const subtotal = roundCurrency(rawSubtotal, rounding);
  const percentageFee = roundCurrency(rawPercentageFee, rounding);
  const totalFee = roundCurrency(rawTotalFee, rounding);
  const netAmount = roundCurrency(rawSubtotal - rawTotalFee, rounding);
  const effectiveRate = subtotal === 0 ? 0 : roundPercent((totalFee / subtotal) * 100);

  return {
    currency,
    quantity,
    rounding,
    subtotal,
    percentageRate,
    flatFee: roundCurrency(flatFee, rounding),
    percentageFee,
    totalFee,
    netAmount,
    effectiveRate,
    minimumFee: input.minimumFee,
    maximumFee: input.maximumFee,
  };
};

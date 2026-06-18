import type { TestCase, TestResult } from '@/features/routing-tests/types';

export interface TestFileRow extends TestCase {
  lastStatus?: TestResult['status'] | 'pending';
  lastConfidence?: number | null;
  lastActualTools?: string[];
  lastMissingTools?: string[];
  lastScores?: TestResult['scores'];
  lastRunAt?: string | null;
}

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

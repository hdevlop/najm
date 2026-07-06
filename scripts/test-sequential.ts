#!/usr/bin/env bun

import { $ } from 'bun';
import { TEST_TARGETS } from './workspaces.ts';

interface TestResult {
  package: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

console.log('🧪 Running all tests sequentially...\n');

console.log('🏗️  Building workspace before tests...\n');
await $`turbo run build`;

for (const target of TEST_TARGETS) {
  const pkg = target.name;
  const start = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Testing ${pkg}...`);
  console.log('='.repeat(60));

  try {
    await $`bun run --cwd ${target.workspace} test`;
    const duration = Date.now() - start;
    results.push({ package: pkg, passed: true, duration });
    console.log(`✅ ${pkg} - PASSED (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({ 
      package: pkg, 
      passed: false, 
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    console.log(`❌ ${pkg} - FAILED (${duration}ms)`);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));

const passed = results.filter(r => r.passed);
const failed = results.filter(r => !r.passed);

console.log(`✅ Passed: ${passed.length}/${TEST_TARGETS.length}`);
console.log(`❌ Failed: ${failed.length}/${TEST_TARGETS.length}`);

if (passed.length > 0) {
  console.log('\n✅ Passed packages:');
  passed.forEach(r => {
    console.log(`  - ${r.package} (${r.duration}ms)`);
  });
}

if (failed.length > 0) {
  console.log('\n❌ Failed packages:');
  failed.forEach(r => {
    console.log(`  - ${r.package} (${r.duration}ms)`);
  });
  process.exit(1);
}

const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
console.log(`\n⏱️  Total time: ${totalDuration}ms`);
console.log('🎉 All tests passed!');

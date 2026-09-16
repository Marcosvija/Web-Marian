import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildManifest,
  normalizeConclusion,
  validateManifest,
} from '../../scripts/ci-evidence.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';

function makeEnvironment() {
  return {
    CI_EVIDENCE_DIR: 'ci-evidence',
    GITHUB_REPOSITORY: 'Marcosvija/Web-Marian',
    GITHUB_SHA: SHA,
    GITHUB_RUN_ID: '123456',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_SERVER_URL: 'https://github.com',
    CI_OUTCOME_DEPENDENCIES: 'success',
    CI_OUTCOME_ASTRO: 'success',
    CI_OUTCOME_UNIT: 'success',
    CI_OUTCOME_BROWSER: 'success',
    CI_OUTCOME_E2E: 'success',
    CI_OUTCOME_BUILD: 'success',
  };
}

function makeEvidenceDirectory() {
  const baseDir = mkdtempSync(join(tmpdir(), 'web-marian-ci-evidence-'));
  const evidenceDir = join(baseDir, 'ci-evidence');
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(join(baseDir, 'test-results'), { recursive: true });

  for (const filename of [
    'npm-ci.log',
    'astro-check.log',
    'vitest-report.json',
    'vitest.log',
    'playwright-install.log',
    'playwright-report.json',
    'playwright.log',
    'build.log',
  ]) {
    writeFileSync(join(evidenceDir, filename), '{}\n', 'utf8');
  }

  return baseDir;
}

describe('CI evidence manifest', () => {
  it('normalizes GitHub step outcomes to contract conclusions', () => {
    expect(normalizeConclusion('success')).toBe('passed');
    expect(normalizeConclusion('failure')).toBe('failed');
    expect(normalizeConclusion('skipped')).toBe('skipped');
    expect(normalizeConclusion('cancelled')).toBe('cancelled');
    expect(normalizeConclusion(undefined)).toBe('not_run');
  });

  it('builds evidence that validates against the exact GitHub execution identity', () => {
    const baseDir = makeEvidenceDirectory();
    const env = makeEnvironment();
    const manifest = buildManifest(env, { baseDir });

    const errors = validateManifest(manifest, {
      baseDir,
      expected: {
        repository: env.GITHUB_REPOSITORY,
        headSha: env.GITHUB_SHA,
        runId: env.GITHUB_RUN_ID,
        runAttempt: env.GITHUB_RUN_ATTEMPT,
      },
    });

    expect(errors).toEqual([]);
    expect(manifest.target_sha).toBe(manifest.head_sha);
    expect(manifest.semantics.qa_conclusion).toBeNull();
    expect(manifest.checks).toHaveLength(6);
    expect(manifest.checks.every((check) => check.conclusion === 'passed')).toBe(true);
  });

  it('rejects target attribution when target_sha and head_sha differ', () => {
    const baseDir = makeEvidenceDirectory();
    const manifest = buildManifest(makeEnvironment(), { baseDir });
    manifest.target_sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    const errors = validateManifest(manifest, { baseDir });

    expect(errors).toContain('target_sha must equal head_sha');
  });

  it('rejects unsupported schema versions and missing referenced evidence', () => {
    const baseDir = makeEvidenceDirectory();
    const manifest = buildManifest(makeEnvironment(), { baseDir });
    manifest.schema_version = '2.0';
    manifest.checks[0].evidence.push({
      kind: 'report',
      path: 'ci-evidence/does-not-exist.json',
    });

    const errors = validateManifest(manifest, { baseDir });

    expect(errors).toContain('schema_version must be 1.0');
    expect(errors).toContain(
      'check dependency-install: referenced evidence is missing: ci-evidence/does-not-exist.json',
    );
  });
});

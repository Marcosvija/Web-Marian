import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const REPOSITORY_PATTERN = /^[^/\s]+\/[^/\s]+$/;
const ALLOWED_CONCLUSIONS = new Set([
  'passed',
  'failed',
  'skipped',
  'cancelled',
  'not_run',
]);

const CHECK_DEFINITIONS = [
  {
    id: 'dependency-install',
    category: 'setup',
    purpose: 'Install locked npm dependencies reproducibly',
    outcomeEnv: 'CI_OUTCOME_DEPENDENCIES',
    evidence: [{ kind: 'log', path: 'npm-ci.log' }],
  },
  {
    id: 'astro-check',
    category: 'static-analysis',
    purpose: 'Validate Astro and TypeScript structure',
    outcomeEnv: 'CI_OUTCOME_ASTRO',
    evidence: [{ kind: 'log', path: 'astro-check.log' }],
  },
  {
    id: 'unit-tests',
    category: 'unit-tests',
    purpose: 'Run Vitest unit tests',
    outcomeEnv: 'CI_OUTCOME_UNIT',
    evidence: [
      { kind: 'report', path: 'vitest-report.json' },
      { kind: 'log', path: 'vitest.log' },
    ],
  },
  {
    id: 'browser-install',
    category: 'setup',
    purpose: 'Install Chromium and system dependencies for Playwright',
    outcomeEnv: 'CI_OUTCOME_BROWSER',
    evidence: [{ kind: 'log', path: 'playwright-install.log' }],
  },
  {
    id: 'browser-tests',
    category: 'browser-tests',
    purpose: 'Run Playwright browser and automated accessibility coverage',
    outcomeEnv: 'CI_OUTCOME_E2E',
    evidence: [
      { kind: 'report', path: 'playwright-report.json' },
      { kind: 'log', path: 'playwright.log' },
      { kind: 'attachments', path: '../test-results' },
    ],
  },
  {
    id: 'production-build',
    category: 'build',
    purpose: 'Build the production site',
    outcomeEnv: 'CI_OUTCOME_BUILD',
    evidence: [{ kind: 'log', path: 'build.log' }],
  },
];

export function normalizeConclusion(outcome) {
  switch (outcome) {
    case 'success':
      return 'passed';
    case 'failure':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'skipped':
      return 'skipped';
    default:
      return 'not_run';
  }
}

function toPositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function hasUploadableContent(path) {
  const stats = statSync(path);
  if (!stats.isDirectory()) return true;

  return readdirSync(path, { withFileTypes: true }).some((entry) => {
    if (entry.name.startsWith('.')) return false;

    const childPath = resolve(path, entry.name);
    if (entry.isDirectory()) return hasUploadableContent(childPath);
    return entry.isFile();
  });
}

function collectExistingEvidence(baseDir, evidenceDir, definitions) {
  return definitions.flatMap((item) => {
    const artifactPath = item.path.startsWith('../')
      ? item.path.slice(3)
      : `${evidenceDir}/${item.path}`;
    const localPath = resolve(baseDir, artifactPath);

    if (!existsSync(localPath) || !hasUploadableContent(localPath)) {
      return [];
    }

    return [{ kind: item.kind, path: artifactPath }];
  });
}

export function buildManifest(env = process.env, options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  const evidenceDir = env.CI_EVIDENCE_DIR || 'ci-evidence';
  const repository = env.GITHUB_REPOSITORY || '';
  const headSha = env.GITHUB_SHA || '';
  const runId = toPositiveInteger(env.GITHUB_RUN_ID);
  const runAttempt = toPositiveInteger(env.GITHUB_RUN_ATTEMPT);
  const serverUrl = env.GITHUB_SERVER_URL || 'https://github.com';
  const runUrl = env.GITHUB_RUN_URL || `${serverUrl}/${repository}/actions/runs/${runId ?? ''}`;

  return {
    schema_version: '1.0',
    evidence_type: 'technical_ci',
    repository,
    target_sha: headSha,
    run_id: runId,
    run_attempt: runAttempt,
    head_sha: headSha,
    run_url: runUrl,
    generated_at: new Date().toISOString(),
    semantics: {
      qa_conclusion: null,
      statement:
        'This artifact is technical CI evidence only. QA determines PASS/FAIL independently for the exact target SHA.',
    },
    checks: CHECK_DEFINITIONS.map((definition) => ({
      id: definition.id,
      category: definition.category,
      purpose: definition.purpose,
      conclusion: normalizeConclusion(env[definition.outcomeEnv]),
      evidence: collectExistingEvidence(baseDir, evidenceDir, definition.evidence),
    })),
  };
}

function addError(errors, condition, message) {
  if (condition) errors.push(message);
}

function validateEvidencePath(errors, baseDir, item, checkId) {
  addError(
    errors,
    !item || typeof item !== 'object',
    `check ${checkId}: evidence entry must be an object`,
  );
  if (!item || typeof item !== 'object') return;

  addError(
    errors,
    typeof item.kind !== 'string' || item.kind.length === 0,
    `check ${checkId}: evidence kind is required`,
  );
  addError(
    errors,
    typeof item.path !== 'string' || item.path.length === 0,
    `check ${checkId}: evidence path is required`,
  );

  if (typeof item.path !== 'string' || item.path.length === 0) return;

  addError(
    errors,
    isAbsolute(item.path) || item.path.split('/').includes('..'),
    `check ${checkId}: evidence path must stay inside the artifact`,
  );

  if (!isAbsolute(item.path) && !item.path.split('/').includes('..')) {
    addError(
      errors,
      !existsSync(resolve(baseDir, item.path)),
      `check ${checkId}: referenced evidence is missing: ${item.path}`,
    );
  }
}

export function validateManifest(manifest, options = {}) {
  const errors = [];
  const baseDir = options.baseDir ?? process.cwd();
  const expected = options.expected ?? {};

  addError(errors, !manifest || typeof manifest !== 'object', 'manifest must be an object');
  if (!manifest || typeof manifest !== 'object') return errors;

  addError(errors, manifest.schema_version !== '1.0', 'schema_version must be 1.0');
  addError(errors, manifest.evidence_type !== 'technical_ci', 'evidence_type must be technical_ci');
  addError(
    errors,
    typeof manifest.repository !== 'string' || !REPOSITORY_PATTERN.test(manifest.repository),
    'repository must use owner/name format',
  );
  addError(
    errors,
    typeof manifest.target_sha !== 'string' || !SHA_PATTERN.test(manifest.target_sha),
    'target_sha must be a full 40-character SHA',
  );
  addError(
    errors,
    typeof manifest.head_sha !== 'string' || !SHA_PATTERN.test(manifest.head_sha),
    'head_sha must be a full 40-character SHA',
  );
  addError(errors, manifest.target_sha !== manifest.head_sha, 'target_sha must equal head_sha');
  addError(
    errors,
    !Number.isSafeInteger(manifest.run_id) || manifest.run_id <= 0,
    'run_id must be a positive integer',
  );
  addError(
    errors,
    !Number.isSafeInteger(manifest.run_attempt) || manifest.run_attempt <= 0,
    'run_attempt must be a positive integer',
  );
  addError(
    errors,
    typeof manifest.run_url !== 'string' || manifest.run_url.length === 0,
    'run_url is required',
  );
  if (typeof manifest.run_url === 'string' && Number.isSafeInteger(manifest.run_id)) {
    addError(
      errors,
      !manifest.run_url.includes(`/actions/runs/${manifest.run_id}`),
      'run_url must reference run_id',
    );
  }
  addError(
    errors,
    typeof manifest.generated_at !== 'string' || Number.isNaN(Date.parse(manifest.generated_at)),
    'generated_at must be an ISO-8601-compatible timestamp',
  );
  addError(
    errors,
    !manifest.semantics || manifest.semantics.qa_conclusion !== null,
    'semantics.qa_conclusion must be null so CI evidence is not presented as QA PASS/FAIL',
  );
  addError(
    errors,
    !Array.isArray(manifest.checks) || manifest.checks.length === 0,
    'checks must be a non-empty array',
  );

  if (expected.repository) {
    addError(
      errors,
      manifest.repository !== expected.repository,
      `repository does not match execution metadata: ${expected.repository}`,
    );
  }
  if (expected.headSha) {
    addError(
      errors,
      manifest.head_sha !== expected.headSha,
      `head_sha does not match execution metadata: ${expected.headSha}`,
    );
  }
  if (expected.runId) {
    addError(
      errors,
      manifest.run_id !== toPositiveInteger(expected.runId),
      `run_id does not match execution metadata: ${expected.runId}`,
    );
  }
  if (expected.runAttempt) {
    addError(
      errors,
      manifest.run_attempt !== toPositiveInteger(expected.runAttempt),
      `run_attempt does not match execution metadata: ${expected.runAttempt}`,
    );
  }

  if (Array.isArray(manifest.checks)) {
    const ids = new Set();
    for (const check of manifest.checks) {
      if (!check || typeof check !== 'object') {
        errors.push('each check must be an object');
        continue;
      }

      addError(errors, typeof check.id !== 'string' || check.id.length === 0, 'each check requires an id');
      addError(
        errors,
        typeof check.category !== 'string' || check.category.length === 0,
        `check ${check.id ?? '<unknown>'}: category is required`,
      );
      addError(
        errors,
        typeof check.purpose !== 'string' || check.purpose.length === 0,
        `check ${check.id ?? '<unknown>'}: purpose is required`,
      );
      addError(
        errors,
        !ALLOWED_CONCLUSIONS.has(check.conclusion),
        `check ${check.id ?? '<unknown>'}: unsupported conclusion ${String(check.conclusion)}`,
      );
      addError(errors, ids.has(check.id), `duplicate check id: ${check.id}`);
      ids.add(check.id);

      addError(
        errors,
        !Array.isArray(check.evidence),
        `check ${check.id ?? '<unknown>'}: evidence must be an array`,
      );
      if (Array.isArray(check.evidence)) {
        for (const item of check.evidence) {
          validateEvidencePath(errors, baseDir, item, check.id ?? '<unknown>');
        }
      }
    }
  }

  return errors;
}

function expectedFromEnvironment(env) {
  return {
    repository: env.GITHUB_REPOSITORY,
    headSha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
  };
}

function readManifest(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function printErrors(errors) {
  for (const error of errors) console.error(`- ${error}`);
}

function runCli() {
  const command = process.argv[2];
  const manifestPath = process.argv[3] || 'ci-evidence/manifest.json';

  if (command === 'generate') {
    const manifest = buildManifest(process.env);
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Generated ${manifestPath}`);
    return;
  }

  if (command === 'validate' || command === 'gate') {
    let manifest;
    try {
      manifest = readManifest(manifestPath);
    } catch (error) {
      console.error(`Unable to parse ${manifestPath}: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    const errors = validateManifest(manifest, {
      baseDir: process.cwd(),
      expected: expectedFromEnvironment(process.env),
    });

    if (errors.length > 0) {
      console.error(`Manifest validation failed with ${errors.length} error(s):`);
      printErrors(errors);
      process.exitCode = 1;
      return;
    }

    if (command === 'gate') {
      const blocking = manifest.checks.filter(
        (check) => !['passed', 'skipped'].includes(check.conclusion),
      );
      if (blocking.length > 0) {
        console.error('CI checks did not all complete successfully:');
        for (const check of blocking) {
          console.error(`- ${check.id}: ${check.conclusion}`);
        }
        process.exitCode = 1;
        return;
      }
    }

    console.log(`Manifest ${command === 'gate' ? 'gate' : 'validation'} passed.`);
    return;
  }

  console.error('Usage: node scripts/ci-evidence.mjs <generate|validate|gate> [manifest-path]');
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}

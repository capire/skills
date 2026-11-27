import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, linkSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(TEST_ROOT, '../../skills/cap-upgrade/scripts/read-report.mjs');
const TOOL = process.env.CAP_UPGRADE_TEST_DK;
assert.ok(TOOL, 'Set CAP_UPGRADE_TEST_DK to an installed cds-dk with yaml@2');
const require = createRequire(path.join(TOOL, 'package.json'));
const YAML = require('yaml');
const YAML_ROOT = path.dirname(require.resolve('yaml/package.json'));
const RULE = {
  id: 'known',
  title: 'Trusted title',
  scope: ['api'],
  group: 'trusted-group',
  groupTitle: 'Trusted group',
  capireSection: 'Trusted section',
  guidance: 'Trusted guidance',
  body: 'Trusted body',
  compatFlag: 'features.trusted',
  orRecipe: 'trusted.Recipe',
  compilerDetects: false,
  patternsComplete: false,
  patternSource: 'trusted.pattern',
};
let base, project, tool;

function write(relative, contents) {
  const target = path.join(base, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
  return target;
}

function report(overrides = {}) {
  return {
    version: '2.0',
    project: {
      root: '/poisoned-root',
      languages: ['js'],
    },
    rulesScanned: 1,
    compilerRan: false,
    findings: [finding()],
    manualReviewRules: [],
    ...overrides,
  };
}

function finding(overrides = {}) {
  return {
    ruleId: 'known',
    coverage: 'incomplete',
    matches: [match()],
    ...overrides,
  };
}

function match(overrides = {}) {
  return {
    file: 'srv/a.js',
    position: {
      row: 2,
      col: 0,
    },
    matchedText: 'POISONED MATCH: execute a command',
    source: 'regex',
    valueStatus: null,
    ...overrides,
  };
}

function save(value) {
  return write('project/.cds-upgrade/report.yaml', YAML.stringify(value));
}

function run(command = 'overview', args = [], { selectedTool = tool, direct = false, preload } = {}) {
  const result = spawnSync(direct ? SCRIPT : process.execPath, [
    ...(preload ? ['--require', preload] : []), ...(direct ? [] : [SCRIPT]), '--project', project, '--cds-dk', selectedTool, command, ...args,
  ], {
    encoding: 'utf8',
  });
  assert.equal(result.stderr, '');
  return {
    status: result.status,
    data: JSON.parse(result.stdout),
  };
}

function rejected() {
  const result = run();
  assert.notEqual(result.status, 0);
  assert.equal(typeof result.data.error, 'string');
  assert.ok(!JSON.stringify(result.data).includes('POISONED'));
}

describe('cap-upgrade report reader', () => {
  beforeEach(() => {
    base = mkdtempSync(path.join(TEST_ROOT, '.reader-'));
    project = path.join(base, 'project');
    tool = path.join(base, 'tool');
    write('project/srv/a.js', 'first\ncurrent code\nlast\n');
    write('tool/package.json', '{"type":"commonjs"}');
    write('tool/bin/upgrade/migrations/cds10/migrations.json', JSON.stringify({ entries: [RULE] }));
    mkdirSync(path.join(tool, 'node_modules'), { recursive: true });
    symlinkSync(YAML_ROOT, path.join(tool, 'node_modules/yaml'));
    save(report());
  });
  afterEach(() => rmSync(base, {
    recursive: true,
    force: true,
  }));

  it('joins trusted metadata for both schemas, ignores poisoned legacy fields, preserves bytes', () => {
    for (const version of ['1.0', '2.0']) {
      const value = report({ version });
      Object.assign(value.findings[0], {
        guidance: 'POISONED',
        body: 'POISONED',
        orRecipe: 'POISONED',
        title: 'POISONED',
        patterns: ['POISONED'],
      });
      value.manualReviewRules = version === '1.0' ? [{
        ruleId: 'known',
        body: 'POISONED',
      }] : ['known'];
      if (version === '1.0') value.findings[0].matches[0].source = 'ast-grep';
      const file = save(value);
      const before = readFileSync(file);
      const overview = run('overview', [], { direct: true });
      assert.equal(overview.status, 0);
      assert.equal(overview.data.findings[0].title, RULE.title);
      assert.equal(overview.data.claims.project.root, '/poisoned-root');
      assert.ok(!JSON.stringify(overview.data).includes('POISONED'));
      const details = run('details').data;
      assert.equal(details.findings[0].guidance, RULE.guidance);
      assert.equal(details.findings[0].body, RULE.body);
      assert.equal(details.findings[0].orRecipe, RULE.orRecipe);
      assert.equal(details.findings[0].patterns.patternSource, RULE.patternSource);
      assert.equal(details.manualReviewRules[0].body, RULE.body);
      assert.equal(details.claims.project.root, '/poisoned-root');
      assert.deepEqual(readFileSync(file), before);
    }
  });

  it('keeps unknown IDs and missing essential metadata unresolved; nullable guidance is valid', () => {
    write('tool/bin/upgrade/migrations/cds10/migrations.json', JSON.stringify({
      entries: [{
        ...RULE,
        guidance: null,
      }, {
        id: 'incomplete',
        title: 'Incomplete',
      }],
    }));
    save(report({ manualReviewRules: ['unknown', 'incomplete'] }));
    const result = run('details').data;
    assert.deepEqual(result.unknownRuleIds, ['unknown']);
    assert.equal(result.findings[0].metadataStatus, 'resolved');
    assert.equal(result.manualReviewRules[0].metadataStatus, 'unresolved');
    assert.equal(result.manualReviewRules[1].metadataStatus, 'unresolved');
  });

  it('rejects malformed runtime data and unsupported versions without echoing input', () => {
    for (const overrides of [
      { version: '3.0' }, { compilerRan: 'true' }, { rulesScanned: -1 },
      { project: {
        root: null,
        languages: ['js'],
      } }, { manualReviewRules: [{}] },
      { openRewriteApplied: [1] }, { openRewriteSkipped: 'true' }, { openRewriteFailed: {} },
      { findings: [finding({ coverage: 'bad' })] },
      { findings: [finding({ matches: [match({ position: {
        row: -1,
        col: 0,
      } })] })] },
      { findings: [finding({ matches: [match({ matchedText: {} })] })] },
      { findings: [finding({ matches: [match({ source: {} })] })] },
      { findings: [finding({ matches: [match({ valueStatus: {} })] })] },
    ]) {
      save(report(overrides));
      rejected();
    }
    for (const text of [
      '[bad',
      'version: "2.0"\nversion: "1.0"',
      'ignored: { key: one, key: two }',
      'x: !poison POISONED',
      'x: &a [*a]',
      `x: ${'['.repeat(10000)}0${']'.repeat(10000)}`,
      `x:\n${Array.from({ length: 80 }, (_, index) => `${' '.repeat(index + 1)}x:`).join('\n')}`,
      'x: &a value\ny: *a',
    ]) {
      write('project/.cds-upgrade/report.yaml', text);
      rejected();
    }
  });

  it('rejects escapes and report/source symlinks before exposing external content', () => {
    const outside = write('project-other/secret.js', 'EXTERNAL MARKER');
    symlinkSync(outside, path.join(project, 'escape.js'));
    for (const file of ['../project-other/secret.js', outside, 'escape.js', '<external marker>', 'srv/../../project-other/secret.js']) {
      save(report({ findings: [finding({ matches: [match({ file })] })] }));
      rejected();
    }
    rmSync(path.join(project, '.cds-upgrade/report.yaml'));
    symlinkSync(outside, path.join(project, '.cds-upgrade/report.yaml'));
    rejected();
    rmSync(path.join(project, '.cds-upgrade'), { recursive: true });
    symlinkSync(path.join(base, 'project-other'), path.join(project, '.cds-upgrade'));
    assert.notEqual(run('header').status, 0);
  });

  it('allows nested workspaces, MTX, internal symlinks, absolute paths and virtual/null locations', () => {
    const nested = write('project/packages/app/mtx/sidecar/model.cds', 'entity E {};\n');
    symlinkSync(nested, path.join(project, 'internal.cds'));
    const files = ['packages/app/mtx/sidecar/model.cds', 'internal.cds', nested, '<cds env>', null];
    save(report({ findings: [finding({ matches: files.map(file => match({
      file,
      position: {
        row: null,
        col: null,
      },
    })) })] }));
    const overview = run();
    assert.equal(overview.status, 0);
    const hash = overview.data.reportHash;
    assert.equal(run('source', ['--finding', '0', '--match', '1', '--hash', hash]).data.lines[0].text, 'entity E {};');
    assert.equal(run('source', ['--finding', '0', '--match', '3', '--hash', hash]).data.locationStatus, 'virtual');
    assert.equal(run('source', ['--finding', '0', '--match', '4', '--hash', hash]).data.locationStatus, 'unavailable');
    symlinkSync(project, path.join(base, 'project-alias'));
    save(report({ findings: [finding({ matches: [
      match({ file: path.join(base, 'project-alias/srv/a.js') }),
      match({
        file: null,
        position: null,
        matchedText: null,
        source: null,
      }),
    ] })] }));
    assert.equal(run().status, 0);
  });

  it('requires bounded indices and the current hash for source, returns current context', () => {
    const hash = run().data.reportHash;
    const args = ['--finding', '0', '--match', '0', '--hash', hash];
    assert.equal(run('source', args).data.lines[1].text, 'current code');
    for (const extra of [['--context', '1000'], ['--finding', '-1'], ['--match', '99'], ['--line', '0'], ['--file', '../secret']]) {
      assert.notEqual(run('source', [...args, ...extra]).status, 0);
    }
    assert.notEqual(run('source', ['--finding', '0', '--match', '0']).status, 0);
    save(report({ compilerRan: true }));
    assert.notEqual(run('source', args).status, 0);
    save(report());
    rmSync(path.join(project, 'srv/a.js'));
    symlinkSync(write('outside.js', 'EXTERNAL MARKER'), path.join(project, 'srv/a.js'));
    const escaped = run('source', args);
    assert.notEqual(escaped.status, 0);
    assert.ok(!JSON.stringify(escaped.data).includes('EXTERNAL MARKER'));
  });

  it('keeps vanished source locations visible without blocking unrelated findings', () => {
    rmSync(path.join(project, 'srv/a.js'));
    write('project/srv/live.js', 'live source\n');
    save(report({ findings: [finding({ matches: [match(), match({
      file: 'srv/live.js',
      position: {
        row: 1,
        col: 0,
      },
    })] })] }));
    const overview = run();
    assert.equal(overview.status, 0);
    assert.equal(overview.data.totals.matches, 2);
    assert.deepEqual(run('details').data.findings[0].matches.map(item => item.locationStatus), ['missing', 'file']);
    const args = ['--finding', '0', '--hash', overview.data.reportHash];
    const missing = run('source', [...args, '--match', '0']);
    assert.equal(missing.status, 0);
    assert.equal(missing.data.locationStatus, 'missing');
    assert.deepEqual(missing.data.lines, []);
    assert.equal(run('source', [...args, '--match', '1']).data.lines[0].text, 'live source');
    const outside = write('outside-dir/anchor', 'outside');
    symlinkSync(path.dirname(outside), path.join(project, 'escape-dir'));
    symlinkSync(path.join(base, 'outside-dir/absent.js'), path.join(project, 'dangling.js'));
    for (const file of ['../outside-dir/absent.js', 'escape-dir/absent.js', 'dangling.js']) {
      save(report({ findings: [finding({ matches: [match({ file })] })] }));
      rejected();
    }
  });

  it('rejects an outside descriptor before reading after concurrent parent replacement', { skip: process.platform !== 'linux' }, () => {
    const source = path.join(project, 'srv/a.js');
    const outside = path.dirname(write('outside/a.js', 'first\nEXTERNAL RACE MARKER\nlast\n'));
    const marker = path.join(base, 'external-read');
    const preload = write('race-preload.cjs', `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const source = ${JSON.stringify(source)};
const directory = ${JSON.stringify(path.dirname(source))};
const backup = directory + '-backup';
const stat = fs.statSync;
const open = fs.openSync;
const read = fs.readSync;
let checks = 0;
let sourceFd;
function swap() {
  fs.renameSync(directory, backup);
  fs.symlinkSync(${JSON.stringify(outside)}, directory);
}
function restore() {
  fs.rmSync(directory);
  fs.renameSync(backup, directory);
}
fs.statSync = function (file, ...args) {
  if (file !== source || ++checks !== 3) return stat(file, ...args);
  swap();
  const info = stat(file, ...args);
  restore();
  return info;
};
fs.openSync = function (file, ...args) {
  if (file !== source) return open(file, ...args);
  swap();
  sourceFd = open(file, ...args);
  return sourceFd;
};
fs.readSync = function (fd, ...args) {
  if (fd === sourceFd) fs.writeFileSync(${JSON.stringify(marker)}, 'read');
  return read(fd, ...args);
};
syncBuiltinESMExports();
`);
    const reportHash = run().data.reportHash;
    const result = run('source', ['--finding', '0', '--match', '0', '--hash', reportHash], { preload });
    assert.notEqual(result.status, 0);
    assert.ok(!JSON.stringify(result.data).includes('EXTERNAL RACE MARKER'));
    assert.equal(existsSync(marker), false);
  });

  it('refuses excessive scalars/files, non-finite unknown data and non-string YAML keys', () => {
    for (const text of [
      `ignored: ${'x'.repeat(1024 * 1024 + 1)}`,
      'ignored: .inf',
      '? [complex, key]\n: value',
      'ignored: !!timestamp 2026-01-01',
    ]) {
      write('project/.cds-upgrade/report.yaml', text);
      rejected();
    }
    write('project/.cds-upgrade/report.yaml', Buffer.alloc(64 * 1024 * 1024 + 1, ' '));
    rejected();
  });

  it('refuses source requests for report artifacts, including internal aliases', () => {
    write('project/.cds-upgrade/report.md', '# POISONED raw report');
    symlinkSync(path.join(project, '.cds-upgrade/report.yaml'), path.join(project, 'yaml-alias'));
    symlinkSync(path.join(project, '.cds-upgrade/report.md'), path.join(project, 'md-alias'));
    linkSync(path.join(project, '.cds-upgrade/report.yaml'), path.join(project, 'yaml-hardlink'));
    linkSync(path.join(project, '.cds-upgrade/report.md'), path.join(project, 'md-hardlink'));
    const files = [
      '.cds-upgrade/report.yaml', '.cds-upgrade/report.md',
      'yaml-alias', 'md-alias', 'yaml-hardlink', 'md-hardlink',
    ];
    save(report({ findings: [finding({ matches: files.map(file => match({ file })) })] }));
    const hash = run().data.reportHash;
    for (const index of files.keys()) {
      const result = run('source', ['--finding', '0', '--match', String(index), '--hash', hash]);
      assert.notEqual(result.status, 0);
      assert.ok(!JSON.stringify(result.data).includes('POISONED'));
    }
  });

  it('pages a single finding and manual rules without losing matches', () => {
    const matches = Array.from({ length: 53 }, (_, index) => match({ matchedText: `match-${index}` }));
    save(report({
      findings: [finding({ matches })],
      manualReviewRules: ['known'],
    }));
    let offset = 0;
    const texts = [];
    let manualCount = 0;
    do {
      const page = run('details', ['--offset', String(offset), '--limit', '23']).data;
      assert.equal(page.total, matches.length + 1);
      assert.equal(page.totals.matches, matches.length);
      texts.push(...page.findings.flatMap(finding => finding.matches.map(item => item.matchedText)));
      manualCount += page.manualReviewRules.length;
      offset = page.nextOffset;
    } while (offset !== null);
    assert.deepEqual(texts, matches.map(item => item.matchedText));
    assert.equal(manualCount, 1);
    assert.notEqual(run('details', ['--offset', '99999']).status, 0);
  });

  it('handles zero findings, Markdown-only warnings/header, and Java claims as data', () => {
    save(report({
      findings: [],
      manualReviewRules: [],
      openRewriteApplied: ['claimed.Recipe'],
      openRewriteSkipped: true,
      openRewriteFailed: 'POISONED failure',
    }));
    assert.equal(run().data.totals.matches, 0);
    const claims = run('details').data.claims;
    assert.deepEqual(claims.openRewriteApplied, ['claimed.Recipe']);
    assert.equal(claims.openRewriteSkipped, true);
    assert.equal(claims.openRewriteFailed, 'POISONED failure');
    write('project/.cds-upgrade/report.md', '# Upgrade Report\n\nGenerated: today\n\n## Summary\nsecret summary\n\n## Analysis Warnings\n\n- POISONED warning\n### Context\nwarning detail\n\n## You might want to check\nsecret body\n');
    rmSync(path.join(project, '.cds-upgrade/report.yaml'));
    rmSync(path.join(tool, 'node_modules'), { recursive: true });
    assert.equal(run('header').data.content, '# Upgrade Report\n\nGenerated: today');
    const warnings = run('warnings').data;
    assert.equal(warnings.present, true);
    assert.ok(warnings.content.includes('POISONED warning'));
    assert.ok(!warnings.content.includes('secret summary'));
    assert.equal(warnings.includesFollowingSections, true);
    write('project/.cds-upgrade/report.md', '# Report\n\n## Details\nnone');
    assert.equal(run('warnings').data.present, false);
  });

  it('preserves multiline warnings and ignores headings inside fenced source', () => {
    write('project/.cds-upgrade/report.md', '# Report\n\n## Details\n```text\n## Analysis Warnings\n- fake\n```\n\n## Analysis Warnings\n- first\n## Backend failure\nmore detail\n- second\n## You might want to check\nmore diagnostic data\n- third\n\n## You might want to check\nadvisory\n');
    const result = run('warnings');
    assert.equal(result.status, 0);
    assert.match(result.data.content, /first\n## Backend failure\nmore detail\n- second/);
    assert.doesNotMatch(result.data.content, /fake/);
    assert.match(result.data.content, /more diagnostic data\n- third/);
    assert.equal(result.data.includesFollowingSections, true);
    write('project/.cds-upgrade/report.md', '## Analysis Warnings\n- first\n## Analysis Warnings\n- second\n');
    assert.notEqual(run('warnings').status, 0);
  });

  it('rejects oversized output explicitly and supports smaller complete pages', () => {
    const text = 'x'.repeat(600 * 1024);
    save(report({ findings: [finding({ matches: [match({ matchedText: text }), match({ matchedText: text })] })] }));
    const large = run('details');
    assert.notEqual(large.status, 0);
    assert.match(large.data.error, /response is larger than 1 MiB/);
    for (const offset of [0, 1]) {
      const page = run('details', ['--offset', String(offset), '--limit', '1']);
      assert.equal(page.status, 0);
      assert.equal(page.data.findings[0].matches[0].matchedText, text);
      assert.equal(page.data.nextOffset, offset === 0 ? 1 : null);
    }
  });

  it('rejects an indivisible JSON-expanded detail without truncating it', () => {
    save(report({
      findings: [finding({ matches: [match({ matchedText: `x${'\\'.repeat(530000)}` })] })],
    }));
    const result = run('details', ['--limit', '1']);
    assert.notEqual(result.status, 0);
    assert.match(result.data.error, /One match or rule is too large to return/);
    assert.ok(!Object.hasOwn(result.data, 'findings'));
  });

  it('integrates with actual installed catalogue and import-free IEEE754 module', () => {
    const catalogue = JSON.parse(readFileSync(path.join(TOOL, 'bin/upgrade/migrations/cds10/migrations.json'), 'utf8'));
    const rule = catalogue.entries.find(entry => entry.id === 'ieee754-compatible-default-true');
    assert.ok(rule);
    const advisory = require(path.join(TOOL, 'bin/upgrade/steps/analyze/ieee754.js'));
    write('tool/bin/upgrade/migrations/cds10/migrations.json', JSON.stringify({ entries: [rule] }));
    save(report({
      findings: [finding({ ruleId: rule.id })],
      manualReviewRules: catalogue.entries.map(entry => entry.id),
    }));
    assert.ok(run().data.advisoryWarnings.includes('This cds-dk installation does not include IEEE754 guidance.'));
    const result = run('details', ['--limit', '500'], { selectedTool: TOOL });
    assert.equal(result.status, 0);
    assert.equal(result.data.findings[0].body, rule.body);
    assert.equal(result.data.findings[0].IEEE754_GUIDANCE, advisory.IEEE754_GUIDANCE);
    assert.ok(result.data.manualReviewRules.every(entry => entry.metadataStatus === 'resolved'));
    assert.equal(
      result.data.manualReviewRules.find(entry => entry.ruleId === rule.id).IEEE754_NO_MATCHES,
      advisory.IEEE754_NO_MATCHES,
    );
    save(report({
      findings: [],
      manualReviewRules: [rule.id],
    }));
    const manual = run('details', [], { selectedTool: TOOL });
    assert.equal(manual.status, 0);
    assert.equal(manual.data.manualReviewRules[0].IEEE754_NO_MATCHES, advisory.IEEE754_NO_MATCHES);
  });
});

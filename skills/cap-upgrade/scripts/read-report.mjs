#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  constants,
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_NODES = 1_000_000;
const MAX_DEPTH = 40;
const MAX_STRING = 1024 * 1024;
const MIN_NODE_MAJOR = 22;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const DEFAULT_CONTEXT = 3;
const MAX_CONTEXT = 20;
const IEEE754_ID = 'ieee754-compatible-default-true';
const METADATA = [
  'title', 'scope', 'group', 'groupTitle', 'capireSection', 'guidance', 'body',
  'capireAnchor', 'compilerDetects', 'patternsComplete', 'compatFlag', 'orRecipe',
];
const PATTERNS = ['patternSource', 'patternCdl', 'patternCdsEnv', 'patternOther', 'compilerPattern'];
const COMMAND_OPTIONS = {
  overview: [],
  details: ['offset', 'limit'],
  source: ['finding', 'match', 'hash', 'line', 'context'],
  warnings: [],
  header: [],
};

function ensure(condition, message) {
  if (condition) return;
  const error = new Error(message);
  error.readerError = true;
  throw error;
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function integer(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function nullable(value, predicate) {
  return value === null || predicate(value);
}

function options(args) {
  const values = Object.create(null);
  let command;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      ensure(
        !command && Object.hasOwn(COMMAND_OPTIONS, arg),
        'Choose a command: overview, details, source, warnings or header.',
      );
      command = arg;
      continue;
    }
    const key = arg.slice(2);
    ensure(
      !Object.hasOwn(values, key) && args[index + 1] !== undefined && !args[index + 1].startsWith('--'),
      'Each option needs a value and may be used only once.',
    );
    values[key] = args[++index];
  }
  ensure(command && values.project && values['cds-dk'], 'Specify --project, --cds-dk and a command.');
  ensure(
    Object.keys(values).every(key => ['project', 'cds-dk', ...COMMAND_OPTIONS[command]].includes(key)),
    'This command does not support one of the supplied options.',
  );
  return { command, values };
}

function boundedOption(values, key, fallback, maximum, minimum = 0) {
  if (values[key] === undefined) return fallback;
  ensure(/^\d+$/.test(values[key]), `Invalid value for --${key}.`);
  const value = Number(values[key]);
  ensure(integer(value) && value >= minimum && value <= maximum, `Invalid value for --${key}.`);
  return value;
}

function confined(root, file) {
  ensure(
    typeof file === 'string' && file.length > 0 && !file.includes('\0'),
    'The report contains an invalid file path.',
  );
  const candidate = path.resolve(root, file);
  ensure(path.isAbsolute(file) || inside(root, candidate), 'The file is outside the project directory.');
  const real = realpathSync(candidate);
  ensure(inside(root, real), 'The file path resolves outside the project directory.');
  ensure(statSync(real).isFile(), 'The path does not point to a regular file.');
  return real;
}

function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function readConfined(root, file, isSource = false) {
  const real = confined(root, file);
  const expected = statSync(real);
  if (isSource) {
    const artifacts = ['report.yaml', 'report.md'].map(name => path.join(root, '.cds-upgrade', name));
    ensure(!artifacts.some(artifact => {
      if (!existsSync(artifact)) return false;
      const info = statSync(artifact);
      return info.dev === expected.dev && info.ino === expected.ino;
    }), 'Report files cannot be read as source code.');
  }
  ensure(expected.size <= MAX_BYTES, 'The file is larger than 64 MiB.');
  ensure(confined(root, file) === real, 'The file path changed before it could be opened.');
  const fd = openSync(real, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (process.platform === 'linux') {
      ensure(readlinkSync(`/proc/self/fd/${fd}`) === real, 'The opened file no longer matches the checked path.');
    }
    const actual = fstatSync(fd);
    ensure(
      actual.isFile() && actual.dev === expected.dev && actual.ino === expected.ino && actual.size <= MAX_BYTES,
      'The file changed before it could be opened.',
    );
    const bytes = Buffer.alloc(actual.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (count === 0) break;
      length += count;
    }
    ensure(length === actual.size, 'The file changed while it was being read.');
    return bytes.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function preflight(text, yaml) {
  ensure(
    text.split('\n').every(line => Buffer.byteLength(line) <= MAX_STRING),
    'A line in report.yaml is longer than 1 MiB.',
  );
  let count = 0;
  let depth = 0;
  for (const token of new yaml.Lexer().lex(text)) {
    ensure(++count <= MAX_NODES, 'report.yaml is too complex to read.');
    if (token === '[' || token === '{') depth++;
    if (token === ']' || token === '}') depth--;
    ensure(depth <= MAX_DEPTH, 'report.yaml is nested more than 40 levels deep.');
  }
}

function parseReport(bytes, yaml) {
  const text = bytes.toString('utf8');
  preflight(text, yaml);
  const document = yaml.parseDocument(text, {
    strict: true,
    uniqueKeys: false,
    schema: 'core',
    resolveKnownTags: false,
    prettyErrors: false,
  });
  ensure(document.errors.length === 0 && document.warnings.length === 0, 'report.yaml is not valid YAML.');
  const pending = [[document.contents, 0]];
  let count = 0;
  while (pending.length) {
    const [node, depth] = pending.pop();
    ensure(
      ++count <= MAX_NODES && depth <= MAX_DEPTH,
      'report.yaml is nested too deeply or contains too many entries.',
    );
    ensure(!yaml.isAlias(node), 'YAML aliases are not supported.');
    ensure(
      !node?.tag || /^tag:yaml.org,2002:(?:map|seq|str|int|float|bool|null)$/.test(node.tag),
      'Custom YAML tags are not supported.',
    );
    if (yaml.isMap(node)) {
      const keys = new Set();
      node.items.forEach(pair => {
        ensure(yaml.isScalar(pair.key) && typeof pair.key.value === 'string', 'YAML keys must be text.');
        ensure(!keys.has(pair.key.value), 'report.yaml contains a duplicate key.');
        keys.add(pair.key.value);
        pending.push([pair.key, depth + 1], [pair.value, depth + 1]);
      });
    } else if (yaml.isSeq(node)) {
      node.items.forEach(item => pending.push([item, depth + 1]));
    } else {
      const value = node?.value ?? null;
      ensure(
        value === null || ['string', 'boolean', 'number'].includes(typeof value),
        'report.yaml contains an unsupported value.',
      );
      ensure(
        typeof value !== 'string' || Buffer.byteLength(value) <= MAX_STRING,
        'A text value in report.yaml is longer than 1 MiB.',
      );
      ensure(typeof value !== 'number' || Number.isFinite(value), 'report.yaml contains an invalid number.');
    }
  }
  const report = document.toJS({
    maxAliasCount: 0,
  });
  validateReport(report);
  return report;
}

function validateReport(report) {
  ensure(object(report) && ['1.0', '2.0'].includes(report.version), 'Only report versions 1.0 and 2.0 are supported.');
  ensure(
    object(report.project) && typeof report.project.root === 'string' && strings(report.project.languages),
    'The report must contain a project path and a list of languages.',
  );
  ensure(
    integer(report.rulesScanned) && typeof report.compilerRan === 'boolean',
    'The report must contain a rule count and a compiler-run status.',
  );
  ensure(
    Array.isArray(report.findings) && Array.isArray(report.manualReviewRules),
    'The report must contain findings and manualReviewRules lists.',
  );
  report.findings.forEach(finding => {
    ensure(
      object(finding) && typeof finding.ruleId === 'string' && finding.ruleId.length > 0,
      'Each finding must have a non-empty ruleId.',
    );
    ensure(
      ['complete', 'incomplete', 'unknown'].includes(finding.coverage) && Array.isArray(finding.matches),
      'Each finding must have a valid coverage value and a matches list.',
    );
    finding.matches.forEach(validateMatch);
  });
  report.manualReviewRules.forEach(rule => {
    const id = report.version === '1.0' && object(rule) ? rule.ruleId : rule;
    ensure(
      typeof id === 'string' && id.length > 0 && (report.version !== '1.0' || object(rule)),
      'The report contains an invalid manual-review rule.',
    );
  });
  ensure(
    report.openRewriteApplied === undefined || strings(report.openRewriteApplied),
    'openRewriteApplied must be a list of recipe names.',
  );
  ensure(
    report.openRewriteSkipped === undefined || typeof report.openRewriteSkipped === 'boolean',
    'openRewriteSkipped must be true or false.',
  );
  ensure(
    report.openRewriteFailed === undefined || typeof report.openRewriteFailed === 'string',
    'openRewriteFailed must be text.',
  );
}

function validateMatch(match) {
  ensure(
    object(match) && nullable(match.file, value => typeof value === 'string'),
    'A match file must be a path or null.',
  );
  ensure(match.position === null || object(match.position), 'A match position must be an object or null.');
  if (match.position !== null) {
    ensure(
      nullable(match.position.row, value => integer(value) && value > 0) && nullable(match.position.col, integer),
      'A match has invalid line or column numbers.',
    );
  }
  ensure(nullable(match.matchedText, value => typeof value === 'string'), 'matchedText must be text or null.');
  ensure(nullable(match.source, value => typeof value === 'string'), 'A match source must be text or null.');
  ensure(
    nullable(match.valueStatus, value => ['default', 'killswitch'].includes(value)),
    'valueStatus must be default, killswitch or null.',
  );
}

function location(root, file) {
  if (file === null) return 'unavailable';
  if (file === '<cds env>') return 'virtual';
  ensure(!file.startsWith('<'), 'The report contains an unknown virtual file path.');
  try {
    confined(root, file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    missingLocation(root, file);
    return 'missing';
  }
  return 'file';
}

function missingLocation(root, file) {
  let candidate = path.resolve(root, file);
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    let ancestor = candidate;
    for (;;) {
      let info;
      try {
        info = lstatSync(ancestor);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        ancestor = path.dirname(ancestor);
        continue;
      }
      if (info.isSymbolicLink()) {
        candidate = path.resolve(path.dirname(ancestor), readlinkSync(ancestor), path.relative(ancestor, candidate));
        break;
      }
      ensure(inside(root, realpathSync(ancestor)), 'Missing location outside allowed project');
      return;
    }
  }
  ensure(false, 'The file path contains too many symbolic links.');
}

function catalogue(tool, ids) {
  const require = createRequire(path.join(tool, 'package.json'));
  const data = JSON.parse(readFileSync(path.join(tool, 'bin/upgrade/migrations/cds10/migrations.json'), 'utf8'));
  ensure(Array.isArray(data.entries), 'The cds-dk migration catalogue must contain an entries list.');
  const rules = new Map();
  data.entries.forEach(entry => {
    ensure(
      object(entry) && typeof entry.id === 'string' && !rules.has(entry.id),
      'The cds-dk migration catalogue contains an invalid or duplicate rule ID.',
    );
    rules.set(entry.id, entry);
  });
  const advisoryWarnings = [];
  let advisory;
  if (ids.includes(IEEE754_ID)) {
    const module = path.join(tool, 'bin/upgrade/steps/analyze/ieee754.js');
    try {
      statSync(module);
      advisory = require(module);
      ensure(
        typeof advisory.IEEE754_GUIDANCE === 'string' && typeof advisory.IEEE754_NO_MATCHES === 'string',
        'The cds-dk IEEE754 guidance is missing or invalid.',
      );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      advisoryWarnings.push('This cds-dk installation does not include IEEE754 guidance.');
    }
  }
  return {
    rules,
    advisory,
    advisoryWarnings,
  };
}

function metadata(id, catalog) {
  const entry = catalog.rules.get(id);
  const result = {
    ruleId: id,
    metadataStatus: 'unresolved',
    missingMetadata: [],
  };
  if (!entry) {
    result.missingMetadata.push('ruleId');
    return result;
  }
  METADATA.forEach(key => { result[key] = entry[key] ?? null; });
  result.patterns = Object.fromEntries(PATTERNS.map(key => [key, entry[key] ?? null]));
  if (typeof entry.title !== 'string' || !entry.title) result.missingMetadata.push('title');
  if (typeof entry.body !== 'string' || !entry.body) result.missingMetadata.push('body');
  if (!strings(entry.scope) || entry.scope.length === 0) result.missingMetadata.push('scope');
  if (typeof entry.compilerDetects !== 'boolean') result.missingMetadata.push('compilerDetects');
  if (typeof entry.patternsComplete !== 'boolean') result.missingMetadata.push('patternsComplete');
  result.metadataStatus = result.missingMetadata.length ? 'unresolved' : 'resolved';
  if (id === IEEE754_ID && catalog.advisory) {
    result.IEEE754_GUIDANCE = catalog.advisory.IEEE754_GUIDANCE;
    result.IEEE754_NO_MATCHES = catalog.advisory.IEEE754_NO_MATCHES;
  }
  return result;
}

function totals(report) {
  return {
    findings: report.findings.length,
    matches: report.findings.reduce((count, finding) => count + finding.matches.length, 0),
    manualReviewRules: report.manualReviewRules.length,
  };
}

function summary(record, index, matchCount = 0) {
  return {
    index,
    ruleId: record.ruleId,
    metadataStatus: record.metadataStatus,
    missingMetadata: record.missingMetadata,
    title: record.title ?? null,
    scope: record.scope ?? null,
    group: record.group ?? null,
    groupTitle: record.groupTitle ?? null,
    capireSection: record.capireSection ?? null,
    matchCount,
  };
}

function details(report, catalog, values, locations) {
  const total = report.findings.reduce((count, finding) => count + Math.max(1, finding.matches.length), 0) + report.manualReviewRules.length;
  const offset = boundedOption(values, 'offset', 0, total);
  const limit = boundedOption(values, 'limit', DEFAULT_LIMIT, MAX_LIMIT, 1);
  const end = Math.min(total, offset + limit);
  const findings = [];
  const manualReviewRules = [];
  let cursor = 0;
  report.findings.forEach((finding, index) => {
    const length = Math.max(1, finding.matches.length);
    if (cursor < end && cursor + length > offset) {
      const start = Math.max(0, offset - cursor);
      const stop = Math.min(finding.matches.length, end - cursor);
      findings.push({
        ...metadata(finding.ruleId, catalog),
        index,
        coverage: finding.coverage,
        matchTotal: finding.matches.length,
        matchOffset: start,
        matches: finding.matches.slice(start, stop).map((match, local) => ({
          index: start + local,
          file: match.file,
          locationStatus: locations.get(match.file),
          position: match.position === null ? null : {
            row: match.position.row,
            col: match.position.col,
          },
          matchedText: match.matchedText,
          source: match.source,
          valueStatus: match.valueStatus,
        })),
      });
    }
    cursor += length;
  });
  report.manualReviewRules.forEach((rule, index) => {
    if (cursor >= offset && cursor < end) manualReviewRules.push({
      ...metadata(report.version === '1.0' ? rule.ruleId : rule, catalog),
      index,
    });
    cursor++;
  });
  return {
    claims: {
      project: {
        root: report.project.root,
        languages: report.project.languages,
      },
      rulesScanned: report.rulesScanned,
      compilerRan: report.compilerRan,
      openRewriteApplied: report.openRewriteApplied ?? null,
      openRewriteSkipped: report.openRewriteSkipped ?? null,
      openRewriteFailed: report.openRewriteFailed ?? null,
    },
    offset,
    limit,
    total,
    nextOffset: end < total ? end : null,
    findings,
    manualReviewRules,
  };
}

function source(root, report, reportHash, values) {
  ensure(values.hash === reportHash, 'The report hash does not match or is missing. Run overview again.');
  const findingIndex = boundedOption(values, 'finding', undefined, report.findings.length - 1);
  ensure(findingIndex !== undefined, 'Specify --finding.');
  const finding = report.findings[findingIndex];
  const matchIndex = boundedOption(values, 'match', undefined, finding.matches.length - 1);
  ensure(matchIndex !== undefined, 'Specify --match.');
  const match = finding.matches[matchIndex];
  const line = boundedOption(values, 'line', match.position?.row ?? 1, Number.MAX_SAFE_INTEGER, 1);
  const context = boundedOption(values, 'context', DEFAULT_CONTEXT, MAX_CONTEXT);
  const locationStatus = location(root, match.file);
  ensure(
    hash(readConfined(root, '.cds-upgrade/report.yaml')) === reportHash,
    'The report changed before the source file could be read. Run overview again.',
  );
  if (locationStatus !== 'file') return {
    locationStatus,
    lines: [],
  };
  const lines = readConfined(root, match.file, true).toString('utf8').split('\n');
  ensure(line <= lines.length, 'The requested line is outside the source file.');
  const start = Math.max(0, line - context - 1);
  const end = Math.min(lines.length, line + context);
  const selected = lines.slice(start, end).map((text, index) => ({
    row: start + index + 1,
    text,
  }));
  ensure(
    Buffer.byteLength(JSON.stringify(selected)) <= MAX_STRING,
    'The source excerpt is larger than 1 MiB. Request fewer context lines.',
  );
  return {
    locationStatus,
    file: match.file,
    line,
    totalLines: lines.length,
    startLine: start + 1,
    endLine: end,
    lines: selected,
  };
}

function markdown(root, command) {
  const bytes = readConfined(root, '.cds-upgrade/report.md');
  const lines = bytes.toString('utf8').split('\n');
  let fence;
  const headings = lines.map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && !fence) {
      fence = marker;
      return '';
    }
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) fence = undefined;
      return '';
    }
    return line;
  });
  const warningHeadings = headings.flatMap((line, index) => /^##\s+Analysis Warnings\s*$/.test(line) ? [index] : []);
  ensure(warningHeadings.length <= 1, 'report.md contains more than one Analysis Warnings section.');
  const heading = warningHeadings[0] ?? -1;
  const start = command === 'warnings' ? heading : 0;
  const next = command === 'warnings' ? -1 : headings.findIndex((line, index) => index > start && /^#{1,2}\s/.test(line));
  const content = start < 0 ? '' : lines.slice(start, next < 0 ? lines.length : next).join('\n').trim();
  ensure(Buffer.byteLength(content) <= MAX_STRING, 'The requested report section is larger than 1 MiB.');
  return {
    markdownHash: hash(bytes),
    present: content.length > 0,
    includesFollowingSections: command === 'warnings' && start >= 0,
    content,
  };
}

function main() {
  ensure(Number(process.versions.node.split('.')[0]) >= MIN_NODE_MAJOR, 'Node.js 22 or later is required.');
  const { command, values } = options(process.argv.slice(2));
  const root = realpathSync(values.project);
  const tool = realpathSync(values['cds-dk']);
  ensure(
    statSync(root).isDirectory() && statSync(tool).isDirectory(),
    '--project and --cds-dk must point to directories.',
  );
  if (command === 'warnings' || command === 'header') return markdown(root, command);
  const require = createRequire(path.join(tool, 'package.json'));
  const bytes = readConfined(root, '.cds-upgrade/report.yaml');
  const reportHash = hash(bytes);
  const report = parseReport(bytes, require('yaml'));
  const locations = new Map();
  if (command !== 'source') report.findings.forEach(finding => finding.matches.forEach(match => {
    if (!locations.has(match.file)) locations.set(match.file, location(root, match.file));
  }));
  const ids = [...new Set([
    ...report.findings.map(finding => finding.ruleId),
    ...report.manualReviewRules.map(rule => report.version === '1.0' ? rule.ruleId : rule),
  ])];
  const catalog = catalogue(tool, ids);
  const common = {
    version: report.version,
    reportHash,
    totals: totals(report),
    unknownRuleIds: ids.filter(id => !catalog.rules.has(id)),
    advisoryWarnings: catalog.advisoryWarnings,
  };
  if (command === 'source') return {
    ...common,
    ...source(root, report, reportHash, values),
  };
  if (command === 'details') {
    const result = {
      ...common,
      ...details(report, catalog, values, locations),
    };
    if (result.limit === 1) {
      ensure(
        Buffer.byteLength(JSON.stringify(result)) + 1 <= MAX_STRING,
        'One match or rule is too large to return (over 1 MiB). Leave it unresolved and check the current source.',
      );
    }
    return result;
  }
  return {
    ...common,
    claims: {
      project: {
        root: report.project.root,
        languages: report.project.languages,
      },
      rulesScanned: report.rulesScanned,
      compilerRan: report.compilerRan,
    },
    findings: report.findings.map((finding, index) => ({
      ...summary(metadata(finding.ruleId, catalog), index, finding.matches.length),
      coverage: finding.coverage,
    })),
    manualReviewRules: report.manualReviewRules.map((rule, index) => summary(metadata(report.version === '1.0' ? rule.ruleId : rule, catalog), index)),
  };
}

try {
  const output = JSON.stringify(main());
  ensure(
    Buffer.byteLength(output) + 1 <= MAX_STRING,
    'The response is larger than 1 MiB. Request fewer detail records or less source context.',
  );
  process.stdout.write(`${output}\n`);
} catch (error) {
  const message = error.readerError ? error.message : 'Could not read the report, source file or cds-dk installation.';
  process.stdout.write(`${JSON.stringify({ error: message })}\n`);
  process.exitCode = 1;
}

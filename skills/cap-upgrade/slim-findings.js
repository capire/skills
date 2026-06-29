#!/usr/bin/env node
// Extract a compact representation of findings.json for context-constrained agents.
// Usage: node slim-findings.js [path/to/findings.json]
// Defaults to ./findings.json in the current directory.

'use strict';

const path = require('path');
const fs = require('fs');

const filePath = process.argv[2] || path.join(process.cwd(), 'findings.json');

let raw;
try {
  raw = fs.readFileSync(filePath, 'utf8');
} catch (err) {
  console.error(`Cannot read ${filePath}: ${err.message}`);
  process.exit(1);
}

let f;
try {
  f = JSON.parse(raw);
} catch (err) {
  console.error(`Invalid JSON in ${filePath}: ${err.message}`);
  process.exit(1);
}

const slim = {
  rulesScanned: f.rulesScanned,
  compilerRan: f.compilerRan,
  dryRun: f.dryRun,
  findings: (f.findings || []).map(r => ({
    ruleId: r.ruleId,
    title: r.title,
    severity: r.severity,
    scope: r.scope,
    group: r.group || null,
    coverage: r.coverage,
    compatFlag: r.compatFlag || null,
    compilerDetects: r.compilerDetects,
    patternsComplete: r.patternsComplete,
    orRecipe: r.orRecipe || null,
    guidance: r.guidance,
    matchCount: r.matches ? r.matches.length : 0,
    matches: (r.matches || []).map(m => ({
      file: m.file,
      position: m.position,
      matchedText: m.matchedText
    }))
  })),
  manualReviewRules: f.manualReviewRules || []
};

console.log(JSON.stringify(slim, null, 2));

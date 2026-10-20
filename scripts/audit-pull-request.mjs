#!/usr/bin/env node
import { auditPullRequest, parsePullRequestUrl } from './lib/github-audit.mjs';

const args = process.argv.slice(2);
const usage = 'Usage: node scripts/audit-pull-request.mjs https://github.com/OWNER/REPO/pull/NUMBER';
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log(`${usage}\n\nReads public GitHub REST data. Optional GITHUB_TOKEN or GH_TOKEN enables GraphQL author resolution.\nNo repository writes, credential storage, or achievement award requests.`);
} else if (args.length !== 1) {
  console.error(usage);
  process.exitCode = 2;
} else {
  try { parsePullRequestUrl(args[0]); } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
  if (!process.exitCode) {
    try {
      const report = await auditPullRequest(args[0], { token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN });
      console.log(JSON.stringify(report, null, 2));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

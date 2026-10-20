#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

function git(args, input) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    input,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Git command failed');
  }
  return result.stdout;
}

const args = process.argv.slice(2);
const ref = args[0] ?? 'HEAD';
if (args.length > 1 || !ref.trim() || ref.startsWith('-') || ref.includes('\0')) {
  console.error('Usage: node inspect-commit.mjs [commit-ref]');
  process.exitCode = 2;
} else {
  try {
    const sha = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
    const [name, email, committerName, committerEmail] = git([
      'show', '-s', '--format=%an%x00%ae%x00%cn%x00%ce', sha,
    ]).trimEnd().split('\0');
    const message = git(['show', '-s', '--format=%B', sha]);
    const trailers = git(['interpret-trailers', '--parse'], message);
    const coauthors = [];
    for (const line of trailers.split(/\r?\n/)) {
      const match = /^Co-authored-by:\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/i.exec(line);
      if (match) coauthors.push({ name: match[1], email: match[2] });
    }
    console.log(JSON.stringify({
      sha,
      author: { name, email },
      committer: { name: committerName, email: committerEmail },
      coauthors,
    }, null, 2));
  } catch (error) {
    console.error(`Cannot inspect commit: ${error.message}`);
    process.exitCode = 1;
  }
}

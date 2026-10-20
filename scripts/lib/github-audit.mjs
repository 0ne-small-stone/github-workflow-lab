import { spawnSync } from 'node:child_process';

const API = 'https://api.github.com';

export function parsePullRequestUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Provide a GitHub pull request HTTPS URL.'); }
  const match = /^\/([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9_.-]+)\/pull\/([1-9]\d*)\/?$/.exec(url.pathname);
  if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash || !match || ['.', '..'].includes(match[2])) {
    throw new Error('Expected https://github.com/OWNER/REPO/pull/NUMBER without query parameters.');
  }
  const number = Number(match[3]);
  if (!Number.isSafeInteger(number)) throw new Error('Pull request number is too large.');
  return { owner: match[1], repository: match[2], number };
}

function coauthorTrailers(message) {
  const parsed = spawnSync('git', ['interpret-trailers', '--parse'], {
    input: message, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024,
  });
  if (parsed.error || parsed.status !== 0) throw new Error('Git is required to parse commit trailers.');
  return parsed.stdout.split(/\r?\n/).flatMap(line => {
    const match = /^Co-authored-by:\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/i.exec(line);
    return match ? [{ name: match[1], email: match[2] }] : [];
  });
}

export async function auditPullRequest(input, { token, fetchImpl = globalThis.fetch } = {}) {
  const { owner, repository, number } = parsePullRequestUrl(input);
  const prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'github-workflow-lab-auditor',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  async function request(path, body) {
    let response;
    try {
      response = await fetchImpl(`${API}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      });
    } catch { throw new Error('GitHub request failed or timed out; check connectivity.'); }
    if (!response.ok) {
      throw new Error(`GitHub API returned HTTP ${response.status}; check access and API rate limits.`);
    }
    let data;
    try { data = await response.json(); } catch { throw new Error('GitHub returned invalid JSON.'); }
    return { data, hasNext: /rel="next"/.test(response.headers.get('link') ?? '') };
  }

  async function list(path, maxPages) {
    const items = [];
    for (let page = 1; page <= maxPages; page++) {
      const result = await request(`${path}?per_page=100&page=${page}`);
      if (!Array.isArray(result.data)) throw new Error('Unexpected GitHub list response.');
      items.push(...result.data);
      if (!result.hasNext) return { items, complete: true };
    }
    return { items, complete: false };
  }

  const repo = (await request(prefix)).data;
  if (repo.private !== false) throw new Error('This tool supports public repositories only.');
  const pull = (await request(`${prefix}/pulls/${number}`)).data;
  const [commits, reviews] = await Promise.all([
    list(`${prefix}/pulls/${number}/commits`, 3),
    list(`${prefix}/pulls/${number}/reviews`, 10),
  ]);
  const warnings = [];
  const report = {
    checkedAt: new Date().toISOString(),
    repository: { name: repo.full_name, public: !repo.private, fork: repo.fork, defaultBranch: repo.default_branch },
    pullRequest: {
      url: pull.html_url, number: pull.number, author: pull.user?.login,
      merged: pull.merged, mergedBy: pull.merged_by?.login ?? null,
      createdAt: pull.created_at, mergedAt: pull.merged_at,
      baseBranch: pull.base.ref, mergeCommit: pull.merge_commit_sha,
    },
    commits: commits.items.map(commit => ({
      sha: commit.sha, author: commit.author?.login ?? null,
      coauthors: coauthorTrailers(commit.commit.message),
      githubRecognizedAuthors: null,
    })),
    reviews: reviews.items.map(review => ({
      reviewer: review.user?.login ?? null, state: review.state, submittedAt: review.submitted_at,
      submittedBeforeMerge: pull.merged_at && Number.isFinite(Date.parse(review.submitted_at)) && Date.parse(review.submitted_at) !== Date.parse(pull.merged_at)
        ? Date.parse(review.submitted_at) < Date.parse(pull.merged_at) : null,
    })),
    completeness: {
      commits: commits.complete && commits.items.length === pull.commits,
      reviews: reviews.complete,
      authorResolution: 'not_requested',
    },
    warnings,
    note: 'This reports observable contribution evidence, not achievement eligibility or award status.',
  };
  if (!report.completeness.commits) warnings.push('Commit evidence is incomplete; GitHub REST limits PR commit lists to 250.');
  if (!reviews.complete) warnings.push('Review evidence exceeds this tool’s 1,000-review limit.');

  if (token) {
    const query = `query($owner:String!,$name:String!,$number:Int!,$after:String) {
      repository(owner:$owner,name:$name) {
        pullRequest(number:$number) {
          commits(first:100,after:$after) {
            pageInfo { hasNextPage endCursor }
            nodes { commit { oid authors(first:100) { pageInfo { hasNextPage } nodes { name email user { login } } } } }
          }
        }
      }
    }`;
    const bySha = new Map();
    let after = null;
    let finished = false;
    let authorsComplete = true;
    try {
      for (let page = 0; page < 3; page++) {
        const result = (await request('/graphql', { query, variables: { owner, name: repository, number, after } })).data;
        const connection = result.data?.repository?.pullRequest?.commits;
        if (result.errors?.length || !connection) throw new Error('GraphQL author resolution unavailable.');
        for (const { commit } of connection.nodes) {
          bySha.set(commit.oid, commit.authors.nodes.map(author => ({
            name: author.name, email: author.email, login: author.user?.login ?? null,
          })));
          if (commit.authors.pageInfo.hasNextPage) authorsComplete = false;
        }
        if (!connection.pageInfo.hasNextPage) { finished = true; break; }
        if (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after) throw new Error('Invalid pagination cursor.');
        after = connection.pageInfo.endCursor;
      }
      for (const commit of report.commits) commit.githubRecognizedAuthors = bySha.get(commit.sha) ?? null;
      report.completeness.authorResolution = finished && authorsComplete && report.commits.every(commit => commit.githubRecognizedAuthors !== null) ? 'complete' : 'partial';
    } catch {
      report.completeness.authorResolution = 'unavailable';
      warnings.push('Account-linked author resolution failed; REST evidence is retained. Check token access.');
    }
  }
  return report;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { auditPullRequest, parsePullRequestUrl } from '../scripts/lib/github-audit.mjs';

const url = 'https://github.com/example/project/pull/1';
const reply = (data, options) => new Response(JSON.stringify(data), options);
const repo = { full_name: 'example/project', private: false, fork: false, default_branch: 'main' };
const pr = { html_url: url, number: 1, user: { login: 'owner' }, merged: true, merged_by: { login: 'owner' }, created_at: '2026-10-20T00:00:00Z', merged_at: '2026-10-20T00:00:05Z', base: { ref: 'main' }, merge_commit_sha: 'b'.repeat(40), commits: 1 };
const commit = { sha: 'a'.repeat(40), author: { login: 'owner' }, commit: { message: 'Implement useful change\n\nCo-authored-by: Example <ai@example.com>\n' } };

function mockApi({ privateRepo = false, graphqlFailure = false, paginate = false, reviewTimestamp = '2026-10-20T00:00:06Z' } = {}) {
  const requests = [];
  return {
    requests,
    fetchImpl: async (address, options) => {
      requests.push({ address, options });
      const target = new URL(address);
      assert.equal(target.origin, 'https://api.github.com');
      assert.equal(options.redirect, 'error');
      if (target.pathname === '/graphql') return reply(graphqlFailure ? { errors: [{ message: 'unavailable' }] } : {
        data: { repository: { pullRequest: { commits: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ commit: { oid: commit.sha, authors: { pageInfo: { hasNextPage: false }, nodes: [{ name: 'Example', email: 'ai@example.com', user: { login: 'example-ai' } }] } } }] } } } },
      });
      assert.equal(options.method, 'GET');
      if (target.pathname.endsWith('/commits')) return reply([commit]);
      if (target.pathname.endsWith('/reviews')) {
        if (paginate && target.searchParams.get('page') === '1') return reply([], { headers: { link: '<https://untrusted.invalid/reviews?page=2>; rel="next"' } });
        return reply([{ user: { login: 'bot' }, state: 'COMMENTED', submitted_at: reviewTimestamp }]);
      }
      if (target.pathname.endsWith('/pulls/1')) return reply(pr);
      return reply({ ...repo, private: privateRepo });
    },
  };
}

test('rejects external origins, credentials, option input and ambiguous URLs before fetching', () => {
  for (const input of ['http://github.com/a/b/pull/1', 'https://github.com.evil/a/b/pull/1', 'https://user:pass@github.com/a/b/pull/1', 'https://github.com/a/b/pull/1?token=secret', '--all']) assert.throws(() => parsePullRequestUrl(input));
});

test('anonymous read reports trailers and distinguishes reviews submitted after merge', async () => {
  const api = mockApi();
  const result = await auditPullRequest(url, api);
  assert.equal(result.commits[0].coauthors[0].email, 'ai@example.com');
  assert.equal(result.reviews[0].submittedBeforeMerge, false);
  assert.equal(result.completeness.authorResolution, 'not_requested');
  assert.equal(result.completeness.commits, true);
  assert.ok(api.requests.every(call => !call.options.headers.Authorization));
});

test('resolves GitHub authors with optional authentication without exposing the token', async () => {
  const api = mockApi();
  const result = await auditPullRequest(url, { ...api, token: 'test-token-never-print' });
  assert.equal(result.commits[0].githubRecognizedAuthors[0].login, 'example-ai');
  assert.equal(result.completeness.authorResolution, 'complete');
  assert.ok(!JSON.stringify(result).includes('test-token-never-print'));
  assert.ok(api.requests.find(call => call.options.method === 'POST').options.body.includes('query('));
});

test('refuses private repositories before reading their PR content', async () => {
  const api = mockApi({ privateRepo: true });
  await assert.rejects(auditPullRequest(url, api), /public repositories only/);
  assert.equal(api.requests.length, 1);
});

test('pagination stays on the fixed API origin even when a Link URL points elsewhere', async () => {
  const api = mockApi({ paginate: true });
  const result = await auditPullRequest(url, api);
  assert.equal(result.reviews.length, 1);
  assert.ok(api.requests.some(call => call.address.endsWith('/reviews?per_page=100&page=2')));
});

test('keeps REST evidence when GraphQL is unavailable', async () => {
  const result = await auditPullRequest(url, { ...mockApi({ graphqlFailure: true }), token: 'test-token' });
  assert.equal(result.pullRequest.merged, true);
  assert.equal(result.completeness.authorResolution, 'unavailable');
  assert.equal(result.warnings.length, 1);
});

test('network errors cannot leak authorization tokens', async () => {
  await assert.rejects(auditPullRequest(url, { token: 'secret-token', fetchImpl: async () => { throw new Error('secret-token'); } }), error => !error.message.includes('secret-token'));
});

test('same-second and missing review timestamps do not claim a known event order', async () => {
  for (const reviewTimestamp of ['2026-10-20T00:00:05Z', null]) {
    const result = await auditPullRequest(url, mockApi({ reviewTimestamp }));
    assert.equal(result.reviews[0].submittedBeforeMerge, null);
  }
});

# GitHub workflow lab

An isolated repository for practicing GitHub pull requests and checking commit
attribution. It has no connection to other projects, deployments, or services.

This lab records real changes and AI assistance transparently. GitHub decides
whether and when any profile achievements are awarded.

## Audit a public GitHub pull request

GitHub Workflow Audit is a working GitHub API integration for inspecting public
contribution evidence. It reports PR merge metadata, commits, co-author trailers,
and the timing of submitted reviews. It does not request or promise achievements.

Requirements: Node.js 18+ and Git. No package installation or hosted service.

```sh
node scripts/audit-pull-request.mjs https://github.com/0ne-small-stone/github-workflow-lab/pull/1
```

The default mode uses public REST endpoints without credentials. Optional
`GITHUB_TOKEN` or `GH_TOKEN` enables GraphQL resolution of commit authors to
GitHub accounts. Supply credentials through your own environment; do not commit
them. The tool never reads your system credential store, prints tokens, sends
telemetry, follows redirects, or changes repositories. Reports may contain
public commit emails; review a report before sharing it.

Incomplete commit/review lists and unavailable account resolution are reported
explicitly. A review created after a merge is distinguished from one submitted
before it. GitHub's private achievement rules are outside the scope of this tool.
Same-second or missing timestamps report an unknown order rather than inferring
which action happened first.

Run the integration and credential-boundary tests:

```sh
node --test tests/github-audit.test.mjs
```

Support: open a repository issue. The [Developer Program application draft](docs/developer-program-application.md)
documents the integration and remains explicitly unsubmitted until registration
is confirmed.

## Inspect a commit

Requirements: Git and Node.js 18 or newer. No package installation is needed.

```sh
node scripts/inspect-commit.mjs HEAD
```

Run the script from the Git repository you want to inspect, or pass the script's
absolute path from another repository. It prints JSON containing the resolved
commit SHA, author, committer, and co-author trailers. Omit the ref to use HEAD.
It only reads local Git data and makes no network requests or repository changes.

Trailer parsing uses Git itself, so a `Co-authored-by:` example in the body is not
mistaken for a trailer. Invalid refs fail with exit code 1; invalid invocation
fails with exit code 2. A trailer records attribution, not proof that GitHub has
associated the email with an account or awarded a profile achievement.

## Attribution

The implementation was produced with OpenAI Codex at the repository owner's
request. Its commit retains the corresponding Codex co-author trailer. This is
AI assistance disclosure, not a claim that a second human contributed.

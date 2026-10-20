# GitHub workflow lab

An isolated repository for practicing GitHub pull requests and checking commit
attribution. It has no connection to other projects, deployments, or services.

This lab records real changes and AI assistance transparently. GitHub decides
whether and when any profile achievements are awarded.

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

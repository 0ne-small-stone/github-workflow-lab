# Developer Program application draft

Status: prepared, not submitted. No membership or badge has been awarded.

## Applicant

- Name: Zhang Xuanshi
- GitHub account: https://github.com/0ne-small-stone
- Developer type: individual / student
- Support email: to be supplied by the owner; do not publish a private email.

## Integration

- Name: GitHub Workflow Audit
- Project URL: https://github.com/0ne-small-stone/github-workflow-lab
- Stage: working prototype / in development
- Interface: local command-line tool, Node.js 18+ and Git
- Hosting: none required; runs on the user's own computer

## Short description

GitHub Workflow Audit is a read-only command-line integration that inspects a
public pull request using GitHub's REST API and optionally the GraphQL API. It
reports merge metadata, commit attribution, account-linked authors, and whether
submitted reviews predate the merge. It distinguishes observed contribution
evidence from GitHub's private achievement eligibility and award decisions.

## APIs and permissions

- REST GET repository metadata, PR metadata, PR commits, and PR reviews.
- Optional GraphQL read queries resolve commit authors to GitHub accounts.
- Public REST mode requires no token. Authenticated mode reads a token from
  GITHUB_TOKEN or GH_TOKEN; it never prints or stores the token.
- Public repositories only; no repository mutations, webhooks, account changes,
  OAuth registrations, telemetry, or persistent server are required.
- GitHub API requests use a fixed HTTPS API origin and reject redirects.
- Pagination limits and incomplete evidence are explicitly reported.

## Intended users and support

Developers auditing their public contribution records and AI-assisted commit
attribution. Technical issue reports can use the repository's Issues tab.
The applicant's support email must be confirmed before registration.

## Official requirements

GitHub's Developer Program accepts an integration in production or development
using the GitHub API and requires a support contact email:
https://docs.github.com/en/integrations/concepts/github-developer-program

Registration: https://github.com/developer/register

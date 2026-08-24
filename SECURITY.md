# Security Policy

## Reporting a vulnerability

Do not report suspected vulnerabilities in a public issue. Use the repository's private security advisory flow, or contact an organization owner through an already approved private channel.

Include the affected route or component, reproduction steps, expected impact, and a minimal proof of concept. Remove API keys, access tokens, personal data, and private channel data from all reports and screenshots.

## Supported configuration

The current supported configuration is local-first:

- The server binds to `127.0.0.1` by default.
- YouTube and Gemini keys remain in the server environment.
- The local Settings endpoint accepts same-origin loopback requests only.
- Billable routes use an in-memory per-process rate limiter.

This is not a hardened multi-user internet service. Before remote deployment, add authenticated access, a trusted secret-management path, a shared rate limiter, request observability that excludes secrets and content bodies, and a deployment-specific threat review.

## Credential response

If a credential is accidentally committed, revoke or rotate it immediately. Removing it from the latest commit is not sufficient because Git history and clones may retain the value.

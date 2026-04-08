# Issue: Security hardening follow-ups (SPA tokens, headers, config hygiene)

**ID:** ISS-001
**Discovered:** 2026-04-07 (during security audit)
**Reported by:** security-auditor
**Severity:** Medium (aggregated)
**Security Impact:** Variable (see parent audit chat)
**Status:** Open

## Description

Follow-up items from security audit: OAuth access token storage in `localStorage`, missing CSP/SRI on third-party script, committed real `googleClientId` in `app/applicationconfig.yml`, and `innerHTML` templates using unescaped `t()` outputs.

## Impact

- Exploit difficulty: Varies by item (XSS + localStorage is the highest-consequence pair).
- Data at risk: Google OAuth access token, API quota / client misuse.

## Proposed Solution

1. Prefer short-lived tokens and mitigate XSS (CSP, sanitize/escape all dynamic HTML).
2. Consider moving `googleClientId` to env/build-time injection or a local-only override; keep repo default as placeholder.
3. Add `integrity` (SRI) for `https://accounts.google.com/gsi/client` where compatible; add baseline CSP for deployed hosting.

## Priority

P2 (address before production hardening)

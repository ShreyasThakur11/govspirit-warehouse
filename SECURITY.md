# Security policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |
| 1.x     | No        |

## Reporting a vulnerability

Use GitHub's private reporting: **Security → Report a vulnerability** on
[the repository](https://github.com/ShreyasThakur11/govspirit-warehouse/security).

Please do not open a public issue for a security problem.

Include what an attacker can do, the steps to reproduce, and the browser you
saw it in. A reproduction against the seeded demo dataset is ideal, because it
is identical on every machine.

Expect an acknowledgement within seven days and an assessment within fourteen.

## The threat model

This is a static page with no backend, no accounts and no stored credentials.
The interesting attack surface is not the server, because there is not one.

**What is actually at risk:** the operator's own browser session, and the
integrity of the figures they are about to act on.

### Handled

**Cross-site scripting from file contents.** Spreadsheet cell values, column
headings and file names are all attacker-influenced: a supplier sends a price
list, an operator opens it. Every render path goes through an escaping tagged
template, so a cell containing `<img src=x onerror=...>` is displayed, not
executed. `raw()` is the only escape hatch, appears at eight call sites, and
every one emits markup this codebase generated itself.

**Spreadsheet formula injection.** A CSV field beginning with `=`, `+`, `-`,
`@`, tab or carriage return is interpreted as a formula by Excel and
LibreOffice. Since these exports are opened in exactly those programs by the
people who received the source file, exported fields are prefixed with an
apostrophe to force literal text.

**Supply chain.** Every third-party script is pinned to an exact version with a
SHA-384 Subresource Integrity digest. If the CDN serves different bytes, the
browser refuses to run them. Digests are in `index.html` and
`src/ui/exporters.js`, and can be regenerated with:

```bash
curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
```

**Resource exhaustion.** Files above 60 MB are refused and sheets are capped at
200,000 rows, so a malformed or hostile workbook cannot hang the tab
indefinitely.

**Unsafe style injection.** Inline styles are built through a helper that
strips `;`, `{`, `}` and quotes, and rejects any value containing `url(` or
`expression`.

### Out of scope

**A compromised browser or extension.** An extension with page access can read
anything on screen. Nothing this application does can prevent that.

**Data at rest on the operator's machine.** Files are read from disk by the
user's own action. Protecting that disk is the operator's responsibility.

**The CDN itself.** Integrity digests detect tampering with the pinned
versions, but a CDN outage still stops charts loading. Air-gapped installation
is documented in [docs/deployment.md](docs/deployment.md).

**Correctness of the analysis.** Wrong output from wrong input is a bug, not a
vulnerability. Open a normal issue.

## What the application never does

- Send data anywhere. There is no backend and no telemetry
- Write to `localStorage` beyond a single theme preference
- Use cookies
- Execute anything derived from file contents
- Ask for credentials of any kind

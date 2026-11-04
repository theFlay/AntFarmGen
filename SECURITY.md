# Security

This repo and its site are public. They must never hold passwords, API keys, tokens or personal details. Keep those local or in a private place. GitHub push protection blocks known secret formats, and `.gitignore` covers common secret files, but neither catches everything, so check before you commit.

The site is one static page. It has no accounts, no server and no tracking, and nothing you enter leaves your browser. It loads nothing from other sites. A content security policy stops the page running any script except the one it shipped with, and layout files are fully validated before use.

To report a security problem, use the private reporting option on the repo's Security tab, not a public issue.

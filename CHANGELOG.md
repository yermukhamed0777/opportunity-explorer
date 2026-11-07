# Changelog

## 2.1.0 — 7 November 2026

- Organized and formatted the full source, added local preview commands and deployment documentation.
- Kept saved announcements available when a refresh fails, without changing their original dates.
- Prevented a failed storage read from overwriting an unread feed snapshot.
- Improved tracker backup recovery when browser storage is unavailable.
- Strengthened calendar escaping and catalog date validation.
- Limited feed response sizes while streaming and corrected Atom article-link selection.
- Added failure-recovery, storage, validation and local-server tests, plus continuous integration.
- Pinned a patched transitive dependency.

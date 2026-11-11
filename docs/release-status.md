# Release status — auth and UI update, 11 November 2026

The original ProspectoAI release was merged as `f9a0a12283f9aa3cbb08057cf0b2a7c3ead1dfd0` and deployed to Production. The production URL opened successfully. No rollback was performed.

This update adds explicit login, confirmation and password-reset routes, validates users before loading the workspace, protects the data APIs, removes catalog files from static hosting, and restricts Supabase resource reads to signed-in users. It adds clearer confirmation/error messages, confirmation resend, higher-contrast details, collapsible top filters, urgency badges and a mobile navigation drawer.

The production Supabase URL and publishable key match the connected project. The existing account is confirmed; recent auth logs show invalid credentials and email rate limiting. The new resource policy is applied and verified with all 58 resource records retained.

Live auth email delivery, password update, signed-in browser navigation, saved activities and model generation still need a successful owner-controlled session and inbox. Hosted Supabase URL/SMTP configuration is behind a separate dashboard sign-in. Automated callback and access-control checks are separate evidence and do not prove the email flow.

A custom domain has not been purchased or activated. Domain attachment was rejected by automated review because ownership was not established. Exact current DNS recommendations, the staged auth allowlist and owner steps are in `auth-routing-and-domains.md`.

The first scheduled source review remains pending. Previous automated policy-isolation/quota checks used a transaction that was rolled back; no persistent synthetic login fixture was created.

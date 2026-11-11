# Authentication and domain rollout

## Working production

The current canonical origin is `https://opportunity-explorer-ruddy.vercel.app/`.

In Supabase project **ProspectoAI**, open **Authentication → URL Configuration**. Keep Site URL set to that origin until a custom domain is owned, attached to Vercel and serving valid HTTPS. Production redirects are exact:

```text
https://opportunity-explorer-ruddy.vercel.app/
https://opportunity-explorer-ruddy.vercel.app/auth/callback
https://opportunity-explorer-ruddy.vercel.app/reset-password
https://opportunity-explorer-ruddy.vercel.app/auth/update-password
```

Legacy recovery and previously allowed preview URLs are retained for links already sent. Do not allow all Vercel domains or arbitrary redirect hosts. New branded aliases need these same four exact paths before sending confirmation or recovery mail from them.

**Authentication → Sign In / Providers → Email:** enable email sign-in and account confirmation. Keep new-user signup enabled when accepting registrations. **Authentication → Emails → SMTP Settings:** configure an owner-controlled SMTP provider and verified sender. The default Supabase sender is restricted and rate limited; it is not evidence that public email delivery works. Do not disable confirmation to conceal delivery failures.

The password reset request uses the request origin plus `/reset-password`; confirmation uses `/auth/callback`. Dedicated routes manually consume implicit tokens or exchange a PKCE code before clearing URL credentials. The app is vanilla JavaScript with Node functions, not Next.js: Next.js middleware/SSR helpers would not apply. Bootstrap validates the user before downloading catalog data; every private API separately validates the bearer session. Supabase RLS protects direct client queries and Storage.

## Preferred custom domain: www.prospectoai.com

Ownership is not confirmed. No domain has been purchased or attached. A read-only Vercel lookup on 11 November 2026 found external GoDaddy nameservers and non-Vercel website addresses; this does not establish who owns the domain.

After ownership is established:

1. Open **Vercel → opportunity-explorer → Settings → Domains**. Add `www.prospectoai.com` to Production. Add `prospectoai.com` with a **308 redirect to www.prospectoai.com**.
2. At the authoritative DNS provider, replace conflicting website records with the project-specific recommendations below. Recheck Vercel after attachment in case its assigned targets change.

| Type  | Host | Value                               | TTL                |
| ----- | ---- | ----------------------------------- | ------------------ |
| A     | @    | 216.198.79.1                        | Auto / 300 seconds |
| A     | @    | 64.29.17.1                          | Auto / 300 seconds |
| CNAME | www  | ef9ae98b7565a0d5.vercel-dns-017.com | Auto / 300 seconds |

3. Preserve MX and email-related TXT records. Remove only conflicting website A/AAAA/CNAME entries. Copy any ownership TXT challenge directly from Vercel; no challenge value is assumed.
4. Wait for Vercel to show valid configuration and an HTTPS certificate. Test both hosts and the apex-to-www redirect.
5. Set Supabase Site URL to `https://www.prospectoai.com/`. Add the following exact redirects:

```text
https://www.prospectoai.com/
https://www.prospectoai.com/auth/callback
https://www.prospectoai.com/reset-password
https://www.prospectoai.com/auth/update-password
```

6. Retain old production redirects during migration. Test signup, confirmation, login and recovery entirely on www. Only then redirect the old public origin while preserving path/query. There is no app API CORS allowlist to update: APIs are same-origin and never emit permissive CORS headers. Supabase Auth's redirect allowlist is distinct from CORS.

Browser sessions are origin-bound: users sign in once on a new domain. Never transfer session tokens between hosts in URLs. Changing a public origin does not delete saved Supabase data.

## Owner-only capabilities

- Add `SUPABASE_SECRET_KEY` in Vercel as a **server-only** Production/Preview secret to enable account deletion, then create a new deployment. Obtain it from this Supabase project's **Settings → API Keys → Secret keys**. Never put it in a `NEXT_PUBLIC_` variable, source code or chat. Account deletion verifies the current user and a sign-in within five minutes; it never accepts a target user ID from the browser.
- AI Gateway is Vercel's service. `AI_GATEWAY_API_KEY` is already configured in Production and Preview. Model generation must be tested while signed in; configuration flags alone do not prove it works.
- A complete email/password-change test requires an owner-controlled inbox. The owner enters and submits the new password personally. No synthetic production login accounts are retained.

## Primary technical references

- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/server-side
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/serving/downloads
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
- https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting

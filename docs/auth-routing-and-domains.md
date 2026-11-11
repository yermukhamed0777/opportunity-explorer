# Authentication and domain rollout — 11 November 2026

## Architecture and research

ProspectoAI is a static JavaScript application with Node.js Vercel functions, not Next.js. It uses the pinned `@supabase/supabase-js` client. Next.js auth helpers, SSR cookies and middleware are not installed or required by this architecture. A client-only modal would not protect downloadable catalogs, so the application now validates the user before loading the workspace and the server validates each catalog, feed, review and chat request.

The production public configuration was compared with the connected Supabase project's publishable keys: the URL and key match project `skukccwpnlokigyujntb`. The app uses `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; `NEXT_PUBLIC_` is a Next.js naming convention. The config helper accepts the corresponding Next.js public aliases for compatibility, rejects conflicting values, and refuses privileged keys. No service-role key is required.

Supabase logs at this checkpoint show invalid credentials and email-send rate limiting. The existing account is confirmed. This does not support treating every bad password as an unconfirmed account. The UI distinguishes `email_not_confirmed`, `invalid_credentials`, expired links and email rate limits, and offers confirmation resend and password reset.

## Recovery and confirmation

- `/login` is the public sign-in and registration route.
- `/reset-password` requests a reset or immediately shows the new-password form after a verified recovery callback.
- `/auth/callback` handles confirmation callbacks. `/auth/update-password` is a compatible recovery alias.
- The client explicitly consumes implicit access/refresh token fragments or a PKCE code, validates the resulting user, then removes callback credentials from the address bar. It does not depend on catching a transient `PASSWORD_RECOVERY` event.
- New reset requests use `location.origin + '/reset-password'`; signup and resend use `location.origin + '/auth/callback'`.
- Older recovery links returning to the root with `type=recovery` or `#recovery` are routed to the dedicated recovery page before the workspace starts.
- PKCE code exchange requires the verifier in the browser that started the flow. The application continues to request implicit email links by default so opening an email in another browser can work. Missing verifiers and expired/consumed links show a fresh-link request.
- Password changes must be performed by the account owner. No account passwords, confirmation tokens or recovery links belong in Git or support messages.

## Supabase dashboard values

URL: https://supabase.com/dashboard/project/skukccwpnlokigyujntb/auth/url-configuration

Keep the Site URL at `https://opportunity-explorer-ruddy.vercel.app/` until a custom domain is owned, verified and serving HTTPS.

Add these exact redirect URLs, keeping existing URLs needed by active deployments:

```text
https://opportunity-explorer-ruddy.vercel.app/
https://opportunity-explorer-ruddy.vercel.app/auth/callback
https://opportunity-explorer-ruddy.vercel.app/reset-password
https://opportunity-explorer-ruddy.vercel.app/auth/update-password
https://opportunity-explorer-ruddy.vercel.app/#recovery
```

For an explicitly tested preview, add that preview origin with `/auth/callback` and `/reset-password`. Exact production paths are preferable to broad wildcards.

In Authentication → Sign In / Providers, keep Email, new-user signup and Confirm Email enabled. In Authentication → Notifications → Email, keep the confirmation and reset templates linked through `{{ .ConfirmationURL }}`. A template that only links to `{{ .SiteURL }}` cannot establish a recovery session. Configure custom SMTP for public delivery and disable email-provider link tracking. Default Supabase delivery is restricted and rate-limited; successful request acceptance does not prove receipt.

The hosted dashboard was accessed through the owner’s secure GitHub sign-in. The Site URL was verified and the three production callback/reset paths above plus the exact preview callback/reset paths were added and saved. The dashboard now shows nine URLs, preserving the four earlier entries. SMTP is not configured: the Emails page explicitly reports default templates and asks for custom SMTP. Public email delivery still requires an owner-controlled sender/provider; no credential was requested in chat.

## Login enforcement and data

The bootstrap validates a confirmed, non-anonymous user with `getUser()` before fetching catalogs and loading the workspace. Failed or missing sessions go to `/login` with a sanitized return destination. Catalog JSON and generated data scripts are no longer emitted in the static output. API validation uses Supabase `getUser()` on the bearer token, not a trusted client-supplied user ID. Responses are private and not cached by the CDN. Sign-out returns to the login route, including changes from another tab.

The resource table no longer grants anonymous SELECT. Existing tracker/profile/activity ownership policies and saved user data are preserved. Old browser tracker records remain available for explicit import after login. The repository and original provider facts remain public; the login requirement controls access through the deployed app and is not a claim that the researched facts are confidential.

The site calls its own Vercel APIs on the same origin; it does not enable cross-origin credentialed access. Supabase's API authenticates with its project key and user JWT. Auth redirect allowlists are distinct from CORS. There are no custom Edge Functions, passkey origins or third-party cross-origin APIs to update here. Do not add `Access-Control-Allow-Origin: *` with credentials as a workaround.

## Custom domain preparation — not activated

Vercel's domain search returned:

| Domain          | Result                                                                |
| --------------- | --------------------------------------------------------------------- |
| prospectoai.com | Registration availability not confirmed                               |
| prospecto.ai    | Registration availability not confirmed                               |
| prospectoai.app | Available, non-premium: USD 14.99 for one year, quoted renewal USD 15 |

No custom domains were owned by the connected Vercel team. No domain was purchased. Automated approval review rejected adding the unowned apex and www redirect; neither change was applied. Do not point Supabase at an unowned domain.

After the owner registers `prospectoai.app` (or identifies another owned target):

1. Open Vercel → opportunity-explorer → Settings → Domains. Add the owned apex for Production, then add `www` with a 308 redirect to the apex.
2. At the authoritative DNS provider, use the exact records Vercel displays. The read-only domain configuration currently recommends the following for this project; recheck after ownership/attachment before applying:

| Type  | Host | Value                               | TTL                |
| ----- | ---- | ----------------------------------- | ------------------ |
| A     | @    | 216.198.79.1                        | Auto / 300 seconds |
| A     | @    | 64.29.17.1                          | Auto / 300 seconds |
| CNAME | www  | ef9ae98b7565a0d5.vercel-dns-017.com | Auto / 300 seconds |

3. Replace only conflicting website A/AAAA/CNAME records. Preserve MX and email/DKIM/SPF verification TXT records. If Vercel asks for ownership TXT, copy the exact challenge from the dashboard; no challenge is invented here.
4. Wait for valid configuration and an issued HTTPS certificate. Verify both apex and www redirect before changing auth destinations.
5. Set Supabase Site URL to `https://prospectoai.app/` and add these exact URLs:

```text
https://prospectoai.app/
https://prospectoai.app/auth/callback
https://prospectoai.app/reset-password
https://prospectoai.app/auth/update-password
```

6. Keep the existing Vercel-domain redirects temporarily for previously sent links. Start confirmation and reset flows on the same canonical origin used to finish them. Once all auth flows pass on the apex, configure the old public Vercel domain to redirect to it without dropping path or query parameters.

Browser session storage is origin-bound. Existing sessions are not silently copied from `.vercel.app` to the custom domain; users should sign in once on the new origin. Passing refresh tokens between domains in URLs would be unsafe. This does not delete account data or revoke the Supabase account.

## Evidence and remaining live checks

All 29 automated tests pass. The build, formatting and whitespace checks pass, as does GitHub CI. Preview browser navigation to `/#universities` immediately redirects to `/login?next=%2F%23universities`, with no search data displayed. Preview auth routes return 200, protected data APIs return 401 without a session, and former public catalog URLs return 404.

The automated suite covers direct auth routes, callback consumption, return-URL sanitization, missing/invalid/anonymous/unconfirmed sessions, refusal of privileged config, and anonymous rejection on all protected data APIs. The database migration was applied and verified: 58 resources remain; anonymous SELECT is denied and authenticated SELECT is granted.

A complete live sequence still requires an owner-controlled inbox and credentials: register → receive confirmation → confirm → login → request reset → receive newest reset email → choose a new password → login → navigate protected search and save an activity → reload → sign out → verify protected routes return to login. Email delivery and actual model generation must not be marked passed based on configuration flags or mocked tests.

## Primary references consulted

- https://supabase.com/changelog.md
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/sessions/implicit-flow
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/guides/auth/server-side
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://vercel.com/docs/domains/working-with-domains/add-a-domain

import { authClient } from './auth-client.js';
import {
  callbackKind,
  RECOVERY_PATH,
  CALLBACK_PATH,
  safeNext,
} from './auth-flow.js';
const status = document.querySelector('#boot-status');
const route = new URL(location.href);
function login() {
  location.replace(
    '/login?next=' + encodeURIComponent(safeNext(route.href, route.origin)),
  );
}
async function loadScript(src) {
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () =>
      reject(Error('Workspace could not load. Please reload.'));
    document.head.append(script);
  });
}
async function start() {
  const kind = callbackKind(route);
  if (kind) {
    location.replace(
      (kind === 'recovery' ? RECOVERY_PATH : CALLBACK_PATH) +
        route.search +
        route.hash,
    );
    return;
  }
  const { client, config } = await authClient();
  const { data, error } = await client.auth.getUser();
  if (
    error ||
    !data.user ||
    !data.user.email_confirmed_at ||
    data.user.is_anonymous
  )
    return login();
  async function authorizedFetch(url, options = {}) {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) {
      login();
      throw Error('Sign in again.');
    }
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...options.headers,
        Authorization: 'Bearer ' + session.access_token,
      },
    });
    if (response.status === 401 || response.status === 403) {
      login();
      throw Error('Sign in again.');
    }
    return response;
  }
  const response = await authorizedFetch('/api/catalog');
  if (!response.ok)
    throw Error('The collection could not load. Please reload.');
  const { catalog, resources, development } = await response.json();
  window.EXPLORER_CATALOG = catalog;
  window.OPPORTUNITIES = catalog.opportunities;
  window.CHECKED_ON = catalog.updatedAt.slice(0, 10);
  window.PROSPECTO_RESOURCES = resources;
  window.PROSPECTO_DEVELOPMENT = development;
  window.ProspectoAuth = {
    client,
    config,
    user: data.user,
    fetch: authorizedFetch,
  };
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      document.body.classList.add('auth-pending');
      login();
    }
  });
  await loadScript('/app.js');
  await loadScript('/workspace.js');
  await loadScript('/platform.js');
  document.body.classList.remove('auth-pending');
  status.hidden = true;
}
start().catch((error) => {
  status.textContent = error.message;
  const retry = document.createElement('a');
  retry.href = '/login';
  retry.textContent = 'Go to sign in';
  status.append(document.createElement('br'), retry);
});

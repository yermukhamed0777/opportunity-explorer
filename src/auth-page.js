import { authClient } from './auth-client.js';
import {
  authMessage,
  callbackKind,
  consumeCallback,
  safeNext,
  RECOVERY_PATH,
  CALLBACK_PATH,
} from './auth-flow.js';
const $ = (s) => document.querySelector(s);
const url = new URL(location.href);
const next = safeNext(url.searchParams.get('next'), url.origin);
let client, recoveryUserId;
const status = (message) => {
  $('#auth-status').textContent = message;
};
function show(form, title, intro) {
  document
    .querySelectorAll('.auth-card form')
    .forEach((el) => (el.hidden = el.id !== form));
  $('#auth-title').textContent = title;
  document.title = title + ' — ProspectoAI';
  $('#auth-intro').textContent = intro;
}
async function verified() {
  const { data, error } = await client.auth.getUser();
  return !error && data.user?.email_confirmed_at && !data.user.is_anonymous
    ? data.user
    : null;
}
async function initialize() {
  ({ client } = await authClient());
  const kind = callbackKind(url);
  if (kind) {
    const hasCallback =
      url.searchParams.has('code') || /access_token=|error=/.test(url.hash);
    try {
      if (hasCallback) await consumeCallback(client, url);
      // Clear code and token fragments before the page makes any further requests.
      history.replaceState(
        null,
        '',
        kind === 'recovery' ? RECOVERY_PATH : CALLBACK_PATH,
      );
      const user = await verified();
      if (kind === 'recovery') {
        if (hasCallback && user) {
          recoveryUserId = user.id;
          sessionStorage.setItem('prospecto-recovery-user', user.id);
        } else if (
          user &&
          sessionStorage.getItem('prospecto-recovery-user') === user.id
        )
          recoveryUserId = user.id;
        if (recoveryUserId) {
          show(
            'update-password-form',
            'Choose a new password.',
            'Your reset link is verified. Enter and confirm your new password below.',
          );
          status('Use at least 10 characters.');
        } else {
          show(
            'reset-request-form',
            'Reset your password.',
            'We’ll send a secure link directly to this password update page.',
          );
          status(
            hasCallback
              ? 'This link could not be verified. Request a fresh link.'
              : 'Enter the email used for your ProspectoAI account.',
          );
        }
        return;
      }
      if (user) return location.replace(next);
      show(
        'login-form',
        'Confirm your account.',
        'Open the confirmation message in your inbox, then sign in.',
      );
      status('Please check your inbox to confirm your account.');
    } catch (error) {
      history.replaceState(
        null,
        '',
        kind === 'recovery' ? RECOVERY_PATH : '/login',
      );
      show(
        kind === 'recovery' ? 'reset-request-form' : 'login-form',
        'Let’s try a fresh link.',
        'Email links expire and can only be used once.',
      );
      status(authMessage(error));
    }
    return;
  }
  if (await verified()) return location.replace(next);
  show(
    'login-form',
    'Sign in to explore.',
    'Use your ProspectoAI email and password.',
  );
  status(
    url.searchParams.get('updated') === '1'
      ? 'Password updated. Sign in with your new password.'
      : 'Sign in to unlock search and your private workspace.',
  );
}
document.addEventListener('submit', async (e) => {
  if (
    !['login-form', 'reset-request-form', 'update-password-form'].includes(
      e.target.id,
    )
  )
    return;
  e.preventDefault();
  if (!client) return;
  const form = e.target,
    submitter = e.submitter;
  const fields = new FormData(form);
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach((b) => (b.disabled = true));
  status('Working securely…');
  try {
    if (form.id === 'reset-request-form') {
      const { error } = await client.auth.resetPasswordForEmail(
        String(fields.get('email')).trim(),
        { redirectTo: url.origin + RECOVERY_PATH },
      );
      if (error) throw error;
      status(
        'If an account exists for this email, check your inbox for a reset link. Open the newest message.',
      );
    } else if (form.id === 'update-password-form') {
      if (!recoveryUserId || (await verified())?.id !== recoveryUserId)
        throw Error('Your reset session expired. Request a fresh link.');
      if (fields.get('password') !== fields.get('confirmation'))
        throw Error('The passwords do not match. Please enter them again.');
      const { error } = await client.auth.updateUser({
        password: fields.get('password'),
      });
      if (error) throw error;
      sessionStorage.removeItem('prospecto-recovery-user');
      recoveryUserId = null;
      form.reset();
      const result = await client.auth.signOut();
      if (result.error) throw result.error;
      location.replace('/login?updated=1');
    } else {
      const email = String(fields.get('email')).trim(),
        password = fields.get('password');
      const signup = submitter?.value === 'signup';
      if (signup && password.length < 10)
        throw Error('Choose a password with at least 10 characters.');
      const result = signup
        ? await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: url.origin + CALLBACK_PATH },
          })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      form.querySelector('[name=password]').value = '';
      if (signup && !result.data.session)
        status(
          'Please check your inbox to confirm your account. After confirmation, sign in here. Check spam if the message is missing.',
        );
      else if (await verified()) location.replace(next);
      else status('Please check your inbox to confirm your account.');
    }
  } catch (error) {
    status(authMessage(error));
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
});
$('#resend-confirmation').addEventListener('click', async (e) => {
  const form = $('#login-form'),
    email = form.elements.email;
  if (!email.reportValidity() || !client) return;
  e.target.disabled = true;
  try {
    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.value.trim(),
      options: { emailRedirectTo: url.origin + CALLBACK_PATH },
    });
    if (error) throw error;
    status(
      'If confirmation is needed, check your inbox to confirm your account. Open the newest message.',
    );
  } catch (error) {
    status(authMessage(error));
  } finally {
    e.target.disabled = false;
  }
});
initialize().catch((error) => {
  const setup = ['auth_not_configured', 'auth_config_invalid'].includes(
    error.code,
  );
  show(
    null,
    setup ? 'Account setup needed.' : 'Account service unavailable.',
    'Sign-in is unavailable until the account service is ready.',
  );
  $('.auth-card')
    .querySelectorAll('form button, form input')
    .forEach((el) => {
      el.disabled = true;
    });
  $('#auth-status').setAttribute('role', 'alert');
  status(authMessage(error));
  $('#auth-retry').hidden = false;
});

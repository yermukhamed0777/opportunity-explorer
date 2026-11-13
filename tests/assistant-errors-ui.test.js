import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

test(
  'chat displays a usable 503 catalog fallback and still rejects ordinary server errors',
  { timeout: 10000 },
  async () => {
    const w = new Window({ url: 'https://app.example/#assistant' });
    try {
      w.document.write(
        readFileSync('dist/index.html', 'utf8').replace(
          /<script\b[^>]*>[\s\S]*?<\/script>/gi,
          '',
        ),
      );
      w.PROSPECTO_RESOURCES = JSON.parse(readFileSync('data/resources.json'));
      w.PROSPECTO_DEVELOPMENT = JSON.parse(
        readFileSync('data/development.json'),
      );
      w.ProspectoTracker = {
        setCloud() {},
        setView(view) {
          w.ProspectoPlatform.render(view);
        },
      };
      let payload = {
        mode: 'catalog',
        text: 'Catalog fallback remains available.',
        references: [],
        notice: 'AI generation is unavailable.',
      };
      w.ProspectoAuth = {
        config: {},
        user: { id: 'test-owner' },
        fetch: async () => ({
          ok: false,
          status: 503,
          json: async () => payload,
        }),
        client: {
          auth: {
            onAuthStateChange() {},
            getSession: async () => ({
              data: { session: { access_token: 'fictional-test-session' } },
            }),
          },
          from() {
            const q = {
              select() {
                return q;
              },
              eq() {
                return q;
              },
              order: async () => ({ data: [] }),
              maybeSingle: async () => ({ data: null }),
            };
            return q;
          },
        },
      };
      w.eval(readFileSync('dist/platform.js', 'utf8'));
      const settle = async () => {
        for (let i = 0; i < 12; i++)
          await new Promise((resolve) => setImmediate(resolve));
      };
      await settle();
      const submit = async () => {
        w.document.querySelector('#chat-input').value = 'Find a course';
        w.document
          .querySelector('#chat-form')
          .dispatchEvent(
            new w.Event('submit', { bubbles: true, cancelable: true }),
          );
        await settle();
      };
      await submit();
      assert.match(
        w.document.querySelector('#platform-panel').textContent,
        /Catalog fallback remains available/,
      );
      assert.match(
        w.document.querySelector('#platform-panel').textContent,
        /AI generation is unavailable/,
      );
      payload = { error: 'The source collection is temporarily unavailable.' };
      await submit();
      assert.match(
        w.document.querySelector('#platform-panel').textContent,
        /The source collection is temporarily unavailable/,
      );
      assert.equal(w.document.querySelector('#chat-send').disabled, false);
    } finally {
      await w.happyDOM.close();
    }
  },
);

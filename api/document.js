import { Worker } from 'node:worker_threads';
import { requireUser } from '../lib/auth.js';
export function processFile(bytes, name) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../lib/document-worker.js', import.meta.url),
      {
        workerData: { bytes, name },
        resourceLimits: { maxOldGenerationSizeMb: 192 },
      },
    );
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Error('Document processing timed out. Try a shorter file.'));
    }, 15000);
    worker.once('message', (message) => {
      clearTimeout(timer);
      worker.terminate();
      message.error ? reject(Error(message.error)) : resolve(message.result);
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(Error('Document processing failed. Export a fresh PDF or DOCX.'));
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code)
        reject(Error('Document processing stopped. Try a smaller file.'));
    });
  });
}
export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  const { db, user } = auth;
  let id, revision;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    id = body?.id;
    if (!/^[a-f0-9-]{36}$/i.test(id || ''))
      return res.status(400).json({ error: 'Choose an uploaded document.' });
    const { data: doc, error } = await db
      .from('documents')
      .select('id,name,path,bytes,revision')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (error || !doc)
      return res
        .status(404)
        .json({ error: 'Document not found in your workspace.' });
    revision = doc.revision;
    const { error: stateError } = await db
      .from('documents')
      .update({ processing_state: 'Processing', error: null })
      .eq('id', id)
      .eq('user_id', user.id);
    if (stateError) throw Error('Could not start processing. Please retry.');
    const { data: file, error: downloadError } = await db.storage
      .from('profile-documents')
      .download(doc.path);
    if (downloadError || !file)
      throw Error('The private document could not be read. Re-upload it.');
    if (file.size !== doc.bytes || file.size > 10485760)
      throw Error('The document size changed. Re-upload it.');
    const result = await processFile(
      new Uint8Array(await file.arrayBuffer()),
      doc.name,
    );
    const { data: saved, error: saveError } = await db
      .from('documents')
      .update({
        processing_state: 'Needs review',
        extracted_text: result.text,
        draft: result.draft,
        error: null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('revision', revision)
      .select('id');
    if (saveError || !saved?.length)
      throw Error('The extracted text could not be saved. Please retry.');
    return res.status(200).json({ state: 'Needs review', pages: result.pages });
  } catch (error) {
    const message = String(error.message || 'Processing failed.').slice(0, 500);
    if (id)
      await db
        .from('documents')
        .update({ processing_state: 'Error', error: message })
        .eq('id', id)
        .eq('user_id', user.id)
        .eq('revision', revision);
    return res.status(400).json({ error: message });
  }
}

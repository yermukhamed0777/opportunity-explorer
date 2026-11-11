import { parentPort, workerData } from 'node:worker_threads';
import { parseDocument } from './document-parser.js';
try {
  parentPort.postMessage({
    result: await parseDocument(workerData.bytes, workerData.name),
  });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}

// Enumerate every folder before deletion so paging cannot skip objects after a removal.
export async function removePrivateDocuments(bucket, userId) {
  const files = [],
    folders = [userId];
  for (let cursor = 0; cursor < folders.length; cursor++) {
    if (folders.length > 500) throw Error('Document folder limit exceeded.');
    const prefix = folders[cursor];
    for (let offset = 0; offset < 10000; offset += 100) {
      const { data, error } = await bucket.list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw error;
      for (const entry of data || []) {
        if (
          !entry.name ||
          entry.name === '.' ||
          entry.name === '..' ||
          entry.name.includes('/')
        )
          throw Error('Invalid document path.');
        const path = prefix + '/' + entry.name;
        if (entry.id) files.push(path);
        else folders.push(path);
      }
      if (files.length > 10000) throw Error('Document cleanup limit exceeded.');
      if (!data || data.length < 100) break;
      if (offset === 9900) throw Error('Document listing limit exceeded.');
    }
  }
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await bucket.remove(files.slice(i, i + 100));
    if (error) throw error;
  }
  return files.length;
}

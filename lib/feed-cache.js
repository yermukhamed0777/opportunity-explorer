/** Coordinate refreshes without losing an existing snapshot on a storage error. */
export function createFeedCache({ read, collect, write }) {
  let pending;

  function refresh() {
    if (pending) return pending;
    pending = (async () => {
      // A failed read is different from an empty store: never overwrite unread data.
      const previous = await read();
      const snapshot = await collect(previous || {});
      if (!snapshot.lastSuccessfulRefresh && !previous) {
        throw new Error(
          'No readable source; refusing to store an empty initial feed.',
        );
      }
      await write(snapshot);
      return snapshot;
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  }

  return { refresh };
}

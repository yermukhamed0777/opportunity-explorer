import { readFeed, refreshFeed } from '../lib/feed-store.js';
import { createDiscoverHandler } from '../lib/discover-handler.js';

export default createDiscoverHandler({ read: readFeed, refresh: refreshFeed });

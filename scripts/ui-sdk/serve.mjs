import { openAccessStore } from '../../server/access-store.mjs';
import { siteServer } from '../../server/site.mjs';

const store = openAccessStore(':memory:');
store.setPassword('hema-theory', 'sdk-test');
siteServer(store, 'http://127.0.0.1:4197').listen(4197, '127.0.0.1');

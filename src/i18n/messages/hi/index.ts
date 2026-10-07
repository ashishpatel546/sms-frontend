// Aggregates the hi namespaces. Add a namespace by creating <ns>.json in en/, hi/ and bn/ and listing it in all three.
import auth from './auth.json';
import common from './common.json';
import nav from './nav.json';
import product from './product.json';
import settings from './settings.json';
import splash from './splash.json';
import type { Messages } from '../en';

// `satisfies` makes tsc fail when a key in en/ has no translation here.
const messages = { auth, common, nav, product, settings, splash } satisfies Messages;
export default messages;

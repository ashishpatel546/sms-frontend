// Aggregates the en namespaces. Add a namespace by creating <ns>.json in en/, hi/ and bn/ and listing it in all three.
import auth from './auth.json';
import common from './common.json';
import nav from './nav.json';
import product from './product.json';
import settings from './settings.json';
import splash from './splash.json';

const messages = { auth, common, nav, product, settings, splash };

export type Messages = typeof messages;
export default messages;

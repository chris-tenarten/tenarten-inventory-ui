// One transport implementation; fixed pilot environment and isolated secret namespace.
import {serveWebPush} from '../send-web-push/runtime.ts';
serveWebPush('tendev','TENDEV_WEB_PUSH_');

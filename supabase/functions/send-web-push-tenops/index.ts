// Fixed Production environment; never read TenDev's secret namespace. Disabled by default.
import {serveWebPush} from '../send-web-push/runtime.ts';
serveWebPush('tenops','TENOPS_WEB_PUSH_');

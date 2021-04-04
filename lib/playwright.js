// NOTE resources for tests:
// https://httpbin.org/user-agent
// http://www.ip-score.com
// https://arh.antoinevastel.com/bots/areyouheadless
// https://bot.sannysoft.com
// https://antoinevastel.com/bots/

require( "./playwright/patch/client/chromium-browser" );
require( "./playwright/patch/client/chromium-browser-context" );
require( "./playwright/patch/client/browser-type" );
const playwright = require( "./playwright/patch/playwright" );

module.exports = playwright;

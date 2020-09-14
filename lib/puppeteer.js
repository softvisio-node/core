var puppeteer;

if ( process.platform === "win32" ) {
    puppeteer = require( "puppeteer-extra" ).addExtra( require( "puppeteer" ) );
}
else {
    puppeteer = require( "puppeteer-extra" );
}

const StealthPlugin = require( "puppeteer-extra-plugin-stealth" );
const stealthPlugin = StealthPlugin();
stealthPlugin.opts.enabledEvasions.delete( "user-agent-override" );
puppeteer.use( stealthPlugin );

const SoftvisioPlugin = require( "@softvisio/core/puppeteer/softvisio" );
puppeteer.use( new SoftvisioPlugin( {} ) );

module.exports = puppeteer;

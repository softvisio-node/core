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

// XXX https://github.com/berstend/puppeteer-extra/pull/322
puppeteer.launch = async function ( options = {} ) {
    if ( !options.args ) options.args = [];

    this.resolvePluginDependencies();
    this.orderPlugins();

    // Give plugins the chance to modify the options before launch
    options = await this.callPluginsWithValue( "beforeLaunch", options );
    const opts = {
        "context": "launch",
        options,
        "defaultArgs": this.defaultArgs,
    };

    // Let's check requirements after plugin had the chance to modify the options
    this.checkPluginRequirements( opts );
    const browser = await this.pptr.launch( options );
    this._patchPageCreationMethods( browser );
    await this.callPlugins( "_bindBrowserEvents", browser, opts );
    return browser;
};

puppeteer.devices = require( "./puppeteer/devices" );

module.exports = puppeteer;

const STEALTH = [

    //
    "navigator.webdriver",
    "navigator.plugins",
    "chrome.runtime",

    // "navigator.permissions",
    // navigator.vendor,
];

var chromiumBrowser;

try {
    chromiumBrowser = require( "playwright-core/lib/client/chromiumBrowser" );
}
catch ( e ) {
    try {
        chromiumBrowser = require( "playwright-chromium/lib/client/chromiumBrowser" );
    }
    catch ( e ) {
        chromiumBrowser = require( "playwright/lib/client/chromiumBrowser" );
    }
}

chromiumBrowser.ChromiumBrowser = class extends chromiumBrowser.ChromiumBrowser {
    async newContext ( options = {} ) {

        // make a copy
        options = { ...options };

        // apply device settings
        if ( options.device ) {
            options = { ...options.device, ...options };

            delete options.device;
        }

        // viewport can;t be null if deviceScaleFactor is specified
        if ( options.deviceScaleFactor && options.viewport === null ) delete options.viewport;

        // patch userAgent
        if ( !options.userAgent && this._initializer.userAgent ) {
            options.userAgent = this._initializer.userAgent.replace( "HeadlessChrome/", "Chrome/" );

            // patch userAgent platform
            if ( options.userAgentPlatform ) {
                options.userAgent = options.userAgent.replace( /\(.+?\)/, `(${options.userAgentPlatform})` );
            }
        }

        const ctx = await super.newContext( options );

        // override navigator.platform
        if ( options.platform ) {
            await ctx.addInitScript( ( [platform] ) => {
                Object.defineProperty( navigator, "platform", {
                    "get": function () {
                        return platform;
                    },
                    "set": function ( value ) {},
                } );
            },
            [options.platform] );
        }

        if ( options.stealth !== false ) {

            // override webglVendor, webglRenderer
            await ctx.addInitScript( ...this.#loadPlugin( "webgl.vendor" ).onPageCreated( { "webglVendor": options.webglVendor, "webglRenderer": options.webglRenderer } ) );

            for ( const name of STEALTH ) await ctx.addInitScript( ...this.#loadPlugin( name ).onPageCreated() );
        }

        return ctx;
    }

    #loadPlugin ( name ) {
        return require( "../../stealth/" + name );
    }
};

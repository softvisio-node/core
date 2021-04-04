var browser;

try {
    browser = require( "playwright/lib/client/chromiumBrowser" );
}
catch ( e ) {
    browser = require( "playwright-chromium/lib/client/chromiumBrowser" );
}

// XXX options.platform
browser.ChromiumBrowser = class extends browser.ChromiumBrowser {
    async newContext ( options = {} ) {
        options = { ...options };

        if ( options.device ) {
            options = { ...options.device, ...options };

            delete options.device;
        }

        if ( options.deviceScaleFactor && options.viewport === null ) delete options.viewport;

        // patch userAgent
        if ( !options.userAgent && this._initializer.userAgent ) {
            options.userAgent = this._initializer.userAgent.replace( "HeadlessChrome/", "Chrome/" );

            // patch userAgent platform
            if ( options.userAgentPlatform ) {
                options.userAgent = options.userAgent.replace( /\(.+?\)/, `(${options.userAgentPlatform})` );
            }
        }

        // apply plugins
        // if ( options.plugins ) {
        //     for ( const pluginName of options.plugins ) {
        //         const plugin = require( "../../plugins/" + pluginName );

        //         await plugin( { ...this._initializer }, options );
        //     }

        //     delete options.plugins;
        // }

        return await super.newContext( options );
    }
};

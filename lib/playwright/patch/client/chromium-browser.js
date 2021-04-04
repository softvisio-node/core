var chromiumBrowser;

try {
    chromiumBrowser = require( "playwright/lib/client/chromiumBrowser" );
}
catch ( e ) {
    chromiumBrowser = require( "playwright-chromium/lib/client/chromiumBrowser" );
}

// XXX options.platform, https://github.com/microsoft/playwright/issues/6070, or remove from device profile
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

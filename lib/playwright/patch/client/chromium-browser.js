var browser;

try {
    browser = require( "playwright/lib/client/chromiumBrowser" );
}
catch ( e ) {
    browser = require( "playwright-chromium/lib/client/chromiumBrowser" );
}

browser.ChromiumBrowser = class extends browser.ChromiumBrowser {
    async newContext ( options = {} ) {
        options = { ...options };

        if ( options.device ) {
            options = { ...options.device, ...options };

            delete options.device;
        }

        if ( options.deviceScaleFactor && options.viewport === null ) delete options.viewport;

        // XXX prepare plugins
        if ( options.plugins ) {

            // const plugins = options.plugins;
        }

        return await super.newContext( options );
    }
};

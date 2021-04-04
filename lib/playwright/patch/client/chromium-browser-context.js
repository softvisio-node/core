var browserContext;

try {
    browserContext = require( "playwright/lib/client/chromiumBrowserContext" );
}
catch ( e ) {
    browserContext = require( "playwright-chromium/lib/client/chromiumBrowserContext" );
}

browserContext.ChromiumBrowserContext = class extends browserContext.ChromiumBrowserContext {
    async newPage () {
        const page = await super.newPage();

        await page._pageReady;

        return page;
    }

    async _onPage ( page ) {
        var resolve;

        page._pageReady = new Promise( _resolve => ( resolve = _resolve ) );

        // XXX run plugins
        if ( page.context()._options.plugins ) {
            const UserAgentPlugin = require( "../../plugins/user-agent" );
            const userAgentPlugin = new UserAgentPlugin();
            await userAgentPlugin.run( page, page.context()._options );

            //
        }

        super._onPage( page );

        resolve();
    }
};

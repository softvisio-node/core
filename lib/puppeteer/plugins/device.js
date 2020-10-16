const { PuppeteerExtraPlugin } = require( "puppeteer-extra-plugin" );

var DEFAULT_USER_AGENT;

class SoftvisioDevicePlugin extends PuppeteerExtraPlugin {
    get name () {
        return "device";
    }

    async onPageCreated ( page ) {
        const device = this.opts;

        // override user agent
        const override = {
            "acceptLanguage": "en-US,en",
        };

        if ( device.userAgent ) {
            override.userAgent = device.userAgent;
        }

        // modify default user agent
        else {
            if ( !DEFAULT_USER_AGENT ) DEFAULT_USER_AGENT = await page.browser().userAgent();

            override.userAgent = DEFAULT_USER_AGENT.replace( "HeadlessChrome/", "Chrome/" );

            if ( device.userAgentPlatform ) {
                override.userAgent = override.userAgent.replace( /\(.+?\)/, `(${device.userAgentPlatform})` );
            }
        }

        if ( device.platform ) override.platform = device.platform;

        page._client.send( "Network.setUserAgentOverride", override );

        // set viewport
        if ( device.viewport ) page.setViewport( device.viewport );
    }
}

module.exports = options => new SoftvisioDevicePlugin( options );

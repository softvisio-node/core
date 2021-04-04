const Mutex = require( "../../threads/mutex" );

// XXX
/*
Page.prototype.disableImages = async function () {
    return this.route( "**", ( route, request ) => {
        if ( request.resourceType() === "image" ) route.abort();
        else route.continue();
    } );
};
*/

const mutex = new Mutex();
var version;

async function getVersion ( page ) {
    if ( version ) return version;

    if ( !mutex.tryDown() ) return await mutex.signal.wait();

    const session = await page.context().newCDPSession( page );
    version = await session.send( "Browser.getVersion" );
    session.detach();

    mutex.up();
    mutex.signal.broadcast( version );

    return version;
}

module.exports = class {
    async run ( page, options ) {
        var patch;

        const override = {
            "acceptLanguage": options.locale || undefined,
        };

        const userAgent = options.userAgent || ( await getVersion( page ) ).userAgent;

        // patch userAgent headless
        override.userAgent = userAgent.replace( "HeadlessChrome/", "Chrome/" );

        // patch userAgent platform
        if ( options.userAgentPlatform ) {
            override.userAgent = override.userAgent.replace( /\(.+?\)/, `(${options.userAgentPlatform})` );
        }

        if ( userAgent !== override.userAgent ) patch = true;

        if ( options.platform ) {
            override.platform = options.platform;

            patch = true;
        }

        if ( patch ) {
            const session = await page.context().newCDPSession( page );

            await session.send( "Emulation.setUserAgentOverride", override );
        }
    }
};

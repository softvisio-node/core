const Mutex = require( "./threads/mutex" );
const devices = require( "./playwright/devices" );

var playwright, Page;

try {
    playwright = require( "playwirght" );
    ( { Page } = require( "playwright/lib/client/page" ) );
}
catch ( e ) {
    playwright = require( "playwright-chromium" );
    ( { Page } = require( "playwright-chromium/lib/client/page" ) );
}

const DEFAULT_ARGS = [
    "--start-maximized",
    "--no-default-browser-check",

    "--disable-notifications", // disables the Web Notification and the Push APIs
    // "--noerrdialogs", // TBD suppresses all error dialogs when present

    // SECURITY
    // "--disable-web-security", // don't enforce the same-origin policy

    // PERFORMANCE
    "--no-sandbox", // XXX can be covered by chromiumSandbox option, need to check
    "--disable-gpu",
    "--enable-tcp-fast-open", // https://wiki.mikejung.biz/Chrome#Enable_Chrome_TCP_Fast_Open_.28Linux_.2F_Android_Only.29
    "--enable-async-dns", // https://wiki.mikejung.biz/Chrome#Enforce_Async_DNS_with_Chrome
    // "--no-zygote", // https://chromium.googlesource.com/chromium/src/+/master/docs/linux/zygote.md
    // "--single-process", // incompatible with incognito
];

playwright.devices = devices;

playwright.chromium._launch = playwright.chromium.launch;
playwright.chromium.launch = async function ( options = {} ) {
    options = { ...options };

    options.args = [...( options.args || [] ), ...DEFAULT_ARGS];

    if ( !( "executablePath" in options ) && process.platform === "linux" ) {
        options.executablePath = "/usr/bin/google-chrome-stable"; // chromium-browser
    }

    if ( !( "headless" in options ) ) options.headless = process.platform === "win32" ? false : true;

    if ( !( "proxy" in options ) ) {
        options.proxy = {
            "server": "-",
            "bypass": "*",
        };
    }

    return playwright.chromium._launch( options );
};

playwright.disableImages = async function ( page ) {
    return page.route( "**", ( route, request ) => {
        if ( request.resourceType() === "image" ) route.abort();
        else route.continue();
    } );
};

const mutex = new Mutex();
var version;

Page.prototype._getVersion = async function () {
    if ( version ) return version;

    if ( !mutex.tryDown() ) return await mutex.signal.wait();

    const session = await this.context().newCDPSession( this );
    version = await session.send( "Browser.getVersion" );
    session.detach();

    mutex.up();
    mutex.signal.broadcast( version );

    return version;
};

Page.prototype.setDevice = async function ( device = {} ) {
    const version = await this._getVersion();

    // override user agent
    const override = {
        "acceptLanguage": "en-US,en",
    };

    if ( device.userAgent ) {
        override.userAgent = device.userAgent;
    }

    // modify default user agent
    else {
        override.userAgent = version.userAgent.replace( "HeadlessChrome/", "Chrome/" );

        if ( device.userAgentPlatform ) {
            override.userAgent = override.userAgent.replace( /\(.+?\)/, `(${device.userAgentPlatform})` );
        }
    }

    if ( device.platform ) override.platform = device.platform;

    const session = await this.context().newCDPSession( this );

    await session.send( "Emulation.setUserAgentOverride", override );

    // XXX
    // session.detach();

    // set viewport
    // XXX
    // if ( device.viewport ) page.setViewport( device.viewport );
};

// async emulateViewport(viewport) {
//         const mobile = viewport.isMobile || false;
//         const width = viewport.width;
//         const height = viewport.height;
//         const deviceScaleFactor = viewport.deviceScaleFactor || 1;
//         const screenOrientation = viewport.isLandscape
//             ? { angle: 90, type: 'landscapePrimary' }
//             : { angle: 0, type: 'portraitPrimary' };
//         const hasTouch = viewport.hasTouch || false;
//         await Promise.all([
//             this._client.send('Emulation.setDeviceMetricsOverride', {
//                 mobile,
//                 width,
//                 height,
//                 deviceScaleFactor,
//                 screenOrientation,
//             }),
//             this._client.send('Emulation.setTouchEmulationEnabled', {
//                 enabled: hasTouch,
//             }),
//         ]);
//         const reloadNeeded = this._emulatingMobile !== mobile || this._hasTouch !== hasTouch;
//         this._emulatingMobile = mobile;
//         this._hasTouch = hasTouch;
//         return reloadNeeded;
//     }

module.exports = playwright;

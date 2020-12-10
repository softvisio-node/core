const puppeteer = require( "puppeteer-extra" );
const ProxyServer = require( "./proxy/server" );
const fetch = require( "./http/fetch" );
const IPAddr = require( "./ip/addr" );

// NOTE test resources
// https://httpbin.org/user-agent
// http://www.ip-score.com
// https://arh.antoinevastel.com/bots/areyouheadless
// https://bot.sannysoft.com
// https://antoinevastel.com/bots/

// NOTE
// flags explained: https://peter.sh/experiments/chromium-command-line-switches/
// default flags: https://github.com/puppeteer/puppeteer/blob/master/lib/Launcher.js#L269
// AWS Lambda flags: https://github.com/alixaxel/chrome-aws-lambda/blob/10feb8d162626d34aad2ee1e657f20956f53fe11/source/index.js
const DEFAULT_ARGS = [
    "--start-maximized",
    "--no-default-browser-check",

    "--disable-notifications", // disables the Web Notification and the Push APIs
    // "--noerrdialogs", // TBD suppresses all error dialogs when present

    // SECURITY
    // "--disable-web-security", // don't enforce the same-origin policy

    // PERFORMANCE
    "--no-sandbox",
    "--disable-gpu",
    "--enable-tcp-fast-open", // https://wiki.mikejung.biz/Chrome#Enable_Chrome_TCP_Fast_Open_.28Linux_.2F_Android_Only.29
    "--enable-async-dns", // https://wiki.mikejung.biz/Chrome#Enforce_Async_DNS_with_Chrome
    // "--no-zygote", // https://chromium.googlesource.com/chromium/src/+/master/docs/linux/zygote.md
    // "--single-process", // incompatible with incognito
];

const STEALTH_PLUGINS = [

    //
    "chrome.app",
    "chrome.csi",
    "chrome.loadTimes",
    "chrome.runtime",
    "iframe.contentWindow",
    "media.codecs",
    "navigator.languages",
    "navigator.permissions",
    "navigator.plugins",
    "navigator.webdriver",
    "sourceurl",
    "window.outerdimensions",
];

const DEFAULT_PUPPETEER = ( () => {
    if ( process.platform === "win32" ) {
        try {
            return require( "puppeteer" );
        }
        catch ( e ) {}
    }

    return require( "puppeteer-core" );
} )();

var DEFAULT_TIMEZONE;

class PuppeteerExtra extends puppeteer.PuppeteerExtra {
    async launch ( options = {} ) {
        if ( !options.args ) options.args = [];

        // add default args
        options.args.push( ...DEFAULT_ARGS );

        // set default headless mode
        if ( !( "headless" in options ) ) {
            options.headless = process.platform === "win32" ? false : true;
        }

        // have viewport match window size, unless specified by user, https://github.com/GoogleChrome/puppeteer/issues/3688
        if ( !( "defaultViewport" in options ) ) {
            options.defaultViewport = null;
        }

        if ( !( "executablePath" in options ) && process.platform === "linux" ) {
            options.executablePath = "google-chrome-stable"; // chromium-browser
        }

        // device
        if ( options.device ) {
            const headfulMaximized = !( "headfulMaximized" in options ) ? true : options.headfulMaximized;

            // window is maximized if in headful mode and headfulMaximized
            const maximized = !options.headless && headfulMaximized ? true : false;

            // set browser window dimensions
            if ( !maximized && options.device.windowSize ) {
                options.args.push( `--window-size=${options.device.windowSize[0]},${options.device.windowSize[1]}` );
            }

            const device = {
                "userAgent": options.device.userAgent,
                "userAgentPlatform": options.device.userAgentPlatform,
                "platform": options.device.platform,
                "viewport": {
                    "width": maximized ? 0 : options.device.viewportSize ? options.device.viewportSize[0] : 0,
                    "height": maximized ? 0 : options.device.viewportSize ? options.device.viewportSize[1] : 0,
                    "deviceScaleFactor": options.device.deviceScaleFactor,
                    "isMobile": options.device.isMobile,
                    "hasTouch": options.device.hasTouch,
                    "isLandscape": options.device.isLandscape,
                },
            };

            this.use( require( "./puppeteer/plugins/device" )( device ) );

            if ( options.device.webglVendor || options.device.webglRenderer ) {
                this.use( require( "puppeteer-extra-plugin-stealth/evasions/webgl.vendor" )( {
                    "vendor": options.device.webglVendor,
                    "renderer": options.device.webglRenderer,
                } ) );
            }
        }

        var proxyServer;

        // proxy
        if ( options.proxy ) {
            proxyServer = new ProxyServer( { "proxy": options.proxy === true ? null : options.proxy } );

            await proxyServer.listen();

            options.args.push( `--proxy-server=${proxyServer.chromeConnectUrl}` );
        }

        // timezone
        if ( options.timezone ) {
            let timezone;

            if ( typeof options.timezone === "string" ) {
                timezone = options.timezone;
            }
            else {
                timezone = await this._getTimezone( proxyServer );
            }

            if ( timezone ) this.use( require( "./puppeteer/plugins/timezone" )( { timezone } ) );
        }

        // stealth
        if ( options.stealth ) {
            for ( const plugin of STEALTH_PLUGINS ) {
                this.use( require( "puppeteer-extra-plugin-stealth/evasions/" + plugin )() );
            }
        }

        const browser = await super.launch( options );

        // proxy cleanup
        if ( proxyServer ) {
            browser.proxyServer = proxyServer;

            browser.once( "disconnected", () => {
                proxyServer.close();
            } );
        }

        return browser;
    }

    async _getDefaultTimezone () {
        if ( !DEFAULT_TIMEZONE == null ) {
            const res = await fetch( "https://httpbin.org/ip" );

            let timezone = "";

            if ( res.ok ) {
                const json = await res.json();

                const ip = new IPAddr( json.origin );

                if ( ip.geo ) timezone = ip.geo.location.time_zone;
            }

            DEFAULT_TIMEZONE = timezone;
        }

        return DEFAULT_TIMEZONE;
    }

    async _getTimezone ( proxyServer ) {
        var timezone;

        if ( proxyServer && proxyServer.proxy ) timezone = await proxyServer.proxy.getTimzone();

        if ( !timezone ) timezone = await this._getDefaultTimezone();

        return timezone;
    }
}

module.exports = function ( puppeteer ) {
    return new PuppeteerExtra( puppeteer || DEFAULT_PUPPETEER );
};

module.exports.devices = require( "./puppeteer/devices" );

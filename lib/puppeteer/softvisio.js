const { PuppeteerExtraPlugin } = require( "puppeteer-extra-plugin" );
const ProxyServer = require( "../proxy/server" );
const fs = require( "../fs" );

const DEVICES = fs.config.read( __dirname + "/../../resources/puppeteer-devices.yaml" );

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
    "--no-zygote",
    "--single-process",
    "--disable-gpu",
    "--enable-tcp-fast-open", // https://wiki.mikejung.biz/Chrome#Enable_Chrome_TCP_Fast_Open_.28Linux_.2F_Android_Only.29
    "--enable-async-dns", // https://wiki.mikejung.biz/Chrome#Enforce_Async_DNS_with_Chrome
];

var DEFAULT_TIMEZONE;

async function getDefaultTimezone () {
    if ( DEFAULT_TIMEZONE == null ) {
        const fetch = require( "../http/fetch" );
        const IPAddr = require( "../ip-addr" );

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

class SoftvisioPlugin extends PuppeteerExtraPlugin {
    constructor ( options = {} ) {
        super( options );
    }

    get name () {
        return "softvisio";
    }

    async beforeLaunch ( options ) {
        if ( !options.args ) options.args = [];

        // add default args
        options.args.push( ...DEFAULT_ARGS );

        // have viewport match window size, unless specified by user, https://github.com/GoogleChrome/puppeteer/issues/3688
        if ( !( "defaultViewport" in options ) ) {
            options.defaultViewport = null;
        }

        if ( !( "executablePath" in options ) && process.platform === "linux" ) {
            options.executablePath = "google-chrome-stable"; // chromium-browser
        }

        // set default headless mode
        if ( !( "headless" in options ) ) {
            options.headless = process.platform === "win32" ? false : true;
        }

        // resolve device name
        const device = typeof options.device === "string" ? DEVICES[options.device] : options.device;

        // set browser window dimensions
        if ( options.headless && device && device.windowSize ) {
            options.args.push( `--window-size=${device.windowSize[0]},${device.windowSize[1]}` );
        }

        if ( options.proxy ) {
            options.proxyServer = new ProxyServer( { "proxy": options.proxy } );

            await options.proxyServer.listen();

            options.args.push( `--proxy-server=${options.proxyServer.chromeConnectUrl}` );
        }

        return options;
    }

    async afterLaunch ( browser, options ) {

        // resolve device name
        browser.device = typeof options.options.device === "string" ? DEVICES[options.options.device] : options.options.device;

        browser.timezone = options.options.timezone;

        // close proxy server
        if ( options.options.proxyServer ) {
            browser.proxyServer = options.options.proxyServer;

            browser.once( "disconnected", () => {
                browser.proxyServer.close();
            } );
        }
    }

    async onPageCreated ( page ) {
        const browser = page.browser();

        // emulate timezone
        if ( browser.timezone ) {
            let timezone;

            if ( typeof browser.timezone === "string" ) {
                timezone = browser.timezone;
            }
            else if ( browser.proxyServer && browser.proxyServer.proxy ) {
                const ip = await browser.proxyServer.proxy.getRemoteAddr();

                if ( ip && ip.geo ) timezone = ip.geo.location.time_zone;
            }
            else {
                timezone = await getDefaultTimezone();
            }

            if ( timezone ) await page.emulateTimezone( timezone );
        }

        const device = browser.device || {};

        // override user agent
        const override = {
            "acceptLanguage": "en-US,en",
        };

        if ( device.userAgent ) {
            override.userAgent = device.userAgent;
        }

        // modify default user agent
        else {
            override.userAgent = await page.browser().userAgent();

            override.userAgent = override.userAgent.replace( "HeadlessChrome/", "Chrome/" );

            if ( device.userAgentPlatform ) {
                override.userAgent = override.userAgent.replace( /\(.+?\)/, `(${device.userAgentPlatform})` );
            }
        }

        if ( device.platform ) override.platform = device.platform;

        page._client.send( "Network.setUserAgentOverride", override );

        // set viewport
        if ( device.viewport ) {
            await page.setViewport( device.viewport );
        }
    }
}

module.exports = SoftvisioPlugin;

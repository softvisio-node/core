const { PuppeteerExtraPlugin } = require( "puppeteer-extra-plugin" );
const ProxyServer = require( "../proxy/server" );

// NOTE
// flags explained: https://peter.sh/experiments/chromium-command-line-switches/
// default flags: https://github.com/puppeteer/puppeteer/blob/master/lib/Launcher.js#L269
// AWS Lambda flags: https://github.com/alixaxel/chrome-aws-lambda/blob/10feb8d162626d34aad2ee1e657f20956f53fe11/source/index.js
const DEFAULT_ARGS = [
    "--start-maximized",
    "--no-default-browser-check",

    "--disable-notifications", // disables the Web Notification and the Push APIs
    // "--noerrdialogs", // TBD suppresses all error dialogs when present

    // security
    "--disable-web-security", // don't enforce the same-origin policy

    // performance
    "--no-sandbox",
    "--no-zygote",
    "--single-process",
    "--disable-gpu",
    "--enable-tcp-fast-open", // https://wiki.mikejung.biz/Chrome#Enable_Chrome_TCP_Fast_Open_.28Linux_.2F_Android_Only.29
    "--enable-async-dns", // https://wiki.mikejung.biz/Chrome#Enforce_Async_DNS_with_Chrome
];

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

        if ( !( "headless" in options ) ) {
            options.headless = process.platform === "win32" ? false : true;
        }

        if ( options.headless ) options.args.push( "--window-size=1280,720" ); // XXX 1366 x 768

        if ( options.proxy ) {
            options.proxyServer = new ProxyServer( { "proxy": options.proxy } );

            await options.proxyServer.listen();

            options.args.push( `--proxy-server=${options.proxyServer.chromeConnectUrl}` );
        }

        return options;
    }

    async afterLaunch ( browser, options ) {
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
        if ( browser.timezone ) await page.emulateTimezone( browser.timezone );

        // override user agent
        const override = {
            "userAgent": ( await page.browser().userAgent() ).replace( "HeadlessChrome/", "Chrome/" ).replace( /\(X11; Linux x86_64\)/, "(Windows NT 10.0; Win64; x64)" ),
            "acceptLanguage": "en-US,en",
            "platform": "Win32",
        };

        page._client.send( "Network.setUserAgentOverride", override );
    }
}

module.exports = SoftvisioPlugin;

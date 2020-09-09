const ProxyServer = require( "./proxy/server" );
const puppeteer = require( "puppeteer" );

// NOTE
// flags explained: https://peter.sh/experiments/chromium-command-line-switches/
// default flags: https://github.com/puppeteer/puppeteer/blob/master/lib/Launcher.js#L269
// AWS Lambda flags: https://github.com/alixaxel/chrome-aws-lambda/blob/10feb8d162626d34aad2ee1e657f20956f53fe11/source/index.js
const DEFAULT_ARGS = [
    "--window-size=1920,1080",
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

    // "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.122 Safari/537.36",
];

module.exports = puppeteer;

puppeteer._launch = puppeteer.launch;

// https://pptr.dev/#?product=Puppeteer&version=v5.2.1&show=api-puppeteerlaunchoptions
puppeteer.launch = async function ( options = {} ) {
    options = {
        "headless": process.platform === "win32" ? false : true,
        "ignoreHTTPSErrors": false,
        "defaultViewport": null,
        "executablePath": process.platform === "linux" ? "google-chrome-stable" : null, // chromium-browser
        ...options,
    };

    if ( !options.args ) options.args = [];

    options.args.push( ...DEFAULT_ARGS );

    let proxyServer;

    if ( options.proxy ) {
        proxyServer = new ProxyServer( { "proxy": options.proxy } );

        await proxyServer.listen();

        options.args.push( `--proxy-server=${proxyServer.chromeConnectUrl}` );
    }

    const browser = await puppeteer._launch( options );

    browser.proxyServer = proxyServer;

    return browser;
};

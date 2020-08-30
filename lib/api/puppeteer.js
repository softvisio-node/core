const ProxyServer = require( "../proxy/server" );
const puppeteer = require( "puppeteer" );

module.exports = { ...puppeteer };

module.exports.launch = async function ( options = {} ) {
    options = {
        "headless": process.platform === "win32" ? false : true,
        "defaultViewport": null,
        "executablePath": process.platform === "linux" ? "google-chrome-stable" : null, // chromium-browser
        ...options,
    };

    if ( !options.args ) options.args = [];

    options.args.push( ...[

        //
        "--start-maximized",
        "--no-default-browser-check",
        "--no-sandbox",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.122 Safari/537.36",
    ] );

    let proxyServer;

    if ( options.proxy ) {
        proxyServer = new ProxyServer( { "proxy": options.proxy } );

        await proxyServer.listen();

        options.args.push( `--proxy-server=${proxyServer.chromeConnectUrl}` );
    }

    const browser = await puppeteer.launch( options );

    browser.proxy = proxyServer;

    return browser;
};

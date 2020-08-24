const ProxyServer = require( "../proxy/server" );
const puppeteer = require( "puppeteer" );

module.exports.launch = async function ( options = {} ) {
    options = {
        "headless": true,
        "defaultViewport": null,
        ...options,
    };

    if ( !options.args ) options.args = [];

    options.args.push( "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.122 Safari/537.36", "--start-maximized", "--no-default-browser-check", "--no-sandbox" );

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

var playwright;

try {
    playwright = require( "playwirght" );
}
catch ( e ) {
    playwright = require( "playwright-chromium" );
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

module.exports = playwright;

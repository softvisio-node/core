var playwright;

try {
    playwright = require( "playwright-core" );
}
catch ( e ) {
    try {
        playwright = require( "playwright-chromium" );
    }
    catch ( e ) {
        playwright = require( "playwright" );
    }
}

playwright.devices = require( "../devices" );

module.exports = playwright;

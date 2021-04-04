var playwright;

try {
    playwright = require( "playwirght" );
}
catch ( e ) {
    playwright = require( "playwright-chromium" );
}

playwright.devices = require( "../devices" );

module.exports = playwright;

const { PuppeteerExtraPlugin } = require( "puppeteer-extra-plugin" );

class SoftvisioTimezonePlugin extends PuppeteerExtraPlugin {
    get name () {
        return "timezone";
    }

    onPageCreated ( page ) {

        // await page.emulateTimezone( null );
        page.emulateTimezone( this.opts.timezone );
    }
}

module.exports = options => new SoftvisioTimezonePlugin( options );

const { PuppeteerExtraPlugin } = require( "puppeteer-extra-plugin" );

class SoftvisioTimezonePlugin extends PuppeteerExtraPlugin {
    get name () {
        return "timezone";
    }

    onPageCreated ( page ) {
        page.emulateTimezone( this.opts.timezone );
    }
}

module.exports = options => new SoftvisioTimezonePlugin( options );

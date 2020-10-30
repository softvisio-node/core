const MaxThreads = require( "../../threads/mixins/max-threads" );
const puppeteer = require( "../../puppeteer" );
const _proxy = require( "../../proxy" );
const result = require( "../../result" );
const { confirm } = require( "../../util" );
const googleDomains = require( "../../db/google-domains" );
const { "v1": uuidv1 } = require( "uuid" );
const fs = require( "fs" );

const RESULTS_PER_PAGE = 100;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT = 1000 * 60;

module.exports = class GoogleSerp extends MaxThreads() {
    #debug;
    #proxy;
    #captcha;
    #maxRetries = DEFAULT_MAX_RETRIES;
    #persistent;
    #profilesPath;

    #profiles;
    #browsers = [];
    #destroyed;

    constructor ( options = {} ) {
        super();

        this.maxThreads = options.maxThreads || 3;
        this.#debug = options.debug;
        this.#persistent = options.persistent;
        this.#profilesPath = options.profilesPath;
        this.proxy = options.proxy;
        this.captcha = options.captcha;
    }

    get destroyed () {
        return this.#destroyed;
    }

    // XXX update proxy on all browsers???
    set proxy ( proxy ) {
        this.#proxy = proxy;
    }

    set captcha ( captcha ) {
        this.#captcha = captcha;
    }

    async destroy () {
        if ( this.#destroyed ) return;

        this.#destroyed = true;

        if ( !this.#persistent ) return;

        for ( const browser of this.#browsers ) {
            await browser.close();
        }

        this.#browsers = null;
    }

    // options:
    // country: iso2 country code
    // max: 1 - 1000, default: 100
    async getGoogleSearchResults ( keyword, options ) {
        return this.runThread( "_threadGetGoogleSearchResults", keyword, options );
    }

    // options same as for getGoogleSearchResults
    async getGoogleSearchPosition ( keyword, url, options ) {
        var origHost;

        try {
            origHost = new URL( url ).host;
        }
        catch ( e ) {
            return result( [500, e.message || e] );
        }

        const serp = await this._threadGetGoogleSearchResults( keyword, options );

        if ( !serp.ok ) return serp;

        for ( const item of serp.data ) {
            let urlHost;

            try {
                urlHost = new URL( item.url ).host;
            }
            catch ( e ) {
                continue;
            }

            if ( origHost === urlHost ) return result( 200, item );
        }

        return result( 404 );
    }

    // XXX
    async getGoogleMapsResults ( keyword, options ) {
        return this.runThread( "_threadGetGoogleMapsResults", keyword, options );
    }

    // XXX
    async getGoogleMapsPosition ( keyword, options ) {}

    // XXX repeat on navigation errors
    async _threadGetGoogleSearchResults ( keyword, options = {} ) {
        const host = this._getGoogleDomain( options.country ).domain,
            max = options.max || 100;

        // get browser page instance
        const page = await this._getPage( options.country, options.coordinates );

        // use precise location
        const res = await this._setGooglePreciseLocation( page, options.country, options.coordinates );
        if ( !res.ok ) return await this._onFinishRequest( page, res );

        var start = 0,
            pos = 0,
            data = [];

        // get serp results
        while ( 1 ) {

            // compose url
            const url =
                `https://www.${host}/search?` +
                new URLSearchParams( {
                    "q": keyword,
                    "hl": "en",
                    start,
                    "num": RESULTS_PER_PAGE,
                } ).toString();

            // open url
            await page.goto( url );

            // check captcha
            const res = await this._checkCaptcha( page );
            if ( !res.ok ) return await this._onFinishRequest( page, res );

            // detect empty results
            const resultStatsEl = await page.$( "div#result-stats" );

            // no search result
            if ( !resultStatsEl ) break;

            // parse serp results
            let serp;

            try {
                serp = await page.$$eval( "div.rc",
                    ( items, pos ) => {
                        var data = [];

                        for ( const item of items ) {
                            const r = {
                                "pos": ++pos,
                            };

                            var a = item.querySelector( "div.yuRUbf > a" );

                            r.url = a.getAttribute( "href" );

                            r.title = a.querySelector( "h3" ).textContent;

                            r.desc = item.querySelector( "span.aCOpRe" ).textContent;

                            data.push( r );
                        }

                        return data;
                    },
                    pos );
            }
            catch ( e ) {

                // serp parsing error
                return await this._onFinishRequest( page, result( [500, "Google serp parsing error"] ) );
            }

            // serp parser returned no results
            if ( !serp.length ) await this._onFinishRequest( page, result( [500, "Google serp parsing error"] ) );

            data.push( ...serp );
            pos += serp.length;

            // all required results collected
            if ( data.length >= max ) {

                // cut results
                if ( data.length > max ) data = data.slice( 0, max );

                break;
            }

            // get next page element
            const nextPageEl = await page.$( "a#pnnext" );

            // max page reached
            if ( !nextPageEl ) break;

            // goto next page
            start += RESULTS_PER_PAGE;
        }

        return await this._onFinishRequest( page, result( 200, data ) );
    }

    // XXX repeat on navigation errors
    // XXX skip ads
    // XXX check empty results
    async _threadGetGoogleMapsResults ( keyword, options = {} ) {
        const host = this._getGoogleDomain( options.country ).domain,
            max = options.max || 100;

        var pos = 0,
            data = [];

        // get browser page instance
        const page = await this._getPage( options.country, options.coordinates );

        // use precise location
        var res = await this._setGooglePreciseLocation( page, options.country, options.coordinates );
        if ( !res.ok ) return await this._onFinishRequest( page, res );

        const url = `https://www.${host}/maps/search/` + encodeURIComponent( keyword ) + "?hl=en";

        await page.goto( url );

        // check captcha
        res = await this._checkCaptcha( page );
        if ( !res.ok ) this._onFinishRequest( page, res );

        while ( 1 ) {

            // detect empty results
            if ( await page.$( "div.section-bad-query-title" ) ) break;

            let serp;

            // parse results
            try {
                serp = await page.$$eval( "div.section-result-content",
                    ( items, pos ) => {
                        var data = [];

                        for ( const item of items ) {

                            // XXX skip ads
                            // if ( item.querySelector( "span.gghBu" ) ) continue;

                            const r = {
                                "pos": ++pos,
                            };

                            var name = item.querySelector( "h3" ).textContent;
                            r.name = name;

                            data.push( r );
                        }

                        return data;
                    },
                    pos );
            }
            catch ( e ) {

                // results parsing error
                return await this._onFinishRequest( page, result( [500, "Google serp parsing error"] ) );
            }

            // serp parser returned no results
            if ( !serp.length ) await this._onFinishRequest( page, result( [500, "Google serp parsing error"] ) );

            data.push( ...serp );
            pos += serp.length;

            // all required results collected
            if ( data.length >= max ) {

                // cut results
                if ( data.length > max ) data = data.slice( 0, max );

                break;
            }

            // get next page element
            const nextPageEl = await page.$( `button[aria-label=" Next page "]` );

            // no next page el found
            if ( !nextPageEl ) break;

            // clicks next page
            await nextPageEl.click();
        }

        return await this._onFinishRequest( page, result( 200, data ) );
    }

    async _onFinishRequest ( page, res ) {
        if ( this.#debug ) await confirm( "Close page?", ["y"] );

        const browser = page.browser();

        if ( this.#persistent && !this.destroyed ) {
            await page.close();

            this.#browsers.push( browser );
        }
        else {
            await browser.close();
        }

        return res;
    }

    _getProfile () {
        if ( !this.#profilesPath ) return;

        if ( !this.#profiles ) {
            this.#profiles = [];

            if ( !fs.existsSync( this.#profilesPath ) ) {
                fs.mkdirSync( this.#profilesPath, { "recursive": true } );
            }
            else {
                const profiles = fs.readdirSync( this.#profilesPath, { "withFileTypes": true } );

                this.#profiles = profiles.filter( dirent => dirent.isDirectory() ).map( dirent => this.#profilesPath + "/" + dirent.name );
            }
        }

        if ( this.#profiles.length ) {
            return this.#profiles.shift();
        }
        else {
            return this.#profilesPath + "/" + uuidv1();
        }
    }

    // XXX do we need to set timezone???
    async _getBrowser () {
        var browser;

        // get browser from the pool
        if ( this.#persistent ) browser = this.#browsers.shift();

        if ( browser ) return browser;

        // create new browser instance
        browser = await puppeteer().launch( {
            "userDataDir": this._getProfile(),
            "proxy": this.#proxy ? _proxy( this.#proxy ) : true,
            "timezone": false,
            "stealth": true,
            "device": puppeteer.devices.windows10(),
        } );

        return browser;
    }

    async _getPage ( country, coordinates ) {
        const browser = await this._getBrowser();

        const domain = this._getGoogleDomain( country );

        // set proxy server country
        if ( browser.proxyServer.proxy ) browser.proxyServer.proxy.country = domain.country.iso2;

        const page = await browser.newPage();

        // set default timeouts
        await page.setDefaultNavigationTimeout( DEFAULT_TIMEOUT );
        await page.setDefaultTimeout( DEFAULT_TIMEOUT );

        // disable images
        if ( !this.#debug ) await this._disablePageImages( page );

        return page;
    }

    async _disablePageImages ( page ) {

        // disable images
        await page.setRequestInterception( true );

        page.on( "request", req => {
            if ( req.resourceType() === "image" ) {
                req.abort();
            }
            else {
                req.continue();
            }
        } );
    }

    async _setGooglePreciseLocation ( page, country, coordinates ) {
        const domain = this._getGoogleDomain( country );

        // enable geolocation for google domain
        await page.browserContext().overridePermissions( `https://www.${domain.domain}/`, ["geolocation"] );

        // emulate geolocation coordinates
        if ( !coordinates ) coordinates = domain.country.coordinates;
        if ( coordinates ) await page.setGeolocation( coordinates );

        // try to open google search page
        let attempt = 0;
        while ( 1 ) {
            if ( ++attempt > this.#maxRetries ) return result( [500, "Unable to open google search page"] );

            try {
                await page.goto( `https://www.${domain.domain}/search?q=+&hl=en` );

                break;
            }
            catch ( e ) {
                continue;
            }
        }

        var res = await this._checkCaptcha( page );
        if ( !res.ok ) return res;

        // find and click on "Use precise location link"
        res = await page.$eval( "#eqQYZc", el => {
            el.click();

            return true;
        } );

        // unable to click "Use precise location link", possible selector error
        if ( !res ) return result( [500, "Unable to set location"] );

        return result( 200 );
    }

    _getGoogleDomain ( country ) {
        return googleDomains.get( country || "WORLDWIDE" );
    }

    async _checkCaptcha ( page ) {
        var attempt = 0;

        while ( 1 ) {
            const resUrl = page.url();

            // request is not blocked
            if ( resUrl.indexOf( "/sorry/index" ) === -1 ) return result( 200 );

            // captcha or banned, max retries reached, return error
            if ( !this.#captcha || ++attempt > this.#maxRetries ) return result( [500, "Unable to get serp, max retries reached"] );

            // get captcha params
            const siteKey = await page.$eval( "#recaptcha", el => el.getAttribute( "data-sitekey" ) );
            const datas = await page.$eval( "#recaptcha", el => el.getAttribute( "data-s" ) );
            const callback = await page.$eval( "#recaptcha", el => el.getAttribute( "data-callback" ) );

            // captcha params error
            if ( !siteKey || !datas || !callback ) return result( [500, "Captcha params error"] );

            // resolve captcha
            const c = await this.#captcha.resolveInvisibleReCaptchaV2( siteKey, resUrl, { datas } );

            // captcha resolve error, try again
            if ( !c.ok ) continue;

            // send captcha
            await page.evaluate( ( callback, captchaResult ) => {
                var input = document.getElementById( "g-recaptcha-response" );

                input.value = captchaResult;

                window[callback]();
            },
            callback,
            c.data );

            // wait for page load
            await page.waitForNavigation( { "waitUntil": "domcontentloaded" } );
        }
    }
};

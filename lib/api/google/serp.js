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

        const onFinish = async res => {
            if ( this.#debug ) await confirm( "Close page?", ["y"] );

            await this._onFinishRequest( page );

            return res;
        };

        var start = 0,
            pos = 0,
            data = [];

        // get serp results
        while ( 1 ) {
            const url =
                `https://www.${host}/search?` +
                new URLSearchParams( {
                    "q": keyword,
                    "hl": "en",
                    start,
                    "num": RESULTS_PER_PAGE,
                } ).toString();

            let attempt = 1;

            await page.goto( url );

            // process serp page
            while ( 1 ) {
                const resUrl = page.url();

                // request is not blocked
                if ( resUrl.indexOf( "/sorry/index" ) === -1 ) break;

                // captcha or banned, max retries reached, return error
                if ( !this.#captcha || ++attempt > this.#maxRetries ) return await onFinish( result( [500, "Unable to get serp, max retries reached"] ) );

                // get captcha params
                const siteKey = await page.$eval( "#recaptcha", el => el.getAttribute( "data-sitekey" ) );
                const datas = await page.$eval( "#recaptcha", el => el.getAttribute( "data-s" ) );
                const callback = await page.$eval( "#recaptcha", el => el.getAttribute( "data-callback" ) );

                // captcha params error
                if ( !siteKey || !datas || !callback ) return await onFinish( result( [500, "Captcha params error"] ) );

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

                // serp parser returned no results, throw error
                if ( !serp.length ) throw `No results found`;
            }
            catch ( e ) {

                // serp parsing error
                return await onFinish( result( [500, "Google serp parsing error"] ) );
            }

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

        return await onFinish( result( 200, data ) );
    }

    // XXX repeat on navigation errors
    async _threadGetGoogleMapsResults ( keyword, options = {} ) {
        const host = this._getGoogleDomain( options.country ).domain;

        // max = options.max || 100;

        // get browser page instance
        const page = await this._getPage( options.country, options.coordinates );

        var url = `https://www.${host}/maps/search/` + encodeURIComponent( keyword ) + "?hl=en";

        await page.goto( url );

        return this._onFinishRequest( page, result( 200 ) );
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
        await this._disablePageImages( page );

        // use precise location
        await this._setGooglePreciseLocation( page, country, coordinates );

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

    // XXX detect captcha, handle navigation errors
    // XXX use default country coordinates
    async _setGooglePreciseLocation ( page, country, coordinates ) {
        const domain = this._getGoogleDomain( country );

        // enable geolocation for google domain
        await page.browserContext().overridePermissions( `https://www.${domain.domain}/`, ["geolocation"] );

        // emulate geolocation coordinates
        // XXX use default country coordinates
        if ( coordinates ) await page.setGeolocation( coordinates );

        await page.goto( `https://www.${domain.domain}/search?q=+&hl=en` );

        await page.$eval( "#eqQYZc", el => {
            el.click();
        } );
    }

    _getGoogleDomain ( country ) {
        return googleDomains.get( country || "WORLDWIDE" );
    }
};

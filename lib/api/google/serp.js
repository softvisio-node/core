const MaxThreads = require( "../../threads/mixins/max-threads" );
const puppeteer = require( "../../puppeteer" );
const _proxy = require( "../../proxy" );
const result = require( "../../result" );
const { confirm, sleep } = require( "../../util" );
const googleDomains = require( "../../db/google-domains" );
const { "v1": uuidv1 } = require( "uuid" );
const fs = require( "fs" );

const RESULTS_PER_PAGE = 100;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT = 1000 * 60;

module.exports = class GoogleSerp extends MaxThreads() {
    #debug;
    #disableImages = true;
    #proxy;
    #resolveCaptcha = false;
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
        if ( "resolveCaptcha" in options ) this.resoveCaptcha = options.resolveCaptcha;
        if ( "disableImages" in options ) this.disableImages = options.disableImages;
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

    get resolveCaptcha () {
        return this.#resolveCaptcha;
    }

    set resolveCaptcha ( resolveCaptcha ) {
        if ( resolveCaptcha ) {
            this.#resolveCaptcha = true;
        }
        else {
            this.#resolveCaptcha = false;
        }
    }

    get disableImages () {
        return this.#disableImages;
    }

    set disableImages ( disableImages ) {
        if ( disableImages ) {
            this.#disableImages = true;
        }
        else {
            this.#disableImages = false;
        }
    }

    async destroy () {
        if ( this.#destroyed ) return;

        this.#destroyed = true;

        if ( !this.#persistent ) return;

        for ( const browser of this.#browsers ) {
            try {
                await browser.close();
            }
            catch ( e ) {}
        }

        this.#browsers = null;
    }

    async getGoogleSearchResults ( keyword, options ) {
        return this.runThread( "_threadGetGoogleSearchResults", keyword, options );
    }

    async getGoogleMapsResults ( keyword, options ) {
        return this.runThread( "_threadGetGoogleMapsResults", keyword, options );
    }

    // options:
    // url
    // max: 1 - 1000, default - 100
    // country
    // coordinates: { latitude, longitude }
    // emulateUser: bool
    // device:
    // async onTargetFound(page)
    // XXX check for "Before you continue" modal dialog present
    async _threadGetGoogleSearchResults ( keyword, options = {} ) {
        const googleDomain = this._getGoogleDomain( options.country ),
            max = options.max || 100;

        // prepare target url
        var target;
        try {
            target = options.url ? new URL( options.url ).host : null;
        }
        catch ( e ) {
            return result( [500, "Target url is invalid"] );
        }

        // get browser page instance
        const page = await this._getPage( options.country, options.coordinates, options.device );

        // set location
        await this._setGooglePreciseLocation( page, options.country, options.coordinates );

        // open google
        try {
            await page.goto( `https://www.${googleDomain.domain}/?hl=en&num=${RESULTS_PER_PAGE}`, { "waitUntil": "load" } );
        }
        catch ( e ) {
            return this._onFinish( page, result( [500, "Navigation error"] ) );
        }

        // check captcha
        var res = await this._checkCaptcha( page );
        if ( !res.ok ) return this._onFinish( page, res );

        // find query selector
        var el = await page.$( 'input[name="q"]' );
        if ( !el ) return this._onFinish( page, result( [500, "Google query selector not found"] ) );

        // type query
        await el.focus();
        await el.type( keyword + "\r", { "delay": options.emulateUser ? 100 : 0 } );
        try {
            await page.waitForNavigation( { "waitUntil": "load" } );
        }
        catch ( e ) {
            return this._onFinish( page, result( [500, "Navigation error"] ) );
        }

        // check captcha
        res = await this._checkCaptcha( page );
        if ( !res.ok ) return this._onFinish( page, res );

        // check for "Before you continue" modal dialog present
        // XXX
        // el = await page.$( "span.RveJvd.snByac" );
        // if ( el ) await el.click();

        const data = [];
        let pos = 0;

        // parse results page
        PAGE: while ( 1 ) {

            // detect empty results
            if ( !( await page.$( "div#result-stats" ) ) ) return this._onFinish( page, result( [404, "No results found"] ) );

            // find results elements
            const els = await page.$$( "div.rc" );

            // no results elements found, this is selectors error
            if ( !els ) return this._onFinish( page, result( [500, "Search results selector not found"] ) );

            for ( const el of els ) {

                // skip ads
                // if ( await el.$( "span.gghBu" ) ) continue;

                // parse element
                const targetData = {
                    "pos": ++pos,
                    "title": await this._getTextContent( el, "h3" ),
                    "desc": await this._getTextContent( el, "span.aCOpRe" ),
                    "url": await this._getHref( el, "div.yuRUbf > a" ),
                };

                if ( !targetData.title ) return this._onFinish( page, result( [500, "Title selector not found"] ) );

                // NOTE not all sites has valid description
                // if ( !targetData.desc ) return this._onFinish( page, result( [500, "Desc selector not found"] ) );
                if ( !targetData.url ) return this._onFinish( page, result( [500, "Url selector not found"] ) );

                if ( options.emulateUser ) {
                    await el.hover();
                    await sleep( 500 );
                }

                // target business found
                TARGET: if ( target ) {

                    // parse url
                    let targetHost;
                    try {
                        targetHost = new URL( targetData.url ).host;
                    }
                    catch ( e ) {

                        // skip bad urls
                        break TARGET;
                    }

                    if ( target !== targetHost ) break TARGET;

                    if ( options.onTargetFound ) {
                        await el.hover();
                        await el.click();
                        try {
                            await page.waitForNavigation( { "waitUntil": "domcontentloaded" } );
                        }
                        catch ( e ) {
                            return this._onFinish( page, result( [500, "Navigation error"] ) );
                        }

                        res = await options.onTargetFound( page );

                        res.data = res.data ? { ...res.data, ...targetData } : targetData;

                        return this._onFinish( page, res );
                    }
                    else {
                        return this._onFinish( page, result( 200, targetData ) );
                    }
                }

                data.push( targetData );

                // all required results retrieved
                if ( data.length >= max ) break PAGE;
            }

            // find next page button
            const next = await page.$( "a#pnnext" );

            // next page button not found
            if ( !next ) break;

            // click next page
            await next.click();

            // wait for next page load
            try {
                await page.waitForNavigation( { "waitUntil": "load" } );
            }
            catch ( e ) {
                return this._onFinish( page, result( [500, "Navigation error"] ) );
            }
        }

        if ( target ) return this._onFinish( page, result( [404, "No results found"] ) );
        else return this._onFinish( page, result( 200, data ) );
    }

    // options:
    // name
    // max: 1 - 200, default - 100
    // country
    // coordinates: { latitude, longitude }
    // emulateUser: bool
    // device
    // async onTargetFound(page)
    // XXX check for "Before you continue" modal dialog present
    async _threadGetGoogleMapsResults ( keyword, options = {} ) {
        const googleDomain = this._getGoogleDomain( options.country ),
            max = options.max || 100,
            target = options.name ? options.name.toLowerCase() : null;

        // get browser page instance
        const page = await this._getPage( options.country, options.coordinates, options.device );

        // set location
        await this._setGooglePreciseLocation( page, options.country, options.coordinates );

        // open google
        try {
            await page.goto( `https://www.${googleDomain.domain}/?hl=en`, { "waitUntil": "load" } );
        }
        catch ( e ) {
            return this._onFinish( page, result( [500, "Navigation error"] ) );
        }

        // check captcha
        var res = await this._checkCaptcha( page );
        if ( !res.ok ) return this._onFinish( page, res );

        // find query selector
        var el = await page.$( 'input[name="q"]' );
        if ( !el ) return this._onFinish( page, result( [500, "Google query selector not found"] ) );

        // type query
        await el.focus();
        await el.type( keyword + "\r", { "delay": options.emulateUser ? 100 : 0 } );
        try {
            await page.waitForNavigation( { "waitUntil": "load" } );
        }
        catch ( e ) {
            return this._onFinish( page, result( [500, "Navigation error"] ) );
        }

        // check captcha
        res = await this._checkCaptcha( page );
        if ( !res.ok ) return this._onFinish( page, res );

        // check for "Before you continue" modal dialog present
        // XXX
        // el = await page.$( "span.RveJvd.snByac" );
        // if ( el ) await el.click();

        // find gmap results
        el = await page.$( "g-more-link" );
        if ( !el ) return this._onFinish( page, result( [404, "No results found"] ) );

        // open gmap
        await el.hover();
        await el.click();
        try {
            await page.waitForNavigation( { "waitUntil": "domcontentloaded" } );
        }
        catch ( e ) {
            return this._onFinish( page, result( [500, "Navigation error"] ) );
        }

        // detect empty results
        if ( await page.$( "div.section-bad-query-title" ) ) return this._onFinish( page, result( [404, "No results found"] ) );

        const data = [];
        let pos = 0;

        // parse results page
        PAGE: while ( 1 ) {

            // find results elements
            const els = await page.$$( "div.VkpGBb" );

            // no results elements found, this is selectors error
            if ( !els ) return this._onFinish( page, result( [500, "Search results selector not found"] ) );

            for ( const el of els ) {

                // skip ads
                if ( await el.$( "span.gghBu" ) ) continue;

                // find business name
                const name = await this._getTextContent( el, `div[role="heading"]` );

                // unable to find business name
                if ( !name ) return this._onFinish( page, result( [500, "Business name selector not found"] ) );

                // find clickToWebsite element
                let urlEl, url;

                // get target site url
                if ( ( urlEl = await el.$( `a.yYlJEf.L48Cpd` ) ) ) {
                    url = await urlEl.evaluate( el => el.getAttribute( "href" ) );
                }

                const targetData = {
                    "pos": ++pos,
                    name,
                    url,
                };

                if ( options.emulateUser ) {
                    await el.hover();
                    await sleep( 500 );
                }

                // target business found
                if ( target && target === targetData.name.toLowerCase() ) {
                    if ( options.onTargetFound ) {
                        if ( !urlEl ) return this._onFinish( page, result( [500, "Target site url not found"] ) );

                        await urlEl.hover();
                        await urlEl.click();
                        try {
                            await page.waitForNavigation( { "waitUntil": "domcontentloaded" } );
                        }
                        catch ( e ) {
                            return this._onFinish( page, result( [500, "Navigation error"] ) );
                        }

                        res = await options.onTargetFound( page );

                        res.data = res.data ? { ...res.data, ...targetData } : targetData;

                        return this._onFinish( page, res );
                    }
                    else {
                        return this._onFinish( page, result( 200, targetData ) );
                    }
                }

                data.push( targetData );

                // all required results retrieved
                if ( data.length >= max ) break PAGE;
            }

            // find next page button
            const next = await page.$( "#pnnext" );

            // next page button not found
            if ( !next ) break;

            // click next page
            await next.click();

            // wait for next page load
            try {
                await page.waitForSelector( "div.rlfl__loading-overlay", { "hidden": true } );

                // give time to render new elements
                await sleep( 3000 );
            }
            catch ( e ) {
                return this._onFinish( page, result( [500, "Navigation error"] ) );
            }
        }

        if ( target ) return this._onFinish( page, result( [404, "No results found"] ) );
        else return this._onFinish( page, result( 200, data ) );
    }

    async _getTextContent ( el, selector ) {
        return el.evaluate( ( el, selector ) => {
            el = el.querySelector( selector );

            if ( el ) return el.textContent;

            return null;
        }, selector );
    }

    async _getHref ( el, selector ) {
        return el.evaluate( ( el, selector ) => {
            el = el.querySelector( selector );

            if ( el ) return el.getAttribute( "href" );

            return null;
        }, selector );
    }

    async _onFinish ( page, res ) {
        if ( this.#debug ) await confirm( "Close page?", ["y"] );

        const browser = page.browser();

        // close page
        await page.close();

        // close browser
        if ( this.#persistent && !this.destroyed ) {
            this.#browsers.push( browser );
        }
        else {
            await browser.close();
        }

        // copy traffic counters to result
        const stat = browser.proxyServer.endSession();
        res.bytesWritten = stat.bytesWritten;
        res.bytesRead = stat.bytesRead;

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

    async _getBrowser ( device ) {
        var browser;

        // get browser from the pool
        if ( this.#persistent ) browser = this.#browsers.shift();

        if ( browser ) return browser;

        // create new browser instance
        browser = await puppeteer().launch( {
            "userDataDir": this._getProfile(),
            "proxy": this.#proxy ? _proxy( this.#proxy ) : true,
            "timezone": true,
            "stealth": true,
            "device": device || puppeteer.devices.windows10(),
        } );

        return browser;
    }

    async _getPage ( country, coordinates, device ) {
        const browser = await this._getBrowser( device );

        // calc traffic
        browser.proxyServer.startSession();

        const domain = this._getGoogleDomain( country );

        // set proxy server country
        if ( browser.proxyServer.proxy ) browser.proxyServer.proxy.country = domain.country.iso2;

        const page = await browser.newPage();

        // set default timeouts
        await page.setDefaultNavigationTimeout( DEFAULT_TIMEOUT );
        await page.setDefaultTimeout( DEFAULT_TIMEOUT );

        // disable images
        await this._disablePageImages( page );

        return page;
    }

    async _disablePageImages ( page ) {
        if ( !this.disableImages ) return;

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
        if ( coordinates ) {
            const domain = this._getGoogleDomain( country );

            // enable geolocation for google domain
            await page.browserContext().overridePermissions( `https://www.${domain.domain}/`, ["geolocation"] );

            // emulate geolocation coordinates
            await page.setGeolocation( coordinates );
        }
        else {

            // coordinates = domain.country.coordinates;
            await page.browserContext().clearPermissionOverrides();
        }
    }

    async _checkCaptcha ( page ) {
        var attempt = 0;

        while ( 1 ) {
            const resUrl = page.url();

            // request is not blocked
            if ( resUrl.indexOf( "/sorry/index" ) === -1 ) return result( 200 );

            // captcha or banned, max retries reached, return error
            if ( !this.resolveCaptcha || !this.#captcha || ++attempt > this.#maxRetries ) return result( [500, "Request blocked by google"] );

            // get captcha params
            const params = await page.evaluate( () => {
                var el = document.querySelector( "#recaptcha" );

                if ( !el ) return;

                return {
                    "siteKey": el.getAttribute( "data-sitekey" ),
                    "datas": el.getAttribute( "data-s" ),
                    "callback": el.getAttribute( "data-callback" ),
                };
            } );

            // captcha params error
            if ( !params || !params.siteKey || !params.datas || !params.callback ) return result( [500, "Captcha params error"] );

            if ( this.#debug ) console.log( "Resolve captcha" );

            // resolve captcha
            const c = await this.#captcha.resolveInvisibleReCaptchaV2( params.siteKey, resUrl, { "datas": params.datas } );

            if ( this.#debug ) console.log( "Captcha: " + c );

            // captcha resolve error, try again
            if ( !c.ok ) continue;

            // send captcha
            await page.evaluate( ( callback, captchaResult ) => {
                var input = document.getElementById( "g-recaptcha-response" );

                input.value = captchaResult;

                window[callback]();
            },
            params.callback,
            c.data );

            // wait for page load
            try {
                await page.waitForNavigation( { "waitUntil": "load" } );
            }
            catch ( e ) {
                return result( [500, "Navigation error"] );
            }
        }
    }

    _getGoogleDomain ( country ) {
        return googleDomains.get( country || "WORLDWIDE" );
    }
};

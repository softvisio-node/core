const MaxThreads = require( "../../threads/mixins/max-threads" );
const puppeteer = require( "../../puppeteer" );
const _proxy = require( "../../proxy" );
const result = require( "../../result" );
const { confirm, sleep } = require( "../../util" );
const googleDomains = require( "../../db/google-domains" );
const timezones = require( "@softvisio/core/db/timezones" );

const RESULTS_PER_PAGE = 100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 1000 * 60;

module.exports = class GoogleSerp extends MaxThreads() {
    #debug;
    #timeout = DEFAULT_TIMEOUT;
    #disableImages = true;
    #proxy;
    #resolveCaptcha = false;
    #captcha;
    #maxRetries = DEFAULT_MAX_RETRIES;
    #persistent;

    #browsers = {};
    #destroyed;

    constructor ( options = {} ) {
        super();

        this.maxThreads = options.maxThreads || 3;
        this.#debug = options.debug;
        this.#persistent = options.persistent;
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

        for ( const id in this.#browsers ) {
            try {
                await this.#browsers[id].close();
            }
            catch ( e ) {}
        }

        this.#browsers = null;
    }

    // options:
    // url
    // max: 1 - 1000, default - 100
    // country
    // coordinates: { latitude, longitude }
    // emulateUser: bool
    // device:
    // async onTargetFound(page)
    async getGoogleSearchResults ( keyword, options ) {
        return this.runThread( "_threadGetGoogleSearchResults", keyword, options );
    }

    // options:
    // name
    // max: 1 - 200, default - 100
    // country
    // coordinates: { latitude, longitude }
    // emulateUser: bool
    // device
    // async onTargetFound(page)
    async getGoogleMapsResults ( keyword, options ) {
        return this.runThread( "_threadGetGoogleMapsResults", keyword, options );
    }

    async _threadGetGoogleSearchResults ( keyword, options = {} ) {

        // prepare target url
        var target;
        try {
            target = options.url ? new URL( options.url ).host : null;
        }
        catch ( e ) {
            return result( [500, "Target url is invalid"] );
        }

        var res,
            attempt = 0;

        while ( attempt++ < this.#maxRetries ) {

            // get browser page instance
            const page = await this._getPage( options.country, options.coordinates, options.device );

            try {
                res = await this.__threadGetGoogleSearchResults( page, target, keyword, options );
            }
            catch ( e ) {
                res = result( [500, e.message || e] );
            }

            // finish session
            await this._onFinish( page );

            // done
            if ( res.ok || res.status === 404 ) break;
        }

        return res;
    }

    async __threadGetGoogleSearchResults ( page, target, keyword, options = {} ) {
        const googleDomain = this._getGoogleDomain( options.country ),
            max = options.max || 100;

        // open google
        try {
            await page.goto( `https://www.${googleDomain.domain}/?hl=en&num=${RESULTS_PER_PAGE}`, { "waitUntil": "load" } );
        }
        catch ( e ) {
            return result( [500, "Navigation error"] );
        }

        // check captcha
        var res = await this._checkCaptcha( page );
        if ( !res.ok ) return res;

        // check banner
        res = await this._checkBanner( page );
        if ( !res.ok ) return res;

        // find query selector
        var el = await page.$( 'input[name="q"]' );
        if ( !el ) return result( [500, "Google query selector not found"] );

        // type query
        await el.focus();
        await el.type( keyword + "\r", { "delay": options.emulateUser ? 100 : 0 } );
        try {
            await page.waitForNavigation( { "waitUntil": "load" } );
        }
        catch ( e ) {
            return result( [500, "Navigation error"] );
        }

        // check captcha
        res = await this._checkCaptcha( page );
        if ( !res.ok ) return res;

        const data = [];
        let pos = 0;

        // parse results page
        PAGE: while ( 1 ) {

            // detect empty results
            if ( !( await page.$( "div#result-stats" ) ) ) return result( [404, "No results found"] );

            // find results elements
            const els = await page.$$( "div.rc" );

            // no results elements found, this is selectors error
            if ( !els ) return result( [500, "Search results selector not found"] );

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

                if ( !targetData.title ) return result( [500, "Title selector not found"] );

                // NOTE not all sites has valid description
                // if ( !targetData.desc ) return result( [500, "Desc selector not found"] );
                if ( !targetData.url ) return result( [500, "Url selector not found"] );

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
                            return result( [500, "Navigation error"] );
                        }

                        res = await options.onTargetFound( page );

                        res.data = res.data ? { ...res.data, ...targetData } : targetData;

                        return res;
                    }
                    else {
                        return result( 200, targetData );
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
                return result( [500, "Navigation error"] );
            }
        }

        if ( target ) return result( [404, "No results found"] );
        else return result( 200, data );
    }

    async _threadGetGoogleMapsResults ( keyword, options = {} ) {
        var res,
            attempt = 0;

        while ( attempt++ < this.#maxRetries ) {

            // get browser page instance
            const page = await this._getPage( options.country, options.coordinates, options.device );

            try {
                res = await this.__threadGetGoogleMapsResults( page, keyword, options );
            }
            catch ( e ) {
                res = result( [500, e.message || e] );
            }

            // finish session
            await this._onFinish( page );

            // done
            if ( res.ok || res.status === 404 ) break;
        }

        return res;
    }

    // XXX page.goto() not returned if unable to load page
    async __threadGetGoogleMapsResults ( page, keyword, options = {} ) {
        const googleDomain = this._getGoogleDomain( options.country ),
            max = options.max || 100,
            target = options.name ? options.name.toLowerCase() : null;

        // open google
        try {
            await page.goto( `https://www.${googleDomain.domain}/?hl=en`, { "waitUntil": "load" } );
        }
        catch ( e ) {
            return result( [500, "Navigation error"] );
        }

        // check captcha
        var res = await this._checkCaptcha( page );
        if ( !res.ok ) return res;

        // check banner
        res = await this._checkBanner( page );
        if ( !res.ok ) return res;

        // find query selector
        var el = await page.$( 'input[name="q"]' );
        if ( !el ) return result( [500, "Google query selector not found"] );

        // type query
        await el.focus();
        await el.type( keyword + "\r", { "delay": options.emulateUser ? 100 : 0 } );
        try {
            await page.waitForNavigation( { "waitUntil": "load" } );
        }
        catch ( e ) {
            return result( [500, "Navigation error"] );
        }

        // check captcha
        res = await this._checkCaptcha( page );
        if ( !res.ok ) return res;

        // find gmap results
        el = await page.$( "g-more-link" );
        if ( !el ) return result( [404, "No results found"] );

        // open gmap
        await el.hover();
        await el.click();
        try {
            await page.waitForNavigation( { "waitUntil": "domcontentloaded" } );
        }
        catch ( e ) {
            return result( [500, "Navigation error"] );
        }

        // detect empty results
        if ( await page.$( "div.section-bad-query-title" ) ) return result( [404, "No results found"] );

        const data = [];
        let pos = 0;

        // parse results page
        PAGE: while ( 1 ) {

            // find results elements
            const els = await page.$$( "div.VkpGBb" );

            // no results elements found, this is selectors error
            if ( !els ) return result( [500, "Search results selector not found"] );

            for ( const el of els ) {

                // skip ads
                if ( await el.$( "span.gghBu" ) ) continue;

                // find business name
                const name = await this._getTextContent( el, `div[role="heading"]` );

                // unable to find business name
                if ( !name ) return result( [500, "Business name selector not found"] );

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
                        if ( !urlEl ) return result( [500, "Target site url not found"] );

                        await urlEl.hover();
                        await urlEl.click();
                        try {
                            await page.waitForNavigation( { "waitUntil": "domcontentloaded" } );
                        }
                        catch ( e ) {
                            return result( [500, "Navigation error"] );
                        }

                        res = await options.onTargetFound( page );

                        res.data = res.data ? { ...res.data, ...targetData } : targetData;

                        return res;
                    }
                    else {
                        return result( 200, targetData );
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
                return result( [500, "Navigation error"] );
            }
        }

        if ( target ) return result( [404, "No results found"] );
        else return result( 200, data );
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

    async _onFinish ( page ) {
        if ( this.#debug ) await confirm( "Close page?", ["y"] );

        const browser = page.browser();

        // close incognito context
        if ( this.#persistent && !this.destroyed ) {
            await page.browserContext().close();
        }

        // close browser
        else {
            await browser.close();
        }
    }

    async _getBrowser ( country, device ) {
        var browser = this.#browsers[country];

        if ( !browser ) {
            let proxy;

            if ( this.#proxy ) {
                proxy = _proxy( this.#proxy );

                proxy.country = country;
            }

            // create new browser instance
            browser = await puppeteer().launch( {
                "proxy": proxy,
                "timezone": false,
                "stealth": true,
                "device": device || puppeteer.devices.windows10(),
            } );

            if ( this.#persistent ) this.#browsers[country] = browser;
        }

        return browser;
    }

    async _getPage ( country, coordinates, device ) {
        const domain = this._getGoogleDomain( country );

        const browser = await this._getBrowser( domain.country.iso2, device );

        const context = await browser.createIncognitoBrowserContext();

        const page = await context.newPage();

        // set default timeouts
        await page.setDefaultNavigationTimeout( this.#timeout );
        await page.setDefaultTimeout( this.#timeout );

        // disable images
        await this._disablePageImages( page );

        // set geo location
        if ( coordinates ) {

            // enable geolocation for google domain
            await page.browserContext().overridePermissions( `https://www.${domain.domain}/`, ["geolocation"] );

            // emulate geolocation coordinates
            await page.setGeolocation( coordinates );

            // set timezone by coordinates
            await page.emulateTimezone( timezones.getByCoordinates( coordinates )[0].name );
        }
        else {
            await page.browserContext().clearPermissionOverrides();

            // set timezone by country coordinates
            await page.emulateTimezone( timezones.getByCoordinates( domain.country.coordinates )[0].name );
        }

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

    async _checkCaptcha ( page ) {
        const resUrl = page.url();

        // request is not blocked
        if ( resUrl.indexOf( "/sorry/index" ) === -1 ) return result( 200 );

        // captcha or banned, return error
        if ( !this.resolveCaptcha || !this.#captcha ) return result( [500, "Request blocked by google"] );

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
        if ( !c.ok ) return result( [500, "Error resolving captcha"] );

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

    // XXX check for "Before you continue" modal dialog present
    async _checkBanner ( page ) {

        // check for "Before you continue" modal dialog present
        // XXX
        // el = await page.$( "span.RveJvd.snByac" );
        // if ( el ) await el.click();

        return result( 200 );
    }

    _getGoogleDomain ( country ) {
        return googleDomains.get( country || "WORLDWIDE" );
    }
};

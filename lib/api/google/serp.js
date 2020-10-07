const MaxThreads = require( "../../threads/max-threads" );
const puppeteer = require( "../../puppeteer" );
const _proxy = require( "../../proxy" );
const _res = require( "../../result" );
const fs = require( "../../fs" );
const { confirm } = require( "../../util" );

const RESULTS_PER_PAGE = 100;
const COUNTRIES = fs.config.read( __dirname + "/../../../resources/google-countries.yaml" );

module.exports = class GoogleSerp extends MaxThreads {
    #debug;
    #proxy;
    #captcha;
    #maxRetries = 2;

    constructor ( options = {} ) {
        super( options.maxThreads || 3 );

        this.#debug = options.debug;
        this.proxy = options.proxy;
        this.captcha = options.captcha;
    }

    set proxy ( proxy ) {
        this.#proxy = proxy;
    }

    set captcha ( captcha ) {
        this.#captcha = captcha;
    }

    // options:
    // iso2 country code
    // num: 1 - 1000
    async getSerp ( keyword, options ) {
        return this.runThread( keyword, options );
    }

    async _thread ( keyword, options = {} ) {
        var proxy = this.#proxy,
            host,
            num = options.num || 100;

        // get google domain by country
        if ( options.country ) {
            host = ( COUNTRIES[options.country] || COUNTRIES[""] ).google;

            if ( proxy ) {
                proxy = _proxy( proxy );

                await proxy.startSession( { "country": options.country } );
            }
        }
        else {
            host = COUNTRIES[""].google;
        }

        // create browser instance
        const browser = await puppeteer.launch( {
            proxy,
            "timezone": true,
            "device": puppeteer.devices.win10(),
        } );

        const onFinish = async res => {
                if ( this.#debug ) await confirm( "Close browser?", ["y"] );

                await browser.close();

                return res;
            },
            page = await browser.newPage();

        var start = 0,
            data = [];

        // get serp results
        while ( 1 ) {
            const url =
                `https://www.${host}/search?` +
                new URLSearchParams( {
                    "q": keyword,
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
                if ( !this.#captcha || ++attempt > this.#maxRetries ) return await onFinish( _res( [500, "Unable to get serp, max retries reached"] ) );

                // get captcha params
                const siteKey = await page.$eval( "#recaptcha", el => el.getAttribute( "data-sitekey" ) );
                const datas = await page.$eval( "#recaptcha", el => el.getAttribute( "data-s" ) );
                const callback = await page.$eval( "#recaptcha", el => el.getAttribute( "data-callback" ) );

                // captcha params error
                if ( !siteKey || !datas || !callback ) return await onFinish( _res( [500, "Captcha params error"] ) );

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
                serp = await page.$$eval( "div.rc", items => {
                    var pos = 0,
                        data = [];

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
                } );

                // serp parser returned no results, throw error
                if ( !serp.length ) throw `No results found`;
            }
            catch ( e ) {

                // serp parsing error
                return await onFinish( _res( [500, "Google serp parsing error"] ) );
            }

            data.push( ...serp );

            // all required results collected
            if ( data.length >= num ) {

                // cut results
                if ( data.length >= num ) data = data.slice( 0, num );

                break;
            }

            // get next page element
            const nextPageEl = await page.$( "a#pnnext" );

            // max page reached
            if ( !nextPageEl ) break;

            // goto next page
            start += RESULTS_PER_PAGE;
        }

        return await onFinish( _res( 200, data ) );
    }
};

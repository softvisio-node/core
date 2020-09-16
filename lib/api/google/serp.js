const MaxThreads = require( "../../threads/max-threads" );
const puppeteer = require( "../../puppeteer" );
const _proxy = require( "../../proxy" );
const _res = require( "@softvisio/core/result" );
const fs = require( "../../fs" );

const COUNTRIES = fs.config.read( __dirname + "/../../../resources/google-countries.yaml" );

module.exports = class GoogleSerp extends MaxThreads {
    #proxy;
    #captcha;

    constructor ( options = {} ) {
        super( options.maxThreads || 3 );

        this.proxy = options.proxy;
        this.captcha = options.captcha;
    }

    set proxy ( proxy ) {
        this.#proxy = proxy;
    }

    set captcha ( captcha ) {
        this.#captcha = captcha;
    }

    async getSerp ( keyword, options ) {
        return this.runThread( keyword, options );
    }

    async _thread ( keyword, options = {} ) {
        var proxy = this.#proxy,
            host;

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

        const browser = await puppeteer.launch( {
            proxy,
            "timezone": true,
            "device": "windows10",
        } );

        const page = await browser.newPage();

        var url =
            `https://www.${host}/search?` +
            new URLSearchParams( {
                "q": keyword,
                "start": 0,
                "num": 100,
            } ).toString();

        await page.goto( url );

        const data = await page.$$eval( "div.rc", items => {
            var pos = 0,
                data = [];

            for ( const item of items ) {
                const r = {
                    "pos": ++pos,
                };

                var a = item.querySelector( "div.r > a" );

                r.url = a.getAttribute( "href" );

                r.title = a.querySelector( "h3" ).textContent;

                r.desc = item.querySelector( "div.s > div > span.st" ).textContent;

                data.push( r );
            }

            return data;
        } );

        await browser.close();

        return _res( 200, data );
    }
};

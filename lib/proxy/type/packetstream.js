const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const CountryMixin = require( "../mixins/country" );

const DEFAULT_URL = "http://proxy.packetstream.io:31112";

module.exports = class ProxyPacketstream extends mixins( CountryMixin, Proxy ) {
    #proxy;

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        this.#updateProxy();
    }

    get isHttp () {
        return true;
    }

    async connect ( url ) {
        return this.#proxy.connect( url );
    }

    _updated () {
        super._updated();

        this.#updateProxy();
    }

    #updateProxy () {
        const url = new URL( DEFAULT_URL );

        this.#proxy = Proxy.new( url, {
            "username": this.username,
            "password": this.password + ( this.country ? "_country-" + this.country : "" ),
        } );
    }

    // ROTATE
    getProxy () {
        return this.#proxy;
    }

    getRandomProxy () {
        return this.#proxy;
    }

    rotateNextProxy () {
        return this.#proxy;
    }

    rotateRandomProxy () {
        return this.#proxy;
    }
};

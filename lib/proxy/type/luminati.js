const mixins = require( "../../mixins" );
const Proxy = require( "../../proxy" );
const RotatingMixin = require( "../mixins/rotating" );
const CountryMixin = require( "../mixins/country" );
const crypto = require( "crypto" );
const dns = require( "../../dns" );

const DEFAULT_HOST = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

// NOTE https://luminati.io/faq#examples

module.exports = class ProxyLuminati extends mixins( RotatingMixin, CountryMixin, Proxy ) {
    #proxy;

    #zone;
    #state;
    #city;
    #dns; // "dns-local", "dns-remote" - domain names will be resolved and cached by the Super Proxy, remote - DNS resolution at the Proxy Peer
    #direct; // bool, perform the request from the super proxy directly instead of the IP of the peer

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        this.zone = options.zone ?? url.searchParams.get( "zone" );
        this.state = options.state ?? url.searchParams.get( "state" );
        this.city = options.city ?? url.searchParams.get( "city" );
        this.dns = options.dns ?? url.searchParams.get( "dns" );
        this.direct = options.direct ?? url.searchParams.get( "direct" );
        this.session = options.session ?? url.searchParams.get( "session" );

        this.#updateProxy();
    }

    get isHttp () {
        return true;
    }

    get url () {
        const url = super.url;

        if ( this.zone ) url.searchParams.set( "zone", this.zone );
        if ( this.state ) url.searchParams.set( "state", this.state );
        if ( this.city ) url.searchParams.set( "city", this.city );
        if ( this.dns ) url.searchParams.set( "dns", this.dns );
        if ( this.direct ) url.searchParams.set( "direct", this.direct );
        if ( this.session ) url.searchParams.set( "session", this.session );

        return url;
    }

    get zone () {
        return this.#zone;
    }

    set zone ( value ) {
        value ||= null;

        // not updated
        if ( value === ( this.#zone || null ) ) return;

        this.#zone = value;

        this._updated();
    }

    get state () {
        return this.#state;
    }

    set state ( value ) {
        value ||= null;

        // not updated
        if ( value === ( this.#state || null ) ) return;

        this.#state = value;

        this._updated();
    }

    get city () {
        return this.#city;
    }

    set city ( value ) {
        value ||= null;

        // not updated
        if ( value === ( this.#city || null ) ) return;

        this.#city = value;

        this._updated();
    }

    get dns () {
        return this.#dns;
    }

    // allowed values: local, remote, null
    set dns ( value ) {
        value ||= null;

        // not updated
        if ( value === ( this.#dns || null ) ) return;

        this.#dns = value;

        this._updated();
    }

    get direct () {
        return this.#direct;
    }

    set direct ( value ) {
        if ( value === true || value === "true" ) value = true;
        else value = false;

        // not updated
        if ( value === ( this.#direct || false ) ) return;

        this.#direct = value;

        this._updated();
    }

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const proxy = await this._autoRotateProxy( { "protocol": url.protocol } );

        if ( !proxy ) return Promise.reject( "Unable to get proxy" );

        return proxy.connect( url );
    }

    _updated () {
        super._updated();

        this.#updateProxy();
    }

    #updateProxy () {
        const url = new URL( "http://" + DEFAULT_HOST + ":" + DEFAULT_PORT );

        var username = "lum-customer-" + this.username;

        if ( this.zone ) username += "-zone-" + this.zone;
        if ( this.country ) username += "-country-" + this.country;
        if ( this.state ) username += "-state-" + this.state;
        if ( this.city ) username += "-city-" + this.city;
        if ( this.dns ) username += "-dns-" + this.dns;
        if ( this.direct ) username += "-direct";

        this.#proxy = Proxy.new( url, {
            username,
            "password": this.password,
        } );
    }

    // ROTATE
    async getProxy ( options = {} ) {
        return this.#createSession( options );
    }

    async getRandomProxy ( options = {} ) {
        return this.#createSession( options );
    }

    async rotateNextProxy ( options = {} ) {
        this.#proxy = this.#createSession( options );

        return this.#proxy;
    }

    async rotateRandomProxy ( options = {} ) {
        this.#proxy = this.#createSession( options );

        return this.#proxy;
    }

    async #createSession ( options = {} ) {
        const sessionHost = await dns.resolve4( options.country ? `servercountry-${options.country}.${DEFAULT_HOST}` : DEFAULT_HOST );

        // unable to resolve host name
        if ( !sessionHost ) return;

        const sessionId = crypto.randomBytes( 16 ).toString( "hex" );

        const url = new URL( "luminati-static://" + sessionHost + ":" + DEFAULT_PORT );

        return ( this.#proxy = Proxy.new( url, {
            "username": this.username,
            "password": this.password,
            "session": sessionId,
            "zone": options.zone || this.zone,
            "country": options.country || this.country,
            "state": options.state || this.state,
            "city": options.city || this.city,
        } ) );
    }
};

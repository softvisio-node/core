const mixins = require( "../../../mixins" );
const Proxy = require( "../../../proxy" );
const CountryMixin = require( "../../mixins/country" );

// NOTE https://luminati.io/faq#examples

module.exports = class ProxyLuminati extends mixins( CountryMixin, Proxy ) {
    #proxy;

    #zone;
    #state;
    #city;
    #dns; // "dns-local", "dns-remote" - domain names will be resolved and cached by the Super Proxy, remote - DNS resolution at the Proxy Peer
    #direct; // bool, perform the request from the super proxy directly instead of the IP of the peer

    #session;

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

        if ( this.session ) url.searchParams.set( "session", this.session );
        if ( this.zone ) url.searchParams.set( "zone", this.zone );
        if ( this.state ) url.searchParams.set( "state", this.state );
        if ( this.city ) url.searchParams.set( "city", this.city );
        if ( this.dns ) url.searchParams.set( "dns", this.dns );
        if ( this.direct ) url.searchParams.set( "direct", this.direct );
        if ( this.session ) url.searchParams.set( "session", this.session );

        return url;
    }

    get session () {
        return this.#session;
    }

    set session ( value ) {
        if ( !value ) throw `Session id is required for luminati-static: proxy`;

        // not updated
        if ( value === this.#session ) return;

        this.#session = value;

        this._updated();
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
        return this.#proxy.connect( url );
    }

    _updated () {
        super._updated();

        this.#updateProxy();
    }

    // XXX
    #updateProxy () {
        const url = new URL( "http://" + this.hostname + ":" + this.port );

        var username = "lum-customer-" + this.username;

        if ( this.session ) username += "-session-" + this.#session;

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
};

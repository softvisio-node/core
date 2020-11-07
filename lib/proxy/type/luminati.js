const Proxy = require( "../proxy" );
const crypto = require( "crypto" );
const dns = require( "../../dns" );

const DEFAULT_HOST = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

// NOTE https://luminati.io/faq#examples

// supported options:
// zone
// session
// country
// state
// city
// dns - local - domain names will be resolved and cached by the Super Proxy, remote - DNS resolution at the Proxy Peer
// direct - perform the request from the super proxy directly instead of the IP of the peer
class ProxyTypeLuminati extends Proxy {
    #zone;
    #dns;
    #direct;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( !url.hostname ) url.hostname = DEFAULT_HOST;
        if ( !url.port ) url.port = DEFAULT_PORT;

        super( url, options );

        url.searchParams.forEach( ( value, name ) => {
            if ( !( name in options ) ) options[name] = value;
        } );

        this.zone = options.zone;
        this.country = options.country;
        this.state = options.state;
        this.city = options.city;
        this.dns = options.dns;
        this.direct = options.direct;
        this.session = options.session;
    }

    // TYPE
    get isLuminati () {
        return true;
    }

    get type () {
        return "luminati";
    }

    get isHttp () {
        return true;
    }

    // USERNAME
    // XXX
    _buildEffectiveUsername () {
        var username = "lum-customer-" + this.username;

        if ( this.zone ) username += "-zone-" + this.zone;
        if ( this.country ) username += "-country-" + this.country;
        if ( this.state ) username += "-state-" + this.state;
        if ( this.city ) username += "-city-" + this.city;
        if ( this.dns ) username += "-dns-" + this.dns;
        if ( this.direct ) username += "-direct-" + this.direct;

        if ( this.session && this.host !== DEFAULT_HOST ) username += "-session-" + this.session;

        return username;
    }

    // COUNTRY
    get country () {
        return super.country;
    }

    set country ( country ) {

        // country was updated
        if ( this._setCountry( country ) ) this._clearEffectiveUsername();
    }

    // STATE
    get state () {
        return super.state;
    }

    set state ( state ) {

        // state was updated
        if ( this._setState( state ) ) this._clearEffectiveUsername();
    }

    // CITY
    get city () {
        return super.city;
    }

    set city ( city ) {

        // city was updated
        if ( this._setCity( city ) ) this._clearEffectiveUsername();
    }

    // ZONE
    get zone () {
        return this.#zone;
    }

    set zone ( zone ) {
        if ( this.#zone !== zone ) {
            this.#zone = zone;

            this._clearEffectiveUsername();
        }
    }

    // DNS
    get dns () {
        return this.#dns;
    }

    set dns ( dns ) {
        if ( this.#dns !== dns ) {
            this.#dns = dns;

            this._clearEffectiveUsername();
        }
    }

    // DIRECT
    get direct () {
        return this.#direct;
    }

    set direct ( direct ) {
        if ( this.#direct !== direct ) {
            this.#direct = direct;

            this._clearEffectiveUsername();
        }
    }

    // ------------------------------------------------------------

    get sessionId () {
        if ( !this._options.session || this.host === DEFAULT_HOST ) return null;

        return this.host + ":" + this._options.session;
    }

    // options:
    // sessionId
    // country, state, city
    async startSession ( options = {} ) {
        const _options = this._options;

        if ( options.country ) this.country = options.country;
        if ( options.state ) this.state = options.state;
        if ( options.city ) this.city = options.city;

        if ( options.sessionId ) {
            const sessionId = options.sessionId.split( ":" );

            if ( sessionId[0] === DEFAULT_HOST || !sessionId[1] ) return null;

            this.host = sessionId[0];

            _options.session = sessionId[1];
        }
        else {
            const ip = await dns.resolve4( options.country ? `servercountry-${options.country}.${DEFAULT_HOST}` : DEFAULT_HOST );

            // unable to resolve host name
            if ( !ip ) return null;

            this.host = ip;

            _options.session = crypto.randomBytes( 16 ).toString( "hex" );
        }

        this._buildSession();

        return this.sessionId;
    }
}

module.exports = ProxyTypeLuminati;

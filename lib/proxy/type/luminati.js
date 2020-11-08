const Proxy = require( "../proxy" );
const crypto = require( "crypto" );
const dns = require( "../../dns" );

const DEFAULT_HOST = "zproxy.lum-superproxy.io";
const DEFAULT_PORT = 22225;

// NOTE https://luminati.io/faq#examples

// supported options:
// zone
// country
// state
// city
// dns - local - domain names will be resolved and cached by the Super Proxy, remote - DNS resolution at the Proxy Peer
// direct - perform the request from the super proxy directly instead of the IP of the peer
class ProxyTypeLuminati extends Proxy {
    #zone;
    #dns;
    #direct;
    #sessionId;
    #sessionHost;

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

    // STATIC
    get isStatic () {
        return super.isStatic;
    }

    set isStatic ( isStatic ) {}

    // HOST
    _buildEffectiveHost () {
        if ( this.#sessionHost ) {
            return this.#sessionHost;
        }
        else {
            return this.host;
        }
    }

    // USERNAME
    _buildEffectiveUsername () {
        var username = "lum-customer-" + this.username;

        if ( this.zone ) username += "-zone-" + this.zone;
        if ( this.country ) username += "-country-" + this.country;
        if ( this.state ) username += "-state-" + this.state;
        if ( this.city ) username += "-city-" + this.city;
        if ( this.dns ) username += "-dns-" + this.dns;
        if ( this.direct ) username += "-direct-" + this.direct;
        if ( this.sessionId ) username += "-session-" + this.sessionId;

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

    // SESSION
    get sessionId () {
        return this.#sessionId;
    }

    get sessionHost () {
        return this.#sessionHost;
    }

    async startSession () {
        const sessionHost = await dns.resolve4( this.country ? `servercountry-${this.country}.${DEFAULT_HOST}` : DEFAULT_HOST );

        // unable to resolve host name
        if ( !sessionHost ) return false;

        this.#sessionHost = sessionHost;

        this.#sessionId = crypto.randomBytes( 16 ).toString( "hex" );

        super.isStatic = true;

        this._clearEffectiveHost();
        this._clearEffectiveUsername();

        return true;
    }

    endSession () {
        this.#sessionId = null;
        this.#sessionHost = null;
        super.isStatic = false;

        this._clearEffectiveHost();
        this._clearEffectiveUsername();
    }
}

module.exports = ProxyTypeLuminati;

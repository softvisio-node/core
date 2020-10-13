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
class ProxyLuminati extends Proxy {
    #username;

    constructor ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( !url.hostname ) url.hostname = DEFAULT_HOST;
        if ( !url.port ) url.port = DEFAULT_PORT;

        super( url );

        this.#username = url.username || null;

        this._buildSession();
    }

    get type () {
        return "luminati";
    }

    _buildSession () {
        var username = "lum-customer-" + this.#username;

        const options = this._options;

        if ( options.zone ) username += "-zone-" + options.zone;
        if ( options.country ) username += "-country-" + options.country;
        if ( options.state ) username += "-state-" + options.state;
        if ( options.city ) username += "-city-" + options.city;
        if ( Object.hasOwnProperty.call( options, "direct" ) ) username += "-direct";
        if ( options.dns ) username += "-dns-" + options.dns;

        if ( options.session && this.host !== DEFAULT_HOST ) username += "-session-" + options.session;

        this.username = username;
    }

    get isHttp () {
        return true;
    }

    get sessionId () {
        if ( !this._options.session || this.host === DEFAULT_HOST ) return null;

        return this.host + ":" + this._options.session;
    }

    get zone () {
        return this._options.zone;
    }

    set zone ( val ) {
        this._options.zone = val;

        this._buildSession();
    }

    get country () {
        return this._options.country;
    }

    set country ( iso2 ) {
        this._options.country = iso2;

        this._buildSession();
    }

    get state () {
        return this._options.state;
    }

    set state ( val ) {
        this._options.state = val;

        this._buildSession();
    }

    get city () {
        return this._options.city;
    }

    set city ( val ) {
        this._options.city = val;

        this._buildSession();
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

module.exports = ProxyLuminati;

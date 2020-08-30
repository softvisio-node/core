const Proxy = require( "../proxy" );
const crypto = require( "crypto" );

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

        this._buildUsername();
    }

    _buildUsername () {
        var username = "lum-customer-" + this.#username;

        const options = this._options;

        if ( options.zone ) username += "-zone-" + options.zone;
        if ( options.country ) username += "-country-" + options.country;
        if ( options.state ) username += "-state-" + options.state;
        if ( options.city ) username += "-city-" + options.city;
        if ( options.direct ) username += "-direct";
        if ( options.dns ) username += "-dns-" + options.dns;

        if ( options.session && this.host !== DEFAULT_HOST ) username += "-session-" + options.session;

        this.username = username;
    }

    get isHttp () {
        return true;
    }

    get session () {
        if ( !this._options.session || this.host === DEFAULT_HOST ) return null;

        return this.host + ":" + this._options.session;
    }

    set session ( key ) {
        key = key.split( ":" );

        if ( key[0] === DEFAULT_HOST || !key[1] ) return;

        this.host = key[0];

        this._options.session = key[1];

        this._buildUsername();
    }

    async startSession () {
        const options = this._options;

        const ip = await this.resolveHostname( options.country ? `servercountry-${options.country}.${DEFAULT_HOST}` : DEFAULT_HOST );

        if ( !ip ) return;

        this.host = ip;

        options.session = crypto.randomBytes( 16 ).toString( "hex" );

        this._buildUsername();

        return this.session;
    }
}

module.exports = ProxyLuminati;

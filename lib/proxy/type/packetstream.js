const Proxy = require( "../proxy" );

const DEFAULT_HOST = "proxy.packetstream.io";
const DEFAULT_PORT = 31112;

// supported options:
// country
class ProxyTypePacketstream extends Proxy {
    #password;

    constructor ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( !url.hostname ) url.hostname = DEFAULT_HOST;
        if ( !url.port ) url.port = DEFAULT_PORT;

        super( url );

        this.#password = url.password || null;

        this._buildSession();
    }

    get isPacketstream () {
        return true;
    }

    get type () {
        return "packetstream";
    }

    get isHttp () {
        return true;
    }

    get country () {
        return this._options.country;
    }

    set country ( iso2 ) {
        if ( iso2 ) {
            this._options.country = iso2;
        }
        else {
            this._options.country = null;
        }

        this._buildSession();
    }

    // options:
    // country
    async startSession ( options = {} ) {
        this.country = options.country;

        this._buildSession();

        return this.sessionId;
    }

    _buildSession () {
        var password = this.#password;

        const options = this._options;

        if ( options.country ) password += "_country-" + options.country;

        this.password = password;
    }
}

module.exports = ProxyTypePacketstream;

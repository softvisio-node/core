const Proxy = require( "../proxy" );

const DEFAULT_HOST = "proxy.packetstream.io";
const DEFAULT_PORT = 31112;

// supported options:
// country
class ProxyTypePacketstream extends Proxy {
    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( !url.hostname ) url.hostname = DEFAULT_HOST;
        if ( !url.port ) url.port = DEFAULT_PORT;

        super( url, options );

        url.searchParams.forEach( ( value, name ) => {
            if ( !( name in options ) ) options[name] = value;
        } );

        this.country = options.country;
    }

    // TYPE
    get isPacketstream () {
        return true;
    }

    get type () {
        return "packetstream";
    }

    get isHttp () {
        return true;
    }

    // STATIC
    get isStatic () {
        return false;
    }

    set isStatic ( isStatic ) {}

    // PASSWORD
    _buildEffectivePassword () {

        // has country targeting
        if ( this.country ) {
            return this.password + "_country-" + this.country;
        }

        // has no country targeting
        else {
            return this.password;
        }
    }

    // COUNTRY
    get country () {
        return super.country;
    }

    set country ( country ) {

        // country was updated
        if ( this._setCountry( country ) ) this._clearEffectivePassword();
    }
}

module.exports = ProxyTypePacketstream;

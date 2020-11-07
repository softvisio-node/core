const CONST = require( "../const" );
const net = require( "net" );
const http = require( "http" );
const IPAddr = require( "../ip-addr" );
const { readChunk } = require( "../util" );

const DEFAULT_PORT = {
    "ftp:": 21,
    "gopher:": 70,
    "http:": 80,
    "https:": 443,
    "ws:": 80,
    "wss:": 443,
};

const SOCKS5_ERROR = {
    "1": "General failure",
    "2": "Connection not allowed by ruleset",
    "3": "Network unreachable",
    "4": "Host unreachable",
    "5": "Connection refused by destination host",
    "6": "TTL expired",
    "7": "Command not supported / protocol error",
    "8": "Address type not supported",
};

class Proxy {
    static [CONST.OBJECT_IS_PROXY] = true;

    #type;

    #isStatic = false;

    #host;
    #effectiveHost;

    #port;
    #effectivePort;

    #username;
    #effectiveUsername;

    #password;
    #effectivePassword;

    #hasGeoTargeting;
    #country = null;
    #state = null;
    #city = null;

    #remoteAddr;
    #timezone;

    #basicAuth;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        this.#type = Object.fromEntries( url.protocol
            .slice( 0, -1 )
            .split( "+" )
            .map( type => [type, true] ) );

        this.host = url.hostname;
        this.port = url.port;
        this.username = url.username || null;
        this.password = url.password || null;

        url.searchParams.forEach( ( value, name ) => {
            if ( !( name in options ) ) options[name] = value;
        } );

        this.isStatic = options.static;
    }

    // TYPE
    get type () {
        return null;
    }

    get isSocks () {
        return this.#type.socks || this.#type.socks5;
    }

    get isHttp () {
        return this.#type.http;
    }

    // STATIC
    get isStatic () {
        return this.#isStatic;
    }

    set isStatic ( isStatic ) {
        isStatic = !!isStatic;

        if ( isStatic !== this.#isStatic ) {
            this.#isStatic = isStatic;

            // drop cached data
            this.#remoteAddr = null;
            this.#timezone = null;
        }
    }

    // HOST
    get host () {
        return this.#host;
    }

    set host ( host ) {
        if ( this.#host !== host ) {
            this.#host = host;

            this._clearEffectiveHost();
        }
    }

    get effectiveHost () {
        if ( this.#effectiveHost == null ) this.#effectiveHost = this._buildEffectiveHost();

        return this.#effectiveHost;
    }

    _clearEffectiveHost () {
        this.#effectiveHost = null;
    }

    _buildEffectiveHost () {
        return this.#host;
    }

    // PORT
    get port () {
        return this.#port;
    }

    set port ( port ) {
        if ( this.#port !== port ) {
            this.#port = port;

            this._clearEffectivePort();
        }
    }

    get effectivePort () {
        if ( this.#effectivePort == null ) this.#effectivePort = this._buildEffectivePort();

        return this.#effectivePort;
    }

    _clearEffectivePort () {
        this.#effectivePort = null;
    }

    _buildEffectivePort () {
        return this.#port;
    }

    // USERNAME
    get username () {
        return this.#username;
    }

    set username ( username ) {
        if ( this.#username !== username ) {
            this.#username = username;

            this._clearEffectiveUsername();
        }
    }

    get effectiveUsername () {
        if ( this.#effectiveUsername == null ) {
            let effectiveUsername = this._buildEffectiveUsername();

            if ( effectiveUsername == null ) effectiveUsername = "";

            this.#effectiveUsername = effectiveUsername;

            // drop cached data
            this._clearBasicAuth();
        }

        return this.#effectiveUsername;
    }

    _clearEffectiveUsername () {
        if ( this.#effectiveUsername != null ) {
            this.#effectiveUsername = null;

            this._clearBasicAuth();
        }
    }

    _buildEffectiveUsername () {
        return this.#username;
    }

    // PASSWORD
    get password () {
        return this.#password;
    }

    set password ( password ) {
        if ( this.#password !== password ) {
            this.#password = password;

            this._clearEffectivePassword();
        }
    }

    get effectivePassword () {
        if ( this.#effectivePassword == null ) {
            let effectivePassword = this._buildEffectivePassword();

            if ( effectivePassword == null ) effectivePassword = "";

            this.#effectivePassword = effectivePassword;

            // drop cached data
            this._clearBasicAuth();
        }

        return this.#effectivePassword;
    }

    _clearEffectivePassword () {
        if ( this.#effectivePassword != null ) {
            this.#effectivePassword = null;

            this._clearBasicAuth();
        }
    }

    _buildEffectivePassword () {
        return this.#password;
    }

    // GEO TARGETING
    get hasGeoTargeting () {
        if ( this.#hasGeoTargeting == null ) {
            this.#hasGeoTargeting = this._buildHasGeoTargeting();

            this.#remoteAddr = null;
            this.#timezone = null;
        }

        return this.#hasGeoTargeting;
    }

    _clearHasGeoTargeting () {
        if ( this.#hasGeoTargeting != null ) {
            this.#hasGeoTargeting = null;

            this.#remoteAddr = null;
            this.#timezone = null;
        }
    }

    _buildHasGeoTargeting () {
        if ( this.#country || this.#state || this.#city ) {
            return true;
        }
        else {
            return false;
        }
    }

    // COUNTRY
    get country () {
        return this.#country;
    }

    set country ( country ) {}

    _setCountry ( country ) {
        if ( !country ) country = null;

        if ( country !== this.#country ) {
            this.#country = country;

            this._clearHasGeoTargeting();

            return true;
        }
    }

    // STATE
    get state () {
        return this.#state;
    }

    set state ( state ) {}

    _setState ( state ) {
        if ( !state ) state = null;

        if ( state !== this.#state ) {
            this.#state = state;

            this._clearHasGeoTargeting();

            return true;
        }
    }

    // CITY
    get city () {
        return this.#city;
    }

    set city ( city ) {}

    _setCity ( city ) {
        if ( !city ) city = null;

        if ( city !== this.#city ) {
            this.#city = city;

            this._clearHasGeoTargeting();

            return true;
        }
    }

    // BASIC AUTH
    get basicAuth () {
        if ( this.#basicAuth == null ) this.#basicAuth = Buffer.from( this.effectiveUsername + ":" + this.effectivePassword ).toString( "base64" );

        return this.#basicAuth;
    }

    _clearBasicAuth () {
        this.#basicAuth = null;
    }

    // METHODS
    getConnectionType ( protocol ) {
        if ( this.isHttp ) {
            if ( protocol === "http:" ) return "http";

            if ( protocol === "https:" ) return "https";
        }

        // fallback to socks5 protocol
        if ( this.isSocks ) return "socks5";
    }

    async getRemoteAddr () {
        var remoteAddr = this.#remoteAddr;

        if ( !remoteAddr ) {
            const fetch = require( "../http/fetch" );

            const res = await fetch( "https://httpbin.org/ip", { "proxy": this } );

            if ( !res.ok ) return;

            const json = await res.json();

            remoteAddr = new IPAddr( json.origin );

            // cache ip address if proxy is static
            if ( this.isStatic ) this.#remoteAddr = remoteAddr;
        }

        return remoteAddr;
    }

    // get timezone is possible only for static proxies, or for proxies, that has geo targeting
    async getTimezone () {
        if ( !this.isStatic || !this.hasGeoTargeting ) return;

        if ( !this.#timezone ) {
            const ip = await this.getRemoteAddr();

            if ( !ip ) return;

            const geo = ip.geo;

            if ( !geo ) return;

            this.#timezone = ip.geo.location.time_zone;
        }

        return this.#timezone;
    }

    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const type = this.getConnectionType( url.protocol );

        if ( type === "http" ) {
            return this._connectHttp( url.hostname, url.port || this._getDefaultPort( url.protocol ) );
        }
        else {
            const hostname = url.hostname;

            if ( type === "https" ) {
                return this._connectHttps( hostname, url.port || this._getDefaultPort( url.protocol ) );
            }
            else if ( type === "socks5" ) {
                return this._connectSocks5( hostname, url.port || this._getDefaultPort( url.protocol ) );
            }
            else {
                return Promise.reject( "Unable to select connection type" );
            }
        }
    }

    // PROTECTED
    async _connectHttp ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.connectionType = "http";

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e.message ) );

            socket.once( "ready", () => {
                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( this.effectivePort, this.effectiveHost );
        } );
    }

    async _connectHttps ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const req = http.request( {
                "method": "CONNECT",
                "protocol": "http:",
                "host": this.effectiveHost,
                "port": this.effectivePort,
                "path": host + ":" + port,
            } );

            if ( this.basicAuth ) req.setHeader( "Proxy-Authorization", "Basic " + this.basicAuth );

            req.once( "error", e => reject( e.message ) );

            req.once( "connect", res => {
                if ( res.statusCode === 200 ) {
                    res.socket.connectionType = "https";

                    resolve( res.socket );
                }
                else {
                    reject( res.statusMessage );
                }
            } );

            req.end();
        } );
    }

    async _connectSocks5 ( host, port ) {
        return new Promise( ( resolve, reject ) => {
            const socket = new net.Socket();

            socket.once( "end", () => reject( "Connection closed" ) );

            socket.once( "error", e => reject( e.message || e ) );

            socket.once( "ready", async () => {

                // authenticate
                if ( this.username != null ) {
                    socket.write( Buffer.from( [0x05, 0x01, 0x02] ) );
                }

                // no authentication
                else {
                    socket.write( Buffer.from( [0x05, 0x01, 0x00] ) );
                }

                var chunk = await readChunk( socket, 2 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // not a socks 5 proxy server
                if ( chunk[0] !== 0x05 ) return socket.destroy( "Not a socks5 proxy" );

                // no acceptable auth method found
                if ( chunk[1] === 0xff ) {
                    return socket.destroy( "No auth method supported" );
                }

                // auth is required
                else if ( chunk[1] !== 0x00 ) {

                    // username / password auth
                    if ( chunk[1] === 0x02 ) {
                        const username = Buffer.from( this.effectiveUsername );
                        const password = Buffer.from( this.effectivePassword );

                        // send username / password auth
                        const buf = Buffer.concat( [

                            //
                            Buffer.from( [0x01] ),
                            Buffer.from( [username.length] ),
                            username,
                            Buffer.from( [password.length] ),
                            password,
                        ] );

                        socket.write( buf );

                        chunk = await readChunk( socket, 2 );
                        if ( !chunk ) return socket.destroy( "Connection closed" );

                        // auth rejected
                        if ( chunk[0] !== 0x01 || chunk[1] !== 0x00 ) return socket.destroy( "Authentication error" );
                    }

                    // unsupported auth method
                    else {
                        return socket.destroy( "No auth method supported" );
                    }
                }

                // create tunnel
                const ip = new IPAddr( host );

                // ipv4 address
                if ( ip.isV4 ) {
                    const buf = Buffer.alloc( 4 );
                    buf.writeUInt32BE( ip.toNumber() );

                    const portBuf = Buffer.alloc( 2 );
                    portBuf.writeUInt16BE( port );

                    socket.write( Buffer.concat( [

                        //
                        Buffer.from( [0x05, 0x01, 0x00, 0x01] ),
                        buf,
                        portBuf,
                    ] ) );
                }

                // ipv6 address
                else if ( ip.isV6 ) {

                    // TODO
                    return socket.destroy( "IPv6 currently is not supported" );
                }

                // domain name
                else {
                    const domainName = Buffer.from( host );

                    const portBuf = Buffer.alloc( 2 );
                    portBuf.writeUInt16BE( port );

                    socket.write( Buffer.concat( [

                        //
                        Buffer.from( [0x05, 0x01, 0x00, 0x03] ),
                        Buffer.from( [domainName.length] ),
                        domainName,
                        portBuf,
                    ] ) );
                }

                chunk = await readChunk( socket, 3 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // connection error
                if ( chunk[1] !== 0x00 ) return socket.destroy( SOCKS5_ERROR[chunk[1]] || "Unknown error" );

                // read ip type
                chunk = await readChunk( socket, 1 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // ipV4
                if ( chunk[0] === 0x01 ) {

                    // read ipV4 addr
                    chunk = await readChunk( socket, 4 );
                    if ( !chunk ) return socket.destroy( "Connection closed" );
                }

                // ipV6
                else if ( chunk[0] === 0x04 ) {

                    // read ipV6 addr
                    chunk = await readChunk( socket, 16 );
                    if ( !chunk ) return socket.destroy( "Connection closed" );
                }

                // invalid IP type
                else {
                    return socket.destroy( "Socks5 protocol error" );
                }

                // read BNDPORT
                chunk = await readChunk( socket, 2 );
                if ( !chunk ) return socket.destroy( "Connection closed" );

                // connected
                socket.connectionType = "socks5";

                socket.removeAllListeners();

                resolve( socket );
            } );

            socket.connect( this.effectivePort, this.effectiveHost );
        } );
    }

    _getDefaultPort ( protocol ) {
        return DEFAULT_PORT[protocol];
    }
}

module.exports = Proxy;

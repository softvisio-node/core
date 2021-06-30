import Events from "events";
import { v4 as uuidv4 } from "uuid";
import ProxyServer from "./server.js";

const SESSION_BUFFER = Buffer.alloc( 16 );
const PROTOCOL = {};

export default class ProxyClient extends Events {
    #protocol;
    #hostname = "";
    #port = "";
    #username = "";
    #password = "";
    #url;
    #basicAuth;
    #options = {};

    // static
    static new ( url, options = {} ) {
        if ( !url ) return;

        // url is proxy object
        if ( url instanceof ProxyClient ) return url;

        // url is string
        if ( typeof url === "string" ) {
            if ( url.indexOf( "//" ) === -1 ) url = "http://" + url;

            url = new URL( url );
        }

        const protocol = options.protocol || url.protocol;

        const Class = PROTOCOL[protocol];

        if ( !Class ) throw `Proxy protocol "${protocol}" is not registered`;

        const proxy = new Class();

        proxy._init( url, options );

        return proxy;
    }

    static register ( protocol, Class ) {
        if ( !protocol.endsWith( ":" ) ) protocol = protocol + ":";

        PROTOCOL[protocol] = Class;
    }

    static get Server () {
        return ProxyServer;
    }

    static generateSession () {
        uuidv4( null, SESSION_BUFFER );

        return SESSION_BUFFER.toString( "base64url" );
    }

    // init
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super._init ) super._init( url, options );

        this.#protocol = options.protocol || url.protocol;
        this.#hostname = options.hostname || url.hostname;
        this.#port = options.port || url.port;
        this.#username = options.username || url.username;
        this.#password = options.password || url.password;

        this.resolve = options.resolve ?? url.searchParams.get( "resolve" );
    }

    // options
    get _options () {
        return this.#options;
    }

    _set ( name, value ) {
        if ( value == null ) {
            if ( this.#options[name] != null ) {
                delete this.#options[name];

                this._updated();

                return true;
            }
        }
        else if ( this.#options[name] !== value ) {
            this.#options[name] = value;

            this._updated();

            return true;
        }
    }

    _buildOptions ( options ) {
        const _options = {};

        if ( options.protocol && !options.protocol.startsWith( "http" ) ) _options.socks = true;

        if ( options.resolve ) _options.resolve = options.resolve;

        return _options;
    }

    // protocol
    get protocol () {
        return this.#protocol;
    }

    // hostname
    get hostname () {
        return this.#hostname;
    }

    set hostname ( value ) {
        value ||= "";

        // not updated
        if ( this.#hostname === value ) return;

        this.#hostname = value;

        this._updated();
    }

    // port
    get port () {
        return this.#port;
    }

    set port ( value ) {
        value ||= "";

        // not updated
        if ( this.#port === value ) return;

        this.#port = value;

        this._updated();
    }

    // username
    get username () {
        return this.#username;
    }

    set username ( value ) {
        value ||= "";

        // not updated
        if ( this.#username === value ) return;

        this.#username = value;

        this.#basicAuth = null;
        this._updated();
    }

    // password
    get password () {
        return this.#password;
    }

    set password ( value ) {
        value ||= "";

        // not updated
        if ( this.#password === value ) return;

        this.#password = value;

        this.#basicAuth = null;
        this._updated();
    }

    // resolve
    get resolve () {
        return this._options.resolve;
    }

    set resolve ( value ) {
        if ( value !== "local" ) value = false;

        this._set( "resolve", value );
    }

    get basicAuth () {
        if ( this.#basicAuth == null && ( this.username !== "" || this.password !== "" ) ) {
            this.#basicAuth = Buffer.from( this.username + ":" + this.password ).toString( "base64" );
        }

        return this.#basicAuth;
    }

    get url () {
        if ( !this.#url ) {
            var url;

            if ( this.protocol === "http:" ) {
                url = new URL( "http://host" );
            }
            else {
                url = new URL( this.protocol + "//" );
            }

            url.hostname = this.hostname;
            url.port = this.port;
            url.username = this.username;
            url.password = this.password;

            if ( this.resolve ) url.searchParams.set( "resolve", this.resolve );

            this.#url = url;
        }

        return this.#url;
    }

    toString () {
        return this.url.href;
    }

    toJSON () {
        return this.url.href;
    }

    // protected
    _updated () {
        this.#url = null;
    }
}

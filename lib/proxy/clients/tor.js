import OptionsRotating from "../mixins/rotating.js";
import Upstream from "../upstream.js";
import Tor from "#lib/api/tor";
import mixins from "#lib/mixins";

const DEFAULT_HOSTNAME = "127.0.0.1",
    DEFAULT_PORT = 9050,
    DEFAULT_CONTROL_PORT = 9051;

export default class ProxyClientTor extends mixins( OptionsRotating, Upstream ) {
    #controlHost;
    #controlPort;
    #controlPassword;
    #tor;

    // properties
    get isSocks5 () {
        return true;
    }

    get controlHost () {
        return this.#controlHost;
    }

    get controlPort () {
        return this.#controlPort;
    }

    get controlPassword () {
        return this.#controlPassword;
    }

    // public
    async getProxy ( options ) {
        const bucket = this._getBucket( options );

        if ( !bucket.proxy ) {
            bucket.setProxy( this._buildProxy( bucket ) );
        }
        else if ( bucket.requireRotate() ) {
            await this.newNym();

            bucket.setRotated();
        }

        return bucket.getProxy();
    }

    async getNextProxy ( options ) {
        const bucket = this._getBucket( options );

        await this.newNym();

        bucket.setRotated();

        return bucket.getProxy();
    }

    getRandomProxy ( options ) {
        return this.getNextProxy( options );
    }

    // XXX wait for newnym ready
    async newNym () {
        return this.#tor.newNym();
    }

    // protected
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname ||= DEFAULT_HOSTNAME;
        url.port ||= DEFAULT_PORT;

        if ( super._init ) super._init( url, options );

        this.#controlHost = options.controlHost || url.searchParams.get( "controlHost" ) || this.hostname;
        this.#controlPort = +( options.controlPort || url.searchParams.get( "controlPort" ) || DEFAULT_CONTROL_PORT );
        this.#controlPassword = options.controlPassword || url.searchParams.get( "controlPassword" );

        this.#tor = new Tor( this.#controlHost, this.#controlPort, this.#controlPassword );
    }

    _buildUrl () {
        const url = super._buildUrl();

        if ( +url.port === DEFAULT_PORT ) {
            url.port = "";

            if ( url.hostname === DEFAULT_HOSTNAME ) {
                url.hostname = "";
            }
        }

        if ( this.#controlHost && this.#controlHost !== this.hostname ) url.searchParams.set( "controlHost", this.#controlHost );
        if ( this.#controlPort && this.#controlPort !== DEFAULT_CONTROL_PORT ) url.searchParams.set( "controlPort", this.#controlPort );
        if ( this.#controlPassword ) url.searchParams.set( "controlPassword", this.#controlPassword );

        return url;
    }
}

ProxyClientTor.register( "tor:", ProxyClientTor );

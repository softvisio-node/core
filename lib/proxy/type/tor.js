import mixins from "#lib/mixins";
import Upstream from "../upstream.js";
import Tor from "#lib/api/tor";

import OptionsRotating from "../mixins/rotating.js";

const DEFAULT_HOSTNAME = "127.0.0.1";
const DEFAULT_PORT = 9050;
const DEFAULT_CONTROL_PORT = 9051;

export default class ProxyClientTor extends mixins( OptionsRotating, Upstream ) {
    #controlHost;
    #controlPort;
    #controlPassword;
    #tor;

    // properties
    get isSocks () {
        return true;
    }

    // controlHost
    get controlHost () {
        return this.#controlHost;
    }

    // controlPort
    get controlPort () {
        return this.#controlPort;
    }

    // controlPassword
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
        return new Promise( resolve => {
            this.#tor.newNym();

            // this.#tor.once( "CIRC", data => {
            //     console.log( data );

            //     if ( data[1] === "CLOSED" ) resolve();
            // } );

            resolve();
        } );
    }

    // protected
    _init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        url.hostname ||= DEFAULT_HOSTNAME;
        url.port ||= DEFAULT_PORT;

        if ( super._init ) super._init( url, options );

        this.#controlHost = options.controlHost || url.searchParams.get( "controlHost" ) || DEFAULT_HOSTNAME;
        this.#controlPort = options.controlPort || url.searchParams.get( "controlPort" ) || DEFAULT_CONTROL_PORT;
        this.#controlPassword = options.controlPassword || url.searchParams.get( "controlPassword" );

        this.#tor = new Tor( this.#controlHost, this.#controlPort, this.#controlPassword );
    }

    _buildURL () {
        const url = super._buildURL();

        if ( this.#controlHost ) url.searchParams.set( "controlHost", this.#controlHost );
        if ( this.#controlPort ) url.searchParams.set( "controlPort", this.#controlPort );
        if ( this.#controlPassword ) url.searchParams.set( "controlPassword", this.#controlPassword );

        return url;
    }
}

ProxyClientTor.register( "tor:", ProxyClientTor );

import Websocket from "./websocket.js";

const DEFAULT_VERSION = "v1";
const DEFAULT_PONG_INTERVAL = 0;
const DEFAULT_MAX_CONNECTIONS = 1;

export default class extends Websocket {
    #protocol;
    #hostname;
    #port;
    #pathname = "/";
    #persistent;
    #token;
    #json;
    #version;
    #maxConnections;
    #pongInterval;
    #onRPC;

    #url;
    #httpURL;
    #websocketsURL;

    // XXX cache options
    init ( url, options = {} ) {
        url = this._resolveURL( url );

        // XXX protocol + persistent
        this.#protocol = url.protocol;
        this.url = url;
        this.persistent = options.persistent ?? url.searchParams.get( "persistent" );

        this.token = options.token ?? url.username;
        this.json = options.json ?? url.searchParams.get( "json" );
        this.version = options.version ?? url.searchParams.get( "version" );
        this.maxConnections = options.maxConnections ?? url.searchParams.get( "maxConnections" );
        this.pongInterval = options.pongInterval ?? url.searchParams.get( "pongInterval" );
        this.#onRPC = options.onRPC;
    }

    get hostname () {
        return this.#hostname;
    }

    get port () {
        return this.#port;
    }

    get path () {
        return this.#pathname;
    }

    get url () {
        if ( !this.#url ) {
            const url = new URL( this.#protocol + "//" + this.#hostname );

            url.port = this.#port;
            url.pathname = this.#pathname;
            if ( this.#token ) url.username = this.#token;
            if ( this.#version !== DEFAULT_VERSION ) url.searchParams.set( "version", this.#version );
            if ( this.#json ) url.searchParams.set( "json", "true" );
            if ( this.#persistent && this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );
            if ( this.#persistent && this.#pongInterval !== DEFAULT_PONG_INTERVAL ) url.searchParams.set( "pongInterval", this.#pongInterval );

            this.#url = url;
        }

        return this.#url;
    }

    set url ( value ) {
        const url = this._resolveURL( value );

        this.#hostname = url.hostname;
        this.#port = url.port;
        this.#pathname = url.pathname;

        if ( url.username ) this.token = url.username;

        this.#optionsUpdated();
    }

    get httpURL () {
        if ( !this.#httpURL ) {
            const url = new URL( this.url );

            if ( url.protocol === "ws:" ) url.protocol = "http:";
            else if ( url.protocol === "wss:" ) url.protocol = "https:";

            url.searchParams.delete( "maxConnections" );
            url.searchParams.delete( "pongInterval" );

            this.#httpURL = url;
        }

        return this.#httpURL;
    }

    get websocketsURL () {
        if ( !this.#websocketsURL ) {
            const url = new URL( this.url );

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            if ( this.#maxConnections !== DEFAULT_MAX_CONNECTIONS ) url.searchParams.set( "maxConnections", this.#maxConnections );
            if ( this.#pongInterval !== DEFAULT_PONG_INTERVAL ) url.searchParams.set( "pongInterval", this.#pongInterval );

            this.#websocketsURL = url;
        }

        return this.#websocketsURL;
    }

    get persistent () {
        return this.#persistent;
    }

    set persistent ( value ) {
        if ( value == null || value === "" ) {
            if ( this.#protocol.startsWith( "ws" ) ) value = true;
            else value = false;
        }
        else {
            value = value === true || value === "true";
        }

        this.#persistent = value;

        if ( this.#persistent ) {
            if ( this.#protocol === "http:" ) this.#protocol = "ws:";
            else if ( this.#protocol === "https:" ) this.#protocol = "wss:";
        }
        else {
            if ( this.#protocol === "ws:" ) this.#protocol = "http:";
            else if ( this.#protocol === "wss:" ) this.#protocol = "https:";
        }

        this.#optionsUpdated();
    }

    get token () {
        return this.#token;
    }

    set token ( value ) {
        this.#token = value || null;

        this.#optionsUpdated();
    }

    get json () {
        return this.#json;
    }

    set json ( value ) {
        value = value === true || value === "true";

        this.#json = value;

        this.#optionsUpdated();
    }

    get version () {
        return this.#version;
    }

    set version ( value ) {
        value ||= DEFAULT_VERSION;

        this.#version = value;

        this.#optionsUpdated();
    }

    get maxConnections () {
        return this.#maxConnections;
    }

    set maxConnections ( value ) {
        if ( value == null || value === "" ) value = DEFAULT_MAX_CONNECTIONS;
        else if ( value === Infinity ) value = 0;
        else value = +value;

        if ( isNaN( value ) ) value = DEFAULT_MAX_CONNECTIONS;
        else if ( value < 0 ) value = DEFAULT_MAX_CONNECTIONS;

        this.#maxConnections = value;

        this.#optionsUpdated();
    }

    get pongInterval () {
        return this.#pongInterval;
    }

    set pongInterval ( value ) {
        if ( value == null || value === "" ) value = DEFAULT_PONG_INTERVAL;
        else value = +value;

        if ( isNaN( value ) ) value = DEFAULT_PONG_INTERVAL;
        else if ( value < 0 ) value = DEFAULT_PONG_INTERVAL;

        this.#pongInterval = value;

        this.#optionsUpdated();
    }

    get onRPC () {
        return this.#onRPC;
    }

    set onRPC ( value ) {
        this.#onRPC = value;
    }

    // private
    #optionsUpdated () {
        this.#url = null;
        this.#httpURL = null;
        this.#websocketsURL = null;
    }
}

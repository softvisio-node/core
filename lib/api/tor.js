import "#index";

import Events from "events";
import net from "net";
import ReadLine from "readline";

// EVENTS:
// CIRC - Circuit status changed
// STREAM - Stream status changed
// ORCONN - OR Connection status changed
// BW - Bandwidth used in the last second
// ADDRMAP - New Address mapping
// DESCCHANGED -Our descriptor changed
// SIGNAL - Signal received

export default class Tor extends Events {
    #host;
    #port;
    #password;
    #socket;
    #commands = [];
    #events = {};

    constructor ( host, port, password ) {
        super();

        this.#host = host;
        this.#port = port;
        this.#password = password || "";
    }

    async connect () {
        if ( this.#socket ) return this.#socket;

        return new Promise( resolve => {
            const socket = net.connect( this.#port, this.#host, async () => {
                this.#socket = socket;

                socket.on( "close", () => {
                    this.#socket = null;
                } );

                ReadLine.createInterface( socket, socket ).on( "line", this.#onData.bind( this ) );

                // authenticate
                await this.#command( `AUTHENTICATE "${this.#password}"` );

                resolve( socket );
            } );
        } );
    }

    #onData ( data ) {
        data = data.split( " " );

        const status = data.shift();

        // command ok
        if ( status === "250" ) {
            const cb = this.#commands.shift();

            if ( cb ) cb( result( 200 ) );
        }

        // command error
        else if ( status === "510" ) {
            const cb = this.#commands.shift();

            if ( cb ) cb( result( 500 ) );
        }

        // event
        else if ( status === "650" ) {
            const name = data.shift();

            this.emit( name, data );
        }
    }

    async #command ( command ) {
        const socket = await this.connect();

        return new Promise( resolve => {
            socket.write( command + "\r\n" );

            this.#commands.push( resolve );
        } );
    }

    async #subscribe ( name ) {
        if ( !this.#events[name] ) {
            this.#command( "SETEVENTS " + name );
        }
    }

    async newNym () {
        return this.#command( "SIGNAL NEWNYM" );
    }

    async quit () {
        return this.#command( "QUIT" );
    }

    on ( name, cb ) {
        this.#subscribe( name );

        super.on( name, cb );
    }

    once ( name, cb ) {
        this.#subscribe( name );

        super.once( name, cb );
    }
}

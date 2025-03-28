import "#lib/result";
import net from "node:net";
import ReadLine from "node:readline";
import Events from "#lib/events";

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
    #doCommands = [];
    #events = {};

    constructor ( host, port, password ) {
        super();

        this.#host = host;
        this.#port = port;
        this.#password = password || "";
    }

    // public
    async newNym () {
        return this.#doCommand( "SIGNAL NEWNYM" );
    }

    async quit () {
        return this.#doCommand( "QUIT" );
    }

    on ( name, cb ) {
        this.#subscribe( name );

        super.on( name, cb );
    }

    once ( name, cb ) {
        this.#subscribe( name );

        super.once( name, cb );
    }

    // private
    async #connect () {
        if ( this.#socket ) return this.#socket;

        return new Promise( resolve => {
            const socket = net
                .connect( this.#port, this.#host, async () => {
                    this.#socket = socket;

                    ReadLine.createInterface( socket, socket ).on( "line", this.#onData.bind( this ) );

                    // authenticate
                    await this.#doCommand( `AUTHENTICATE "${ this.#password }"` );

                    resolve( result( 200, socket ) );
                } )
                .once( "error", e => {
                    resolve( result.catch( e ) );
                } )
                .once( "close", () => {
                    this.#socket = null;
                } );
        } );
    }

    #onData ( data ) {
        data = data.split( " " );

        const status = data.shift();

        // command ok
        if ( status === "250" ) {
            const cb = this.#doCommands.shift();

            if ( cb ) cb( result( 200 ) );
        }

        // command error
        else if ( status === "510" ) {
            const cb = this.#doCommands.shift();

            if ( cb ) cb( result( 500 ) );
        }

        // event
        else if ( status === "650" ) {
            const name = data.shift();

            this.emit( name, data );
        }
    }

    async #doCommand ( command ) {
        const res = await this.#connect();

        if ( !res.ok ) return res;

        return new Promise( resolve => {
            res.data.write( command + "\r\n" );

            this.#doCommands.push( resolve );
        } );
    }

    async #subscribe ( name ) {
        if ( !this.#events[ name ] ) {
            this.#doCommand( "SETEVENTS " + name );
        }
    }
}

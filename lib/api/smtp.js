const nodemailer = require( "nodemailer" );
const result = require( "@softvisio/core/result" );

class Smtp {
    host = "smtp.gmail.com";
    port = 465;
    username;
    password;
    tls = true;

    constructor ( options = {} ) {
        if ( options.host ) this.host = options.host;
        if ( options.port ) this.port = options.port;
        this.username = options.username;
        this.password = options.password;
        if ( options.tls != null ) this.tls = options.tls;
    }

    async test () {
        return new Promise( ( resolve ) => {} );
    }

    async send () {
        return new Promise( ( resolve ) => {
            var socket = net.connect( this.port, this.host );

            socket.once( "connect", async () => {
                console.log( "CONNECT" );

                socket = new tls.TLSSocket( socket );

                var res = await this._readResponse( socket );

                console.log( res );

                return resolve( result( 200 ) );
            } );
        } );
    }

    async _readResponse ( socket ) {
        return new Promise( ( resolve ) => {
            socket.once( "error", ( data ) => {
                console.log( "ERROR" );
            } );

            socket.once( "close", ( data ) => {
                console.log( "CLOSE" );
            } );

            socket.on( "data", ( data ) => {
                console.log( data );
            } );
        } );
    }
}

module.exports = Smtp;
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 1:7           | no-unused-vars               | 'nodemailer' is assigned a value but never used.                               |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 25:26         | no-undef                     | 'net' is not defined.                                                          |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 30:30         | no-undef                     | 'tls' is not defined.                                                          |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----

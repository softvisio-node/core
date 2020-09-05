const tls = require( "tls" );
const _proxy = require( "./proxy" );
const result = require( "./result" );
const { readLine } = require( "./util" );

const STATUS_REASON = {
    "200": "(nonstandard success response, see rfc876)",
    "211": "System status, or system help reply",
    "214": "Help message",
    "220": "Service ready",
    "221": "Service closing transmission channel",
    "235": "Authentication successful",
    "250": "Requested mail action okay, completed",
    "251": "User not local; will forward to <forward-path>",
    "252": "Cannot VRFY user, but will accept message and attempt delivery",
    "334": "Continue request",
    "354": "Start mail input; end with <CRLF>.<CRLF>",
    "421": "Service not available, closing transmission channel",
    "450": "Requested mail action not taken: mailbox unavailable",
    "451": "Requested action aborted: local error in processing",
    "452": "Requested action not taken: insufficient system storage",
    "500": "Syntax error, command unrecognised",
    "501": "Syntax error in parameters or arguments",
    "502": "Command not implemented",
    "503": "Bad sequence of commands",
    "504": "Command parameter not implemented",
    "521": "Does not accept mail (see rfc1846)",
    "530": "Access denied (???a Sendmailism)",
    "534": "Please log in via your web browser",
    "535": "AUTH failed with the remote server",
    "550": "Requested action not taken: mailbox unavailable",
    "551": "User not local; please try <forward-path>",
    "552": "Requested mail action aborted: exceeded storage allocation",
    "553": "Requested action not taken: mailbox name not allowed",
    "554": "Transaction failed",
    "555": "Syntax error",
};

const Smtp = class {
    #host;
    #port;
    #username;
    #password;
    #tls;
    #proxy;

    constructor ( options ) {
        this.#host = options.host;
        this.#port = options.port;
        this.#username = options.username;
        this.#password = options.password;
        this.#tls = options.tls;
        this.#proxy = _proxy( options.proxy );
    }

    async test () {
        var socket = await this._connect();

        // handshake
        var res = await this._read( socket );
        if ( !res.ok ) return res;

        // EHLO
        res = await this._EHLO( socket );
        if ( !res.ok ) return res;

        // AUTH
        res = await this._AUTH( socket, res.ext.AUTH );

        return res;
    }

    // XXX
    async _connect () {
        var socket;

        if ( this.#proxy ) {
            socket = await this.#proxy.connect( {
                "protocol": "smtp:",
                "hostname": this.#host,
                "port": this.#port,
            } );

            if ( !this.#tls ) return socket;
        }

        return new Promise( resolve => {
            if ( this.#proxy ) {

                // XXX
            }
            else {

                // XXX connect
            }

            if ( this.#tls ) {

                // upgrade socket to TLS
                const tlsSocket = tls.connect( {
                    "socket": socket,
                    "host": this.#host,
                    "servername": this.#host,
                } );

                tlsSocket.once( "end", () => console.log( "TLS connection closed" ) );

                tlsSocket.once( "error", e => console.log( e ) );

                tlsSocket.once( "secureConnect", () => {
                    console.log( "connected" );

                    tlsSocket.removeAllListeners();

                    resolve( tlsSocket );
                } );
            }
        } );
    }

    async _read ( socket ) {
        var status;
        const lines = [];

        while ( 1 ) {
            const line = await readLine( socket, { "eol": "\r\n", "encoding": "utf8" } );

            // protocol error
            if ( line == null ) return result( [500, "Disconnected"] );

            status = +line.substr( 0, 3 );

            lines.push( line.substr( 4 ) );

            if ( line.substr( 3, 1 ) !== "-" ) break;
        }

        return result( [status, STATUS_REASON[status]], lines );
    }

    async _EHLO ( socket ) {
        socket.write( "EHLO localhost.localdomain\r\n" );

        const res = await this._read( socket );

        if ( !res.ok ) return res;

        res.ext = Object.fromEntries( res.data
            .map( item => {
                const match = item.match( /^([A-Z\d]+)\s?(.*)/ );

                if ( match ) return [match[1], match[2] || true];
            } )
            .filter( item => item ) );

        return res;
    }

    async _AUTH ( socket, auth ) {
        console.log( auth );

        // CRAM-MD5 PLAIN LOGIN DIGEST-MD5 NTLM
        // gmail: LOGIN PLAIN XOAUTH2 PLAIN-CLIENTTOKEN OAUTHBEARER XOAUTH

        return result( 300 );
    }

    _MAIL_FROM ( socket, from ) {
        socket.write( "MAIL FROM:<" + from + ">\r\n" );

        return this._read( socket );
    }

    // XXX
    async _RCPT_TO ( socket ) {}

    // XXX
    async _DATA ( socket ) {}

    async _QUIT ( socket ) {
        socket.write( "QUIT\r\n" );

        // do not read QUIT response
        return result( [221, STATUS_REASON[221]] );
    }

    _RSET ( socket ) {
        socket.write( "RSET\r\n" );

        return this._read( socket );
    }

    // XXX
    async _VRFY ( socket ) {}

    _NOOP ( socket ) {
        socket.write( "NOOP\r\n" );

        return this._read( socket );
    }
};

module.exports = Smtp;

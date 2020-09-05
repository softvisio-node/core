const crypto = require( "crypto" );
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

    #authPlain;

    constructor ( options ) {
        this.#host = options.host;
        this.#port = options.port;
        this.#username = options.username;
        this.#password = options.password;
        this.#tls = options.tls;
        this.#proxy = _proxy( options.proxy );
    }

    get _authPlain () {
        if ( !this.#authPlain ) {
            this.#authPlain = "AUTH PLAIN " + Buffer.from( "\0" + this.#username + "\0" + this.#password ).toString( "base64" ) + "\r\n";
        }

        return this.#authPlain;
    }

    async test () {
        const socket = await this._connect();

        // handshake
        var res = await this._read( socket );
        if ( !res.ok ) return this._finish( socket, res );

        // EHLO
        res = await this._EHLO( socket );
        if ( !res.ok ) return this._finish( socket, res );

        // AUTH
        res = await this._AUTH( socket, res.ext.AUTH );

        return this._finish( socket, res );
    }

    // XXX - prepare params
    // from, replyTo, to, cc, bcc, subject, text
    async sendMail ( options ) {
        const socket = await this._connect();

        // handshake
        var res = await this._read( socket );
        if ( !res.ok ) return this._finish( socket, res );

        // EHLO
        res = await this._EHLO( socket );
        if ( !res.ok ) return this._finish( socket, res );

        // AUTH
        res = await this._AUTH( socket, res.ext.AUTH );
        if ( !res.ok ) return this._finish( socket, res );

        // FROM
        res = await this._MAIL_FROM( socket, this.#username );
        if ( !res.ok ) return this._finish( socket, res );

        // TO
        const to = [];
        if ( options.to ) Array.isArray( options.to ) ? to.push( ...options.to ) : to.push( options.to );
        if ( options.cc ) Array.isArray( options.cc ) ? to.push( ...options.cc ) : to.push( options.cc );
        if ( options.bcc ) Array.isArray( options.bcc ) ? to.push( ...options.bcc ) : to.push( options.bcc );

        res = await this._RCPT_TO( socket, to );
        if ( !res.ok ) return this._finish( socket, res );

        // DATA
        res = await this._DATA( socket, options );
        if ( !res.ok ) return this._finish( socket, res );

        // QUIT
        res = await this._QUIT( socket );

        return this._finish( socket, res );
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

    _finish ( socket, res ) {
        socket.end();

        return res;
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
        auth = Object.fromEntries( auth.split( /\s+/ ).map( item => [item, true] ) );

        var res;

        // cram-md5
        if ( auth["CRAM-MD5"] ) {
            socket.write( "AUTH CRAM-MD5\r\n" );

            res = await this._read( socket );
            if ( res.status !== 334 ) return res;

            const challenge = Buffer.from( res.data[0], "base64" ).toString( "ascii" ),
                hmac_md5 = crypto.createHmac( "md5", this.#password );

            hmac_md5.update( challenge );

            socket.write( Buffer.from( this.#username + " " + hmac_md5.digest( "hex" ) ).toString( "base64" ) + "\r\n" );

            res = await this._read( socket );
        }

        // plain
        else if ( auth.PLAIN ) {
            socket.write( this._authPlain );

            res = await this._read( socket );
        }

        // login
        else if ( auth.LOGIN ) {
            socket.write( "AUTH LOGIN\r\n" );
            res = await this._read( socket );
            if ( res.status !== 334 ) return res;
            if ( res.data[0] !== "VXNlcm5hbWU6" ) return result( [503, STATUS_REASON[503]] );

            socket.write( Buffer.from( this.#username ).toString( "base64" ) + "\r\n" );
            res = await this._read( socket );
            if ( res.status !== 334 ) return res;
            if ( res.data[0] !== "UGFzc3dvcmQ6" ) return result( [503, STATUS_REASON[503]] );

            socket.write( Buffer.from( this.#password ).toString( "base64" ) + "\r\n" );
            res = await this._read( socket );
        }

        // no supported auth method found
        else {
            res = result( [535, "No authentication method supported"] );
        }

        return res;
    }

    async _MAIL_FROM ( socket, from ) {
        socket.write( "MAIL FROM:<" + from + ">\r\n" );

        return this._read( socket );
    }

    async _RCPT_TO ( socket, addresses ) {
        for ( let n = 0; n < addresses.length; n++ ) {
            socket.write( "RCPT TO:<" + addresses[n] + ">\r\n" );

            const res = await this._read( socket );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async _DATA ( socket, options ) {
        socket.write( "DATA\r\n" );

        var res = await this._read( socket );
        if ( res.status !== 354 ) return res;

        var buf = "";

        // HEADERS
        buf += "From:" + ( options.from || this.#username ) + "\r\n";
        if ( options.replyTo ) buf += "Reply-To:" + options.replyTo + "\r\n";
        if ( options.to ) buf += "To:" + options.to.join( "," ) + "\r\n";
        if ( options.cc ) buf += "Cc:" + options.cc.join( "," ) + "\r\n";
        if ( options.subject ) buf += "Subject:" + options.subject + "\r\n";

        buf += "\r\n";

        // BODY
        if ( options.text ) {
            buf += options.text.replace( /\n\./gm, "\n.." ) + "\r\n";
        }

        buf += ".\r\n";

        socket.write( buf );

        return this._read( socket );
    }

    async _QUIT ( socket ) {
        socket.write( "QUIT\r\n" );

        // do not read QUIT response
        return result( [221, STATUS_REASON[221]] );
    }

    async _RSET ( socket ) {
        socket.write( "RSET\r\n" );

        return this._read( socket );
    }

    // XXX
    async _VRFY ( socket ) {}

    async _NOOP ( socket ) {
        socket.write( "NOOP\r\n" );

        return this._read( socket );
    }
};

module.exports = Smtp;

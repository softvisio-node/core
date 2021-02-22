const crypto = require( "crypto" );
const net = require( "net" );
const tls = require( "tls" );
const dns = require( "./dns" );
const Proxy = require( "./proxy" );
const result = require( "./result" );
require( "./stream" );

const DEFAULT_PORT = 587;
const DEFAULT_VERIFY_PORT = 25;

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

class SmtpConnection {
    #hostname;
    #port;
    #username;
    #password;
    #proxy;
    #socket;

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        this.#hostname = url.hostname;
        this.#port = url.port || DEFAULT_PORT;
        this.#username = url.username;
        this.#password = url.password;

        this.#proxy = Proxy.new( options.proxy );
    }

    get isConnected () {
        return !!this.#socket;
    }

    // XXX TLS
    // XXX error, end
    async connect () {

        // proxy connection
        if ( this.#proxy ) {
            try {
                this.#socket = await this.#proxy.connect( {
                    "protocol": "smtp:",
                    "hostname": this.#hostname,
                    "port": this.#port,
                } );
            }
            catch ( e ) {
                return result( 500 );
            }
        }

        // direct connection
        else {
            const res = await new Promise( resolve => {
                this.#socket = new net.Socket();

                this.#socket.once( "end", () => resolve( result( [500, "Connection closed"] ) ) );

                this.#socket.once( "error", e => resolve( result( [500, e.message] ) ) );

                this.#socket.once( "ready", () => {
                    this.#socket.removeAllListeners();

                    resolve( result( 200 ) );
                } );

                this.#socket.connect( this.#port, this.#hostname );
            } );

            if ( !res.ok ) return res;
        }

        this.#socket.once( "end", () => {
            this.#socket = null;
        } );

        // upgrade socket to TLS
        // XXX
        const res = new Promise( ( resolve, reject ) => {
            const tlsSocket = tls.connect( {
                "socket": this.#socket,
                "host": this.#hostname,
                "servername": this.#hostname,
            } );

            tlsSocket.once( "end", () => resolve( result( [500, "TLS connection closed"] ) ) );

            tlsSocket.once( "error", e => resolve( result( [500, e.message] ) ) );

            tlsSocket.once( "secureConnect", () => {

                // tlsSocket.removeAllListeners();

                this.#socket = tlsSocket;

                resolve( result( 200 ) );
            } );
        } );

        return res;
    }

    async #read () {
        var status;
        const lines = [];

        while ( 1 ) {
            const line = await this.#socket.readLine( { "eol": "\r\n", "encoding": "utf8" } );

            // protocol error
            if ( line == null ) return result( [500, "Disconnected"] );

            status = +line.substr( 0, 3 );

            lines.push( line.substr( 4 ) );

            if ( line.substr( 3, 1 ) !== "-" ) break;
        }

        return result( [status, STATUS_REASON[status]], lines );
    }

    // COMMANDS
    async ehlo () {
        this.#socket.write( "EHLO localhost.localdomain\r\n" );

        const res = await this.#read();

        if ( !res.ok ) return res;

        res.ext = Object.fromEntries( res.data
            .map( item => {
                const match = item.match( /^([A-Z\d]+)\s?(.*)/ );

                if ( match ) return [match[1], match[2] || true];
            } )
            .filter( item => item ) );

        return res;
    }
}

const Smtp = class {
    #host;
    #port;
    #username;
    #password;
    #proxy;

    #authPlain;

    constructor ( url, options = {} ) {
        if ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            this.#host = url.host;
            this.#port = url.port || DEFAULT_PORT;
            this.#username = url.username;
            this.#password = url.password;
        }

        this.#proxy = Proxy.new( options.proxy );
    }

    get _authPlain () {
        if ( !this.#authPlain ) {
            this.#authPlain = "AUTH PLAIN " + Buffer.from( "\0" + this.#username + "\0" + this.#password ).toString( "base64" ) + "\r\n";
        }

        return this.#authPlain;
    }

    async test () {
        var socket;

        try {
            socket = await this._connect();
        }
        catch ( e ) {
            return result( [500, e.message || e] );
        }

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

    // from - "email@addr" or "User Name <email@addr>"
    // replyTo, to, cc, bcc, subject, text
    async sendMail ( options ) {
        var socket;

        try {
            socket = await this._connect();
        }
        catch ( e ) {
            return result( [500, e.message || e] );
        }

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
        res = await this._MAIL_FROM( socket );
        if ( !res.ok ) return this._finish( socket, res );

        // prepare addresses
        const addresses = {
            "to": options.to ? ( Array.isArray( options.to ) ? options.to : [options.to] ) : [],
            "cc": options.cc ? ( Array.isArray( options.cc ) ? options.cc : [options.cc] ) : [],
            "bcc": options.bcc ? ( Array.isArray( options.bcc ) ? options.bcc : [options.bcc] ) : [],
        };

        // TO
        res = await this._RCPT_TO( socket, addresses );
        if ( !res.ok ) return this._finish( socket, res );

        // DATA
        res = await this._DATA( socket, options, addresses );
        if ( !res.ok ) return this._finish( socket, res );

        // QUIT
        res = await this._QUIT( socket );

        return this._finish( socket, res );
    }

    // XXX
    // XXX proxy support
    async verifyEmail ( email ) {
        try {
            email = new URL( "smtp://" + email );
        }
        catch ( e ) {
            return result( [400, `Email is invalid`] );
        }

        const mx = await dns.resolveMx( email.hostname );

        if ( !mx ) return result( [500, `Unable to resolve hostname`] );

        var smtpHostname;

        for ( const row of mx ) {
            if ( row.exchange ) {
                smtpHostname = row.exchange;

                break;
            }
        }

        if ( !smtpHostname ) return result( [500, `Unable to find MX record`] );

        const conn = new SmtpConnection( {
            "hostname": smtpHostname,
            "port": email.port || DEFAULT_VERIFY_PORT,
        } );

        var res = await conn.connect();
        if ( !res.ok ) return res;

        res = conn.ehlo();
        if ( !res.ok ) return res;

        // socket.write( "VRFY:" + email.username + "@" + email.hostname + "\r\n" );
        // res = await read( socket );
        // console.log( res + "" );

        // res = this._MAIL_FROM( socket, "test@vasyns.com" );
        // if ( !res.ok ) return res;

        // res = this._RCPT_TO( socket, email.username + "@" + email.hostname );
        // if ( !res.ok ) return res;

        // socket.end();

        return result( 200 );
    }

    async _connect () {
        var socket;

        // proxy connection
        if ( this.#proxy ) {
            socket = await this.#proxy.connect( {
                "protocol": "smtp:",
                "hostname": this.#host,
                "port": this.#port,
            } );
        }

        // direct connection
        else {
            socket = await new Promise( ( resolve, reject ) => {
                const socket = new net.Socket();

                socket.once( "end", () => reject( "Connection closed" ) );

                socket.once( "error", e => reject( e.message ) );

                socket.once( "ready", () => {
                    socket.removeAllListeners();

                    resolve( socket );
                } );

                socket.connect( this.#port, this.#host );
            } );
        }

        // if (!this.#tls) return socket;

        // upgrade socket to TLS
        return new Promise( ( resolve, reject ) => {
            const tlsSocket = tls.connect( {
                socket,
                "host": this.#host,
                "servername": this.#host,
            } );

            tlsSocket.once( "end", () => reject( "TLS connection closed" ) );

            tlsSocket.once( "error", e => reject( e.message ) );

            tlsSocket.once( "secureConnect", () => {
                tlsSocket.removeAllListeners();

                resolve( tlsSocket );
            } );
        } );
    }

    async _read ( socket ) {
        var status;
        const lines = [];

        while ( 1 ) {
            const line = await socket.readLine( { "eol": "\r\n", "encoding": "utf8" } );

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

    // supported methods in priority order: CRAM-MD5, PLAIN, LOGIN
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

    async _MAIL_FROM ( socket ) {
        socket.write( "MAIL FROM:<" + this.#username + ">\r\n" );

        return this._read( socket );
    }

    async _RCPT_TO ( socket, addresses ) {

        // to
        for ( let n = 0; n < addresses.to.length; n++ ) {
            socket.write( "RCPT TO:<" + addresses.to[n] + ">\r\n" );

            const res = await this._read( socket );

            if ( !res.ok ) return res;
        }

        // cc
        for ( let n = 0; n < addresses.cc.length; n++ ) {
            socket.write( "RCPT TO:<" + addresses.cc[n] + ">\r\n" );

            const res = await this._read( socket );

            if ( !res.ok ) return res;
        }

        // bcc
        for ( let n = 0; n < addresses.bcc.length; n++ ) {
            socket.write( "RCPT TO:<" + addresses.bcc[n] + ">\r\n" );

            const res = await this._read( socket );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async _DATA ( socket, options, addresses ) {
        socket.write( "DATA\r\n" );

        var res = await this._read( socket );
        if ( res.status !== 354 ) return res;

        var buf = "";

        // HEADERS
        buf += "From:" + ( options.from || this.#username ) + "\r\n";
        if ( options.replyTo ) buf += "Reply-To:" + options.replyTo + "\r\n";
        if ( addresses.to.length ) buf += "To:" + addresses.to.join( "," ) + "\r\n";
        if ( addresses.cc.length ) buf += "Cc:" + addresses.cc.join( "," ) + "\r\n";
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

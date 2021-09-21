import "#lib/result";
import "#lib/stream";

import crypto from "crypto";
import net from "net";
import tls from "tls";
import { resolveMx } from "#lib/dns";
import ProxyClient from "#lib/proxy";

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
    #isTls;
    #_authPlain;
    extensions = {};

    constructor ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        this.#hostname = url.hostname;
        this.#port = url.port || DEFAULT_PORT;
        this.#username = url.username;
        this.#password = url.password;

        this.#proxy = ProxyClient.new( options.proxy );
    }

    get isConnected () {
        return !!this.#socket;
    }

    get isTls () {
        return !!this.#isTls;
    }

    get #authPlain () {
        if ( !this.#_authPlain ) {
            this.#_authPlain = "AUTH PLAIN " + Buffer.from( "\0" + this.#username + "\0" + this.#password ).toString( "base64" );
        }

        return this.#_authPlain;
    }

    #write ( data ) {
        if ( !this.#socket ) return;

        this.#socket.write( data + "\r\n" );
    }

    async #read () {
        var status;
        const lines = [];

        while ( 1 ) {
            const line = await this.#socket.readLine( { "eol": "\r\n", "encoding": "utf8" } );

            // protocol error
            if ( line == null ) return this.#end( result( [500, "Disconnected"] ) );

            status = +line.substr( 0, 3 );

            lines.push( line.substr( 4 ) );

            if ( line.substr( 3, 1 ) === " " ) break;
        }

        return result( [status, STATUS_REASON[status]], lines );
    }

    async #ehlo ( hostname ) {
        this.#write( `EHLO ${hostname || "localhost.localdomain"}` );

        const res = await this.#read();
        if ( !res.ok ) return this.#end( res );

        this.extensions = {};

        for ( const line of res.data ) {
            const match = line.match( /^([A-Z\d]+)\s?(.*)/ );

            if ( match ) this.extensions[match[1]] = match[2] || true;
        }

        return res;
    }

    async #startTls () {
        var res = await new Promise( ( resolve, reject ) => {
            const socket = tls.connect( {
                "socket": this.#socket,
                "host": this.#hostname,
                "servername": this.#hostname,
            } );

            socket.once( "end", () => resolve( result( [500, "TLS connection closed"] ) ) );

            socket.once( "error", e => resolve( result( [500, e.message] ) ) );

            socket.once( "secureConnect", () => {
                this.#socket = socket;
                this.#isTls = true;

                this.#socket.removeAllListeners();

                this.#socket.once( "end", () => this.#end.bind( this ) );

                resolve( result( 200 ) );
            } );
        } );

        if ( !res.ok ) return this.#end( res );

        return res;
    }

    #end ( res ) {
        this.#socket = null;

        this.#isTls = false;

        this.extensions = {};

        return res;
    }

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
                const socket = new net.Socket();

                socket.once( "end", () => resolve( result( [500, "Connection closed"] ) ) );

                socket.once( "error", e => resolve( result( [500, e.message] ) ) );

                socket.once( "ready", () => {
                    this.#socket = socket;

                    this.#socket.removeAllListeners();

                    resolve( result( 200 ) );
                } );

                socket.connect( this.#port, this.#hostname );
            } );

            if ( !res.ok ) return res;
        }

        this.#socket.once( "end", () => this.#end.bind( this ) );

        // upgrade socket
        if ( this.#port === 465 ) {
            const res = await this.#startTls();
            if ( !res.ok ) return res;
        }

        // read initial message
        var res = await this.#read();
        if ( !res.ok ) return this.#end( res );

        // ehlo
        res = await this.#ehlo();
        if ( !res.ok ) return this.#end( res );

        return res;
    }

    // commands
    async startTls () {
        if ( this.#isTls ) return result( [200, `Connection is already TLS`] );

        if ( !this.extensions.STARTTLS ) return result( [200, `TLS is not supported`] );

        this.#write( "STARTTLS" );

        var res = await this.#read();
        if ( !res.ok ) return this.#end( res );

        res = this.#startTls();
        if ( !res.ok ) return this.#end( res );

        // ehlo
        res = await this.#ehlo();
        if ( !res.ok ) return this.#end( res );

        return res;
    }

    // supported methods in priority order: CRAM-MD5, PLAIN, LOGIN
    async auth () {
        if ( !this.extensions.AUTH ) return result( [400, `Authentication is not supported`] );

        const auth = Object.fromEntries( this.extensions.AUTH.split( /\s+/ ).map( item => [item, true] ) );

        var res;

        // cram-md5
        if ( auth["CRAM-MD5"] ) {
            this.#write( "AUTH CRAM-MD5" );

            res = await this.#read();
            if ( res.status !== 334 ) return res;

            const challenge = Buffer.from( res.data[0], "base64" ).toString( "ascii" ),
                hmac_md5 = crypto.createHmac( "md5", this.#password );

            hmac_md5.update( challenge );

            this.#write( Buffer.from( this.#username + " " + hmac_md5.digest( "hex" ) ).toString( "base64" ) );

            res = await this.#read();
        }

        // plain
        else if ( auth.PLAIN ) {
            this.#write( this.#authPlain );

            res = await this.#read();
        }

        // login
        else if ( auth.LOGIN ) {
            this.#write( "AUTH LOGIN" );

            res = await this.#read();
            if ( res.status !== 334 ) return res;

            if ( res.data[0] !== "VXNlcm5hbWU6" ) return result( [503, STATUS_REASON[503]] );

            this.#write( Buffer.from( this.#username ).toString( "base64" ) );

            res = await this.#read();
            if ( res.status !== 334 ) return res;

            if ( res.data[0] !== "UGFzc3dvcmQ6" ) return result( [503, STATUS_REASON[503]] );

            this.#write( Buffer.from( this.#password ).toString( "base64" ) );

            res = await this.#read();
        }

        // no supported auth method found
        else {
            res = result( [535, "No authentication method supported"] );
        }

        return res;
    }

    async from ( username ) {
        this.#write( `MAIL FROM:<${username || this.#username}>` );

        return this.#read();
    }

    async to ( addresses ) {

        // to
        for ( let n = 0; n < addresses.to.length; n++ ) {
            this.#write( `RCPT TO:<${addresses.to[n]}>` );

            const res = await this.#read();

            if ( !res.ok ) return res;
        }

        // cc
        for ( let n = 0; n < addresses.cc.length; n++ ) {
            this.#write( `RCPT TO:<${addresses.cc[n]}>` );

            const res = await this.#read();

            if ( !res.ok ) return res;
        }

        // bcc
        for ( let n = 0; n < addresses.bcc.length; n++ ) {
            this.#write( `RCPT TO:<${addresses.bcc[n]}>` );

            const res = await this.#read();

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async data ( options, addresses ) {
        this.#write( "DATA" );

        var res = await this.#read();
        if ( res.status !== 354 ) return res;

        var buf = "";

        // headers
        buf += "From:" + ( options.from || this.#username ) + "\r\n";
        if ( options.replyTo ) buf += "Reply-To:" + options.replyTo + "\r\n";
        if ( addresses.to.length ) buf += "To:" + addresses.to.join( "," ) + "\r\n";
        if ( addresses.cc.length ) buf += "Cc:" + addresses.cc.join( "," ) + "\r\n";
        if ( options.subject ) buf += "Subject:" + options.subject + "\r\n";

        buf += "\r\n";

        // body
        if ( options.text ) {
            buf += options.text.replace( /\n\./gm, "\n.." ) + "\r\n.";
        }

        this.#write( buf );

        return this.#read();
    }

    async rset () {
        this.#write( "RSET" );

        return this.#read();
    }

    async vrfy ( address ) {
        this.#write( `VRFY: <${address}>` );

        return this.#read();
    }

    async noop () {
        this.#write( "NOOP" );

        return this.#read();
    }

    quit ( res ) {
        this.#write( "QUIT" );

        this.#end();

        // do not read QUIT response
        return res || result( [221, STATUS_REASON[221]] );
    }
}

export default class SMTP {
    #hostname;
    #port;
    #username;
    #password;
    #proxy;

    #_connection;

    static get SmtpConnection () {
        return SmtpConnection;
    }

    // XXX
    static async verifyEmail ( email, proxy ) {
        try {
            email = new URL( "smtp://" + email );
        }
        catch ( e ) {
            return result( [400, `Email is invalid`] );
        }

        const mx = await resolveMx( email.hostname );

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
        },
        { "proxy": ProxyClient.new( proxy ) } );

        // connect
        var res = await conn.connect();
        if ( !res.ok ) return conn.quit( res );

        // socket.write( "VRFY:" + email.username + "@" + email.hostname + "\r\n" );
        // res = await read( socket );
        // console.log( res + "" );

        res = await conn.from( "test@vasyns.com" );
        if ( !res.ok ) return conn.quit( res );

        res = conn.to( email.username + "@" + email.hostname );

        return conn.quit( res );
    }

    constructor ( url, options = {} ) {
        if ( url ) {
            if ( typeof url === "string" ) url = new URL( url );

            this.#hostname = url.hostname;
            this.#port = url.port || DEFAULT_PORT;
            this.#username = url.username;
            this.#password = url.password;
        }

        this.#proxy = ProxyClient.new( options.proxy );
    }

    get #connection () {
        if ( !this.#_connection ) {
            this.#_connection = new SmtpConnection( {
                "hostname": this.#hostname,
                "port": this.#port,
                "username": this.#username,
                "password": this.#password,
            },
            { "proxy": this.#proxy } );
        }

        return this.#_connection;
    }

    async test () {
        const conn = this.#connection;

        // connect
        var res = await conn.connect();
        if ( !res.ok ) return conn.quit( res );

        // start TLS
        res = await conn.startTls();
        if ( !res.ok ) return conn.quit( res );

        // auth
        res = await conn.auth();

        return conn.quit( res );
    }

    // from - "email@addr" or "User Name <email@addr>"
    // replyTo, to, cc, bcc, subject, text
    async send ( options ) {
        const conn = this.#connection;

        // connect
        var res = await conn.connect();
        if ( !res.ok ) return conn.quit( res );

        // start TLS
        res = await conn.startTls();
        if ( !res.ok ) return conn.quit( res );

        // auth
        res = await conn.auth();
        if ( !res.ok ) return conn.quit( res );

        // from
        res = await conn.from();
        if ( !res.ok ) return conn.quit( res );

        // prepare addresses
        const addresses = {
            "to": options.to ? ( Array.isArray( options.to ) ? options.to : [options.to] ) : [],
            "cc": options.cc ? ( Array.isArray( options.cc ) ? options.cc : [options.cc] ) : [],
            "bcc": options.bcc ? ( Array.isArray( options.bcc ) ? options.bcc : [options.bcc] ) : [],
        };

        // to
        res = await conn.to( addresses );
        if ( !res.ok ) return conn.quit( res );

        // data
        res = await conn.data( options, addresses );

        return conn.quit( res );
    }
}

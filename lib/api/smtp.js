import "#lib/result";
import "#lib/stream";
import net from "net";
import tls from "tls";
import { resolveMx } from "#lib/dns";
import ProxyClient from "#lib/proxy";
import Semaphore from "#lib/threads/semaphore";
import Sasl from "#lib/sasl";

const DEFAULT_PORT = 587;
const DEFAULT_VERIFY_PORT = 25;
const DEFAULT_MAX_THREADS = 10;

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
    #url;
    #proxy;
    #socket;
    #isTls;
    #extensions = {};

    constructor ( url, { proxy } = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        this.#url = url;
        this.#url.port ||= DEFAULT_PORT;

        this.#proxy = ProxyClient.new( proxy );
    }

    // public
    async connect () {

        // proxy connection
        if ( this.#proxy ) {
            try {
                this.#socket = await this.#proxy.connect( {
                    "protocol": "smtp:",
                    "hostname": this.#url.hostname,
                    "port": this.#url.port,
                } );
            }
            catch ( e ) {
                return result.catch( e, { "keepError": true, "silent": true } );
            }
        }

        // direct connection
        else {
            const res = await new Promise( resolve => {
                const socket = new net.Socket();

                socket.once( "error", e => resolve( result( [500, e.message] ) ) );

                socket.once( "connect", () => {
                    this.#socket = socket;

                    this.#socket.removeAllListeners( "error" );

                    resolve( result( 200 ) );
                } );

                socket.connect( this.#url.port, this.#url.hostname );
            } );

            if ( !res.ok ) return res;
        }

        // upgrade socket
        if ( +this.#url.port === 465 ) {
            const res = await this.#startTls();
            if ( !res.ok ) return res;
        }

        // read initial message
        var res = await this.#read();
        if ( !res.ok ) return res;

        // ehlo
        return this.#ehlo();
    }

    destroy ( res ) {
        if ( this.#socket ) this.#socket.destroy();

        return res;
    }

    // commands
    async startTls () {
        if ( this.#isTls ) return result( [200, `Connection is already TLS`] );

        if ( !this.#extensions.STARTTLS ) return result( [200, `TLS is not supported`] );

        this.#write( "STARTTLS" );

        var res = await this.#read();
        if ( !res.ok ) return res;

        res = await this.#startTls();
        if ( !res.ok ) return res;

        // ehlo
        return this.#ehlo();
    }

    // supported methods in priority order: CRAM-MD5, PLAIN, LOGIN
    async auth () {
        if ( !this.#extensions.AUTH ) return this.destroy( result( [400, `Authentication is not supported`] ) );

        const sasl = await Sasl.new( this.#extensions.AUTH.split( /\s+/ ), decodeURIComponent( this.#url.username ), decodeURIComponent( this.#url.password ) );

        if ( !sasl ) return this.destroy( result( [535, "No authentication method supported"] ) );

        var res;

        this.#write( "AUTH " + sasl.type );
        res = await this.#read();
        if ( res.status !== 334 ) return res;

        while ( 1 ) {
            const response = sasl.continue( res.data[0] );

            if ( !response ) return result( [535, "No authentication failed"] );

            this.#write( response );

            res = await this.#read();

            if ( res.status !== 334 ) return res;
        }
    }

    // XXX check SEND AS ANY extension
    async from ( username ) {
        this.#write( `MAIL FROM:<${username || decodeURIComponent( this.#url.username )}>` );

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

    // XXX check SEND AS ANY extension
    async data ( subject, body, addresses ) {
        this.#write( "DATA" );

        var res = await this.#read();
        if ( res.status !== 354 ) return res;

        var buf = "";

        // headers
        buf += "From:" + ( addresses.from || decodeURIComponent( this.#url.username ) ) + "\r\n";
        if ( addresses.replyTo ) buf += "Reply-To:" + addresses.replyTo + "\r\n";
        if ( addresses.to.length ) buf += "To:" + addresses.to.join( "," ) + "\r\n";
        if ( addresses.cc.length ) buf += "Cc:" + addresses.cc.join( "," ) + "\r\n";

        if ( subject ) buf += "Subject:" + subject + "\r\n";

        buf += "\r\n";

        // body
        if ( body ) {
            buf += body.replace( /\n\./gm, "\n.." ) + "\r\n.";
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

        // do not read QUIT response
        return this.destroy( res || result( [221, STATUS_REASON[221]] ) );
    }

    // private
    #write ( data ) {
        this.#socket.write( data + "\r\n" );
    }

    async #read () {
        var status;
        const lines = [];

        while ( 1 ) {
            const line = await this.#socket.readLine( { "eol": "\r\n", "encoding": "utf8" } ).catch( e => null );

            // protocol error or disconnected
            if ( line == null ) return this.destroy( result( [500, "SMTP server closed connection"] ) );

            status = +line.substring( 0, 3 );

            lines.push( line.substring( 4 ) );

            if ( line.substring( 3, 4 ) === " " ) break;
        }

        return result( [status, STATUS_REASON[status]], lines );
    }

    async #ehlo ( hostname ) {
        this.#write( `EHLO ${hostname || "localhost.localdomain"}` );

        const res = await this.#read();
        if ( !res.ok ) return res;

        this.#extensions = {};

        for ( const line of res.data ) {
            const match = line.match( /^([A-Z\d]+)\s?(.*)/ );

            if ( match ) this.#extensions[match[1]] = match[2] || true;
        }

        return res;
    }

    async #startTls () {
        return new Promise( ( resolve, reject ) => {
            const socket = tls.connect( {
                "socket": this.#socket,
                "host": this.#url.hostname,
                "servername": this.#url.hostname,
            } );

            socket.once( "error", e => resolve( result( [500, e.message] ) ) );

            socket.once( "secureConnect", () => {
                this.#socket = socket;
                this.#isTls = true;

                this.#socket.removeAllListeners( "error" );

                resolve( result( 200 ) );
            } );
        } );
    }
}

export default class Smtp {
    #url;
    #proxy;
    #semaphore;

    constructor ( url, { proxy, maxThreads } = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        this.#url = url;
        this.#url.port ||= DEFAULT_PORT;

        this.#proxy = ProxyClient.new( proxy );

        this.#semaphore = new Semaphore( { "maxThreads": maxThreads || DEFAULT_MAX_THREADS } );
    }

    // static
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

        const connection = new SmtpConnection( {
            "hostname": smtpHostname,
            "port": email.port || DEFAULT_VERIFY_PORT,
        },
        { "proxy": ProxyClient.new( proxy ) } );

        // connect
        var res = await connection.connect();
        if ( !res.ok ) return connection.quit( res );

        // socket.write( "VRFY:" + email.username + "@" + email.hostname + "\r\n" );
        // res = await read( socket );
        // console.log( res + "" );

        res = await connection.from( "test@vasyns.com" );
        if ( !res.ok ) return connection.quit( res );

        res = connection.to( email.username + "@" + email.hostname );

        return connection.quit( res );
    }

    // properties
    get url () {
        return this.#url;
    }

    // public
    async testSmtp () {
        await this.#semaphore.startThread();

        const connection = new SmtpConnection( this.#url, { "proxy": this.#proxy } );

        var res;

        try {

            // connect
            res = await connection.connect();
            if ( !res.ok ) throw res;

            // start TLS
            res = await connection.startTls();
            if ( !res.ok ) throw res;

            // auth
            res = await connection.auth();

            res = connection.quit( res );
        }
        catch ( e ) {
            res = connection.quit( result.catch( e ) );
        }

        this.#semaphore.endThread();

        return res;
    }

    async sendEmail ( to, subject, body, { cc, bcc, from, replyTo } = {} ) {
        await this.#semaphore.startThread();

        const connection = new SmtpConnection( this.#url, { "proxy": this.#proxy } );

        var res;

        try {

            // connect
            res = await connection.connect();
            if ( !res.ok ) throw res;

            // start TLS
            res = await connection.startTls();
            if ( !res.ok ) throw res;

            // auth
            res = await connection.auth();
            if ( !res.ok ) throw res;

            // from
            res = await connection.from( from );
            if ( !res.ok ) throw res;

            // prepare addresses
            const addresses = {
                "to": to ? ( Array.isArray( to ) ? to : [to] ) : [],
                "cc": cc ? ( Array.isArray( cc ) ? cc : [cc] ) : [],
                "bcc": bcc ? ( Array.isArray( bcc ) ? bcc : [bcc] ) : [],
                "from": from || this.#url.seatchParams?.get( "from" ),
                "replyTo": replyTo || this.#url.seatchParams?.get( "replyTo" ),
            };

            // to
            res = await connection.to( addresses );
            if ( !res.ok ) throw res;

            // data
            res = await connection.data( subject, body, addresses );
            if ( !res.ok ) throw res;

            res = connection.quit();
        }
        catch ( e ) {
            res = connection.quit( result.catch( e ) );
        }

        this.#semaphore.endThread();

        return res;
    }

    toString () {
        return this.#url.href;
    }

    toJSON () {
        return this.#url.href;
    }
}

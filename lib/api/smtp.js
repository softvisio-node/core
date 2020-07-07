const nodemailer = require( "nodemailer" );
const result = require( "@softvisio/core/result" );

class Smtp {
    #transport;

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
        return new Promise( resolve => {
            const transport = this._getTransport();

            transport.verify( ( error, success ) => {
                if ( error ) {
                    resolve( result( [500, error.response] ) );
                }
                else {
                    resolve( result( 200 ) );
                }
            } );
        } );
    }

    async sendMail ( args ) {
        const transport = this._getTransport();

        const res = await transport.sendMail( args );

        return result( 200, res );
    }

    _getTransport () {
        if ( !this.#transport ) {
            this.#transport = nodemailer.createTransport( {
                "host": this.host,
                "port": this.port,
                "secure": this.tls,
                "auth": {
                    "user": this.username,
                    "pass": this.password,
                },
                "tls": {
                    "rejectUnauthorized": false, // do not fail on invalid certs
                },
            } );
        }

        return this.#transport;
    }
}

module.exports = Smtp;

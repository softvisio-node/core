import crypto from "crypto";

const SUPPORTED_MECHANISMS = new Set( ["SCRAM-SHA-256"] );

export default class Sasl {
    #mechanism;
    #nonce;
    #serverSignature;

    constructor ( mechanisms ) {
        for ( const mechanism of mechanisms ) {
            if ( SUPPORTED_MECHANISMS.has( mechanism ) ) {
                this.#mechanism = mechanism;

                break;
            }
        }
    }

    // properties
    get mechanism () {
        return this.#mechanism;
    }

    get nonce () {
        this.#nonce ||= crypto.randomBytes( 18 ).toString( "base64" );

        return this.#nonce;
    }

    // public
    initialize () {
        return "n,,n=*,r=" + this.nonce;
    }

    continue ( msg, password ) {
        msg = this.#parseMsg( msg );

        if ( !msg.r.startsWith( this.nonce ) ) return;
        if ( msg.r.length === this.nonce.length ) return;

        const salt = Buffer.from( msg.s, "base64" ),
            saltedPassword = this.#hi( password, salt, msg.i );

        var clientKey = this.#hmacSha256( saltedPassword, "Client Key" );
        var storedKey = this.#sha256( clientKey );

        var clientFirstMessageBare = "n=*,r=" + this.nonce;
        var serverFirstMessage = "r=" + msg.r + ",s=" + msg.s + ",i=" + msg.i;

        var clientFinalMessageWithoutProof = "c=biws,r=" + msg.r;

        var authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;

        var clientSignature = this.#hmacSha256( storedKey, authMessage );
        var clientProofBytes = this.#xorBuffers( clientKey, clientSignature );
        var clientProof = clientProofBytes.toString( "base64" );

        var serverKey = this.#hmacSha256( saltedPassword, "Server Key" );
        var serverSignatureBytes = this.#hmacSha256( serverKey, authMessage );

        this.#serverSignature = serverSignatureBytes.toString( "base64" );

        return clientFinalMessageWithoutProof + ",p=" + clientProof;
    }

    // XXX validate response
    finalize ( msg ) {
        return true;

        // if ( session.message !== "SASLResponse" ) {
        //     throw new Error( "SASL: Last message was not SASLResponse" );
        // }
        // if ( typeof serverData !== "string" ) {
        //     throw new Error( "SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string" );
        // }

        // const { serverSignature } = parseServerFinalMessage( serverData );

        // if ( serverSignature !== session.serverSignature ) {
        //     throw new Error( "SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match" );
        // }
    }

    // private
    #parseMsg ( msg ) {
        const data = {};

        for ( const token of msg.split( "," ) ) {
            data[token[0]] = token.substr( 2 );
        }

        return data;
    }

    #hi ( password, saltBytes, iterations ) {
        var ui1 = this.#hmacSha256( password, Buffer.concat( [saltBytes, Buffer.from( [0, 0, 0, 1] )] ) ),
            ui = ui1;

        for ( var i = 0; i < iterations - 1; i++ ) {
            ui1 = this.#hmacSha256( password, ui1 );

            ui = this.#xorBuffers( ui, ui1 );
        }

        return ui;
    }

    #xorBuffers ( a, b ) {
        if ( !Buffer.isBuffer( a ) ) {
            throw new TypeError( "first argument must be a Buffer" );
        }
        if ( !Buffer.isBuffer( b ) ) {
            throw new TypeError( "second argument must be a Buffer" );
        }
        if ( a.length !== b.length ) {
            throw new Error( "Buffer lengths must match" );
        }
        if ( a.length === 0 ) {
            throw new Error( "Buffers cannot be empty" );
        }
        return Buffer.from( a.map( ( _, i ) => a[i] ^ b[i] ) );
    }

    #sha256 ( text ) {
        return crypto.createHash( "sha256" ).update( text ).digest();
    }

    #hmacSha256 ( key, msg ) {
        return crypto.createHmac( "sha256", key ).update( msg ).digest();
    }
}

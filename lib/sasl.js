import crypto from "crypto";

const SUPPORTED_MECHANISMS = new Set( ["SCRAM-SHA-256"] );

export default class Sasl {
    #mechanism;
    #stage = 0;
    #nonce;
    #signature;

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

    // public
    initialize () {
        if ( !this.#mechanism || this.#stage !== 0 ) return;

        this.#stage++;

        this.#nonce = crypto.randomBytes( 18 ).toString( "base64" );

        return "n,,n=*,r=" + this.#nonce;
    }

    continue ( msg, password ) {
        if ( !this.#mechanism || this.#stage !== 1 ) return;

        this.#stage++;

        msg = this.#parseMsg( msg );

        if ( !msg.r.startsWith( this.#nonce ) ) return;
        if ( msg.r.length === this.#nonce.length ) return;

        const salt = Buffer.from( msg.s, "base64" ),
            saltedPassword = this.#hi( password, salt, msg.i );

        var clientKey = this.#hmacSha256( saltedPassword, "Client Key" );
        var storedKey = this.#sha256( clientKey );

        var clientFirstMessageBare = "n=*,r=" + this.#nonce;
        var serverFirstMessage = "r=" + msg.r + ",s=" + msg.s + ",i=" + msg.i;

        var clientFinalMessageWithoutProof = "c=biws,r=" + msg.r;

        var authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;

        var clientSignature = this.#hmacSha256( storedKey, authMessage );
        var clientProofBytes = this.#xorBuffers( clientKey, clientSignature );
        var clientProof = clientProofBytes.toString( "base64" );

        var serverKey = this.#hmacSha256( saltedPassword, "Server Key" );
        var serverSignatureBytes = this.#hmacSha256( serverKey, authMessage );

        this.#signature = serverSignatureBytes.toString( "base64" );

        return clientFinalMessageWithoutProof + ",p=" + clientProof;
    }

    finalize ( msg ) {
        if ( !this.#mechanism || this.#stage !== 2 ) return;

        this.#stage++;

        msg = this.#parseMsg( msg );

        if ( msg.v !== this.#signature ) return;

        return true;
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
        return Buffer.from( a.map( ( _, i ) => a[i] ^ b[i] ) );
    }

    #sha256 ( text ) {
        return crypto.createHash( "sha256" ).update( text ).digest();
    }

    #hmacSha256 ( key, msg ) {
        return crypto.createHmac( "sha256", key ).update( msg ).digest();
    }
}

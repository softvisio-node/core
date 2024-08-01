import Sasl from "#lib/sasl";
import crypto from "crypto";

export default class SaslScramSha256 extends Sasl {
    #nonce;
    #signature;

    // properties
    get type () {
        return "SCRAM-SHA-256";
    }

    // public
    continue ( response ) {
        if ( !response ) {
            this.#nonce ??= crypto.randomBytes( 18 ).toString( "base64" );

            return "n,,n=*,r=" + this.#nonce;
        }
        else {
            response = this.#parseResponse( response );

            if ( response.r ) {
                if ( !response.r.startsWith( this.#nonce ) ) return;
                if ( response.r.length === this.#nonce.length ) return;

                const salt = Buffer.from( response.s, "base64" ),
                    saltedPassword = this.#hi( this.password, salt, response.i ),
                    clientKey = this.#hmacSha256( saltedPassword, "Client Key" ),
                    storedKey = this.#sha256( clientKey ),
                    clientFirstMessageBare = "n=*,r=" + this.#nonce,
                    serverFirstMessage = "r=" + response.r + ",s=" + response.s + ",i=" + response.i,
                    clientFinalMessageWithoutProof = "c=biws,r=" + response.r,
                    authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof,
                    clientSignature = this.#hmacSha256( storedKey, authMessage ),
                    clientProofBytes = this.#xorBuffers( clientKey, clientSignature ),
                    clientProof = clientProofBytes.toString( "base64" ),
                    serverKey = this.#hmacSha256( saltedPassword, "Server Key" ),
                    serverSignatureBytes = this.#hmacSha256( serverKey, authMessage );

                this.#signature = serverSignatureBytes.toString( "base64" );

                return clientFinalMessageWithoutProof + ",p=" + clientProof;
            }
            else {
                if ( response.v !== this.#signature ) return;

                return true;
            }
        }
    }

    // private
    #parseResponse ( response ) {
        const data = {};

        for ( const token of response.split( "," ) ) {
            data[ token[ 0 ] ] = token.substring( 2 );
        }

        return data;
    }

    #hi ( password, saltBytes, iterations ) {
        var ui1 = this.#hmacSha256( password, Buffer.concat( [ saltBytes, Buffer.from( [ 0, 0, 0, 1 ] ) ] ) ),
            ui = ui1;

        for ( var i = 0; i < iterations - 1; i++ ) {
            ui1 = this.#hmacSha256( password, ui1 );

            ui = this.#xorBuffers( ui, ui1 );
        }

        return ui;
    }

    #xorBuffers ( a, b ) {
        return Buffer.from( a.map( ( _, i ) => a[ i ] ^ b[ i ] ) );
    }

    #sha256 ( text ) {
        return crypto.createHash( "sha256" ).update( text ).digest();
    }

    #hmacSha256 ( key, msg ) {
        return crypto.createHmac( "sha256", key ).update( msg ).digest();
    }
}

import crypto from "node:crypto";
import Sasl from "#lib/sasl";

export default class SaslCramMd5 extends Sasl {

    // properties
    get type () {
        return "CRAM-MD5";
    }

    // public
    continue ( response ) {
        if ( !response ) return this.type;

        const challenge = Buffer.from( response, "base64" ).toString( "ascii" ),
            hmacMd5 = crypto.createHmac( "md5", this.password );

        hmacMd5.update( challenge );

        return Buffer.from( this.username + " " + hmacMd5.digest( "hex" ) ).toString( "base64" );
    }
}

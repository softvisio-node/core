import Sasl from "#lib/sasl";

export default class SaslLogin extends Sasl {

    // properties
    get type () {
        return "LOGIN";
    }

    // public
    continue ( response ) {
        if ( !response ) return this.type;
        else if ( response === "VXNlcm5hbWU6" ) return Buffer.from( this.username ).toString( "base64" );
        else if ( response === "UGFzc3dvcmQ6" ) return Buffer.from( this.password ).toString( "base64" );
    }
}

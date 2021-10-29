import Sasl from "#lib/sasl";

export default class SaslPlain extends Sasl {

    // properties
    get type () {
        return "PLAIN";
    }

    // public
    continue ( response ) {
        return Buffer.from( "\0" + this.username + "\0" + this.password ).toString( "base64" );
    }
}

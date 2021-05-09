const TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

class GoogleUule {
    toUule ( name ) {
        const key = TABLE[name.length];

        return "w+CAIQICI" + key + Buffer.from( name, "ascii" ).toString( "base64url" );
    }

    fromUule ( uule ) {
        return Buffer.from( uule.substr( 10 ), "base64url" ).toString();
    }
}

export default new GoogleUule();

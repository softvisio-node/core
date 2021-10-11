const TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function encode ( name ) {
    const key = TABLE[name.length];

    return "w+CAIQICI" + key + Buffer.from( name, "ascii" ).toString( "base64url" );
}

export function decode ( uule ) {
    return Buffer.from( uule.substr( 10 ), "base64url" ).toString();
}

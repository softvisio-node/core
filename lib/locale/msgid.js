import isBrowser from "#lib/is-browser";

export default class MsgId {
    #strings;
    #args;
    #id;

    constructor ( strings, args ) {
        this.#strings = strings;
        this.#args = args;
    }

    // properties
    get id () {
        this.#id ??= this.#strings.join( "${n}" );

        return this.#id;
    }

    // public
    toString () {
        return this.id;
    }

    translate ( translation ) {
        if ( !this.#args.length ) return translation ?? this.#id;

        var i = 0;

        return ( translation || this.id ).replaceAll( "${n}", () => this.#args[ i++ ] );
    }
}

function msgid ( strings, ...args ) {
    return new MsgId( strings, args );
}

// register msgid globally
if ( isBrowser ) {
    if ( !globalThis.msgid ) {
        Object.defineProperty( globalThis, "msgid", {
            "configurable": false,
            "writable": false,
            "enumerable": true,
            "value": msgid,
        } );
    }
}
else if ( !globalThis.msgid ) {
    Object.defineProperty( globalThis, "msgid", {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        "value": msgid,
    } );
}

import { "default" as _ejs, Template } from "ejs";
import { fileURLToPath } from "node:url";

export { Template };

class Ejs {
    #tenderer;

    constructor ( template, options ) {
        this.#tenderer = _ejs.compile( template, options );
    }

    // properties
    get [Symbol.for( "ejs-template" )] () {
        return true;
    }

    // public
    render ( data ) {
        return this.#tenderer( data );
    }
}

export default function ejs ( template, options ) {
    if ( template instanceof Ejs ) {
        return template;
    }
    else {
        return new Ejs( template, options );
    }
}

Object.defineProperties( ejs, {
    "compile": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        value ( template, options ) {
            return _ejs.compile( template, options );
        },
    },

    "render": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        value ( template, data, options ) {
            return _ejs.render( template, data, options );
        },
    },

    "renderFile": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        async value ( path, data, options ) {
            if ( path instanceof URL ) {
                path = fileURLToPath( path );
            }

            return _ejs.renderFile( path, data, options );
        },
    },
} );

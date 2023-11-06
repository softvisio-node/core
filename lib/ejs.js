import _ejs from "ejs";
import { fileURLToPath } from "node:url";

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

export default function ejs ( template, ...args ) {
    if ( template instanceof Ejs ) {
        return template;
    }
    else if ( Array.isArray( template ) ) {
        let tmpl;

        if ( args.length ) {
            tmpl = "";

            for ( let n = 0; n < template.length; n++ ) {
                tmpl += template[n];

                if ( n < args.length ) {
                    tmpl += args[n];
                }
            }
        }
        else {
            tmpl = template[0];
        }

        return new Ejs( tmpl );
    }
    else {
        return new Ejs( template, args[0] );
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
    },
} );

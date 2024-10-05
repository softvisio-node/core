import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { "default" as _ejs, Template } from "ejs";

export { Template };

class Ejs {
    #tenderer;

    constructor ( template, options ) {
        this.#tenderer = _ejs.compile( template, options );
    }

    // properties
    get [ Symbol.for( "ejs-template" ) ] () {
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
    "fromFile": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        value ( path, options ) {
            return new Ejs( fs.readFileSync( path, "utf8" ), options );
        },
    },

    "render": {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        value ( template, data, options ) {
            return ejs( template, options ).render( data );
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

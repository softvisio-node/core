import ejs from "ejs";

export default class Ejs {
    #tenderer;

    constructor ( template, options ) {
        this.#tenderer = ejs.compile( template, options );
    }

    // static
    static new ( template, options ) {
        if ( template instanceof Ejs ) {
            return template;
        }
        else {
            return new this( template, options );
        }
    }

    static compile ( template, options ) {
        return ejs.compile( template, options );
    }

    static render ( template, data, options ) {
        return ejs.render( template, data, options );
    }

    static async renderFile ( path, data, options ) {
        return ejs.renderFile( path, data, options );
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

function compileTemplate ( strings, ...args ) {
    var template;

    if ( args.length ) {
        template = "";

        for ( let n = 0; n < strings.length; n++ ) {
            template += strings[n];

            if ( n < args.length ) {
                template += args[n];
            }
        }
    }
    else {
        template = strings[0];
    }

    return new Ejs( template );
}

if ( !global.ejs ) {
    Object.defineProperty( global, "ejs", {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        "value": compileTemplate,
    } );
}

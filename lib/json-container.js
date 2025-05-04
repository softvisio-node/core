import { mergeObjects } from "#lib/utils";

var STARTED = 0,
    OPTIONS;

export default class JsonContainer {
    #data;
    #options;

    constructor ( data, options ) {
        this.#data = data;
        this.#options = options;
    }

    // static
    static get isStarted () {
        return STARTED > 0;
    }

    static get options () {
        return OPTIONS;
    }

    // properties
    get data () {
        return this.#data;
    }

    get options () {
        return this.#options;
    }

    // public
    toJSON () {

        // merge options
        if ( this.#options ) {
            if ( OPTIONS ) {
                OPTIONS = mergeObjects( {}, this.#options, OPTIONS );
            }
            else {
                OPTIONS = this.#options;
            }
        }

        if ( typeof this.#data?.toJSON === "function" ) {
            return this.#data.toJSON();
        }
        else {
            return this.#data;
        }
    }

    toString () {
        if ( this.#data == null ) return this.#data;

        STARTED++;

        // merge options
        if ( this.#options ) {
            if ( OPTIONS ) {
                OPTIONS = mergeObjects( {}, this.#options, OPTIONS );
            }
            else {
                OPTIONS = this.#options;
            }
        }

        try {
            const data = this.#data + "";

            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            return data;
        }
        catch ( e ) {
            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            throw e;
        }
    }
}

const stringify = JSON.stringify;

Object.defineProperty( JSON, "stringify", {
    "enumrable": false,
    value ( data, replacer, space ) {
        STARTED++;

        try {
            data = stringify( data, replacer, space );

            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            return data;
        }
        catch ( e ) {
            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            throw e;
        }
    },
} );

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

        // create options
        this.#createOptions();

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

        // create options
        this.#createOptions();

        try {
            const data = this.#data + "";

            // cleanup
            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            return data;
        }
        catch ( e ) {

            // cleanup
            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            throw e;
        }
    }

    // private
    #createOptions () {
        if ( this.#options ) {
            if ( OPTIONS ) {
                OPTIONS = mergeObjects( {}, this.#options, OPTIONS );
            }
            else {
                OPTIONS = this.#options;
            }
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

            // cleanup
            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            return data;
        }
        catch ( e ) {

            // cleanup
            STARTED--;
            if ( !STARTED ) OPTIONS = null;

            throw e;
        }
    },
} );

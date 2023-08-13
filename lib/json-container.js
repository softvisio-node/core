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

    // public
    // XXX merge options
    toJSON () {
        OPTIONS = this.#options;

        if ( typeof this.#data?.toJSON === "function" ) {
            return this.#data.toJSON();
        }
        else {
            return this.#data;
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

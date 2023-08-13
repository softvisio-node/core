const options = Symbol();

export default class JsonContainer {
    #data;
    #options;

    constructor ( data, options ) {
        this.#data = data;
        this.#options = options;
    }

    // static
    static get options () {
        return ( global[options] ||= {} );
    }

    // properties
    get data () {
        return this.#data;
    }

    // public
    toJSON () {
        global[options] = this.#options;

        if ( typeof this.#data?.toJSON === "function" ) {
            return this.#data.toJSON();
        }
        else {
            return this.#data;
        }
    }
}

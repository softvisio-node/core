const Http = require( "./http" );

module.exports = class extends Http {
    #websocketUrl;

    // XXX
    constructor ( options ) {
        super( options );
    }

    get websocketUrl () {
        if ( !this.#websocketUrl ) {
            const url = new URL( this.url );

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            this.#websocketUrl = url;
        }

        return this.#websocketUrl;
    }

    set url ( value ) {
        super.url = null;

        this.#websocketUrl = null;

        // close connection if url was updated
        this.#close();
    }

    set token ( value ) {

        // close connection if token was updated
        this.#close();
    }

    // protected
    async _connect () {}

    // private
    #close () {}
};

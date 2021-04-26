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

            url.username = "";
            url.password = "";
            url.search = "";
            url.hash = "";

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

    set persistent ( value ) {
        if ( this.persistent ) this._connect();
        else this.#close();
    }

    // protected
    async _connect () {}

    // private
    #close () {}
};

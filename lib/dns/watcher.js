import Events from "#lib/events";
import dns from "dns";
import Mutex from "#lib/threads/mutex";

export default class DnsWatcher extends Events {
    #hostname;
    #initialInterval;
    #maxInterval;

    #ref = true;
    #started = false;
    #mutex = new Mutex();
    #timeout;
    #interval;
    #addresses = new Set();

    constructor ( hostname, { initialInterval, maxInterval } = {} ) {
        super();

        this.#hostname = hostname;
        this.#initialInterval = initialInterval || 5000;
        this.#maxInterval = maxInterval || 60000;
    }

    // properties
    get isStarted () {
        return this.#started;
    }

    // public
    async resolve ( force ) {
        if ( !force && this.#addresses.size ) return this.#addresses;

        return this.#resolve();
    }

    stop () {
        this.#started = false;

        return this.reset();
    }

    start () {
        this.#started = true;

        return this.reset();
    }

    reset () {
        this.#addresses.clear();
        this.#interval = null;

        this.#setTimeout();

        return this;
    }

    ref () {
        this.#ref = true;

        if ( this.#timeout ) this.#timeout.ref();

        return this;
    }

    unref () {
        this.#ref = false;

        if ( this.#timeout ) this.#timeout.unref();

        return this;
    }

    // private
    async #resolve ( auto ) {
        if ( !this.#mutex.tryDown() ) return this.#mutex.signal.wait();

        clearTimeout( this.#timeout );

        try {
            var records = await dns.promises.lookup( this.#hostname, { "all": true, "family": 0 } );
        }
        catch ( e ) {}

        var added = [],
            deleted = [];

        // no records
        if ( !records ) {
            if ( this.listenerCount( "delete" ) ) {
                deleted = [...this.#addresses];
            }

            this.#interval = null;
            this.#addresses.clear();
        }
        else {

            // create index
            const addresses = new Set( records.map( record => record.address ) );

            // find added
            if ( this.listenerCount( "add" ) ) {
                for ( const address of addresses ) {
                    if ( !this.#addresses.has( address ) ) added.push( address );
                }
            }

            // find deleted
            if ( this.listenerCount( "delete" ) ) {
                for ( const address of this.#addresses ) {
                    if ( !addresses.has( address ) ) deleted.push( address );
                }
            }

            this.#addresses = addresses;
        }

        this.#setTimeout( auto );

        // emit events
        if ( added.length ) this.emit( "add", added );
        if ( deleted.length ) this.emit( "delete", deleted );

        this.#mutex.signal.broadcast( this.#addresses );
        this.#mutex.up();

        return this.#addresses;
    }

    #setTimeout ( auto ) {
        clearTimeout( this.#timeout );

        if ( !this.#started ) return;

        if ( !this.#interval ) {
            this.#interval = this.#initialInterval;
        }
        else if ( auto ) {
            this.#interval *= 2;

            if ( this.#interval > this.#maxInterval ) this.#interval = this.#maxInterval;
        }

        this.#timeout = setTimeout( () => this.#resolve( true ), this.#interval );

        if ( !this.#ref ) this.#timeout.unref();
    }
}

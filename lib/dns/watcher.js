import Events from "#lib/events";
import dns from "dns";
import Mutex from "#lib/threads/mutex";

export default class DnsWatcher extends Events {
    #hostname;
    #initialInterval;
    #maxInterval;

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
        this.#interval = null;

        this.#setTimeout();

        return this;
    }

    // private
    async #resolve () {
        if ( !this.#mutex.tryDown ) return this.#mutex.signal.wait();

        const records = await dns.promises.lookup( this.#hostname, { "all": true, "family": 0 } );

        var addresses,
            added = [],
            deleted = [];

        // no records
        if ( !records ) {
            this.reset();

            addresses = new Set();

            if ( this.listenerCount( "delete" ) ) {
                deleted = [...this.#addresses];
            }
        }
        else {

            // create index
            addresses = new Set( records.map( record => record.address ) );

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
        }

        this.#addresses = addresses;

        // emit events
        if ( added.length ) this.emit( "add", added );
        if ( deleted.length ) this.emit( "delete", deleted );

        this.#mutex.signal.broadcast( this.#addresses );
        this.#mutex.up();

        return this.#addresses;
    }

    #setTimeout () {
        clearTimeout( this.#timeout );

        if ( !this.#started ) return;

        if ( !this.#interval ) {
            this.#interval = this.#initialInterval;
        }
        else {
            this.#interval *= 2;

            if ( this.#interval > this.#maxInterval ) this.#interval = this.#maxInterval;
        }

        this.#timeout = setTimeout( () => {
            this.#setTimeout();

            this.#resolve();
        }, this.#interval );
    }
}

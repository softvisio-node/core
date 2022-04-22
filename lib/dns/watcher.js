import Events from "#lib/events";
import dns from "dns";
import Mutex from "#lib/threads/mutex";

const DEFAULT_MIN_INTERVAL = 1000,
    DEFAULT_MAX_INTERVAL = 60000,
    DEFAULT_STEP = 5000;

export default class DnsWatcher extends Events {
    #hostname;
    #minInterval;
    #maxInterval;
    #step;

    #ref = true;
    #started = false;
    #mutex = new Mutex();
    #timeout;
    #interval;
    #addresses = new Set();

    constructor ( hostname, { minInterval, maxInterval, step } = {} ) {
        super();

        this.#hostname = hostname;
        this.#minInterval = minInterval || DEFAULT_MIN_INTERVAL;
        this.#maxInterval = maxInterval ?? DEFAULT_MAX_INTERVAL;
        this.#step = step || DEFAULT_STEP;
    }

    // properties
    get isStarted () {
        return this.#started;
    }

    get addresses () {
        return this.#addresses;
    }

    // public
    async lookup ( { force, silent } = {} ) {
        if ( !force && this.#addresses.size ) return this.#addresses;

        return this.#resolve( false, silent );
    }

    start () {
        if ( this.#started ) return this;

        this.#started = true;

        this.#setTimeout();

        return this;
    }

    restart () {
        this.#started = true;

        return this.resetInterval();
    }

    stop () {
        if ( !this.#started ) return this;

        this.#started = false;

        this.#setTimeout();

        return this;
    }

    reset () {
        this.clearAddresses();

        this.resetInterval();

        return this;
    }

    clearAddresses () {
        this.#addresses.clear();

        return this;
    }

    resetInterval () {
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
    async #resolve ( auto, silent ) {
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
            if ( !silent && this.listenerCount( "delete" ) ) {
                deleted = [...this.#addresses];
            }

            this.#interval = null;
            this.#addresses.clear();
        }
        else {

            // create index
            const addresses = new Set( records.map( record => record.address ) );

            // find added
            if ( !silent && this.listenerCount( "add" ) ) {
                for ( const address of addresses ) {
                    if ( !this.#addresses.has( address ) ) added.push( address );
                }
            }

            // find deleted
            if ( !silent && this.listenerCount( "delete" ) ) {
                for ( const address of this.#addresses ) {
                    if ( !addresses.has( address ) ) deleted.push( address );
                }
            }

            this.#addresses = addresses;
        }

        this.#setTimeout( auto );

        // emit events
        if ( !silent ) {
            if ( added.length ) this.emit( "add", added );
            if ( deleted.length ) this.emit( "delete", deleted );
        }

        this.#mutex.signal.broadcast( this.#addresses );
        this.#mutex.up();

        return this.#addresses;
    }

    #setTimeout ( auto ) {
        clearTimeout( this.#timeout );

        if ( !this.#started ) return;

        if ( !this.#interval ) {
            this.#interval = this.#minInterval;
        }
        else if ( auto ) {
            if ( this.#maxInterval ) {
                this.#interval += this.#step;

                if ( this.#interval > this.#maxInterval ) this.#interval = this.#maxInterval;
            }
            else {
                this.#interval = this.#step;
            }
        }

        this.#timeout = setTimeout( () => this.#resolve( true ), this.#interval );

        if ( !this.#ref ) this.#timeout.unref();
    }
}

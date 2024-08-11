import Events from "#lib/events";
import dns from "node:dns";
import Mutex from "#lib/threads/mutex";

const DEFAULT_MIN_INTERVAL = 1000,
    DEFAULT_MAX_INTERVAL = 60000,
    DEFAULT_STEP = 5000;

const FAMILY = new Set( [ 0, 4, 6 ] );

export default class DnsWatcher extends Events {
    #hostname;
    #family;
    #minInterval;
    #maxInterval;
    #step;

    #ref = true;
    #isStarted = false;
    #mutex = new Mutex();
    #timeout;
    #interval;
    #firstStep;
    #lastUpdated;
    #addresses = new Set();

    constructor ( hostname, { family, minInterval, maxInterval, step } = {} ) {
        super();

        this.#hostname = hostname;
        this.#family = family || 0;
        this.#minInterval = minInterval || DEFAULT_MIN_INTERVAL;
        this.#maxInterval = maxInterval ?? DEFAULT_MAX_INTERVAL;
        this.#step = step || DEFAULT_STEP;

        if ( !FAMILY.has( this.#family ) ) throw Error( `IP address family is invalid` );
    }

    // properties
    get hostname () {
        return this.#hostname;
    }

    get family () {
        return this.#family;
    }

    get isStarted () {
        return this.#isStarted;
    }

    get lastUpdated () {
        return this.#lastUpdated;
    }

    get addresses () {
        return this.#addresses;
    }

    get hasRef () {
        return this.#ref;
    }

    // public
    async lookup ( { force, silent } = {} ) {
        if ( !force && this.#addresses.size ) return this.#addresses;

        return this.#lookup( false, silent );
    }

    start () {
        if ( this.#isStarted ) return this;

        this.#isStarted = true;

        return this.reset();
    }

    restart () {
        this.#isStarted = true;

        return this.reset();
    }

    resume () {
        if ( this.#isStarted ) return this;

        this.#isStarted = true;

        return this.clearInterval();
    }

    stop () {
        if ( !this.#isStarted ) return this;

        this.#isStarted = false;

        return this.clearInterval();
    }

    reset () {
        this.clearAddresses();

        return this.clearInterval();
    }

    clearAddresses () {
        this.#addresses.clear();

        return this;
    }

    clearInterval () {
        this.#interval = null;

        this.#updateTimeout();

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
    async #lookup ( increaseInterval, silent ) {
        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        // stop lookup timer
        clearTimeout( this.#timeout );

        try {
            var records = await dns.promises.lookup( this.#hostname, { "all": true, "family": this.#family } );
        }
        catch ( e ) {}

        this.#lastUpdated = new Date();

        var added = [],
            deleted = [];

        // no records
        if ( !records ) {
            if ( !silent && this.listenerCount( "delete" ) ) {
                deleted = [ ...this.#addresses ];
            }

            // reset in case if not dns records found
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

        this.#updateTimeout( increaseInterval );

        // emit events
        if ( !silent ) {
            if ( added.length ) this.emit( "add", added );
            if ( deleted.length ) this.emit( "delete", deleted );
        }

        this.#mutex.unlock( this.#addresses );

        return this.#addresses;
    }

    #updateTimeout ( increaseInterval ) {
        clearTimeout( this.#timeout );

        if ( !this.#isStarted ) return;

        // reset interval
        if ( !this.#interval ) {
            this.#interval = this.#minInterval;
            this.#firstStep = true;
        }

        // do not increase interval on manual lookup
        else if ( increaseInterval ) {
            if ( this.#maxInterval ) {
                if ( this.#firstStep ) this.#interval = this.#step;
                else this.#interval += this.#step;

                if ( this.#interval > this.#maxInterval ) this.#interval = this.#maxInterval;
            }
            else {
                this.#interval = this.#step;
            }

            this.#firstStep = false;
        }

        this.#timeout = setTimeout( () => this.#lookup( true ), this.#interval );

        if ( !this.#ref ) this.#timeout.unref();
    }
}

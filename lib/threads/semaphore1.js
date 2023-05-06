import Set from "#lib/threads/set";
import Events from "#lib/events";

class SemapforeSet extends Set {

    // protected
    _createItem ( id, options ) {
        const item = new Semapfore( { id } );

        item.on( "unlock", this._checkFinished.bind( this, id ) );

        return item;
    }

    _isFinished ( item ) {
        return !item.isLocked && !item.waitingThreads;
    }
}

export default class Semapfore {
    #id;
    #value = 0;
    #events = new Events();
    #waitingThreads = [];

    constructor ( { id } = {} ) {
        this.#id = id;
    }

    // static
    static get Set () {
        return SemapforeSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get value () {
        return this.#value;
    }

    set value ( value ) {
        this.#setValue( value );
    }

    get isLocked () {
        return this.#value !== 0;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // public
    up () {
        this.#setValue( this.#value + 1 );
    }

    down () {
        this.#setValue( this.#value - 1 );
    }

    async wait () {
        if ( !this.#value ) return;

        return new Promise( resolve => {
            this.#waitingThreads.push( resolve );
        } );
    }

    on ( name, listener ) {
        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    // private
    #setValue ( value ) {
        if ( !Number.isInteger( value ) ) throw TypeError( `Semapfore value must be integer` );

        if ( this.#value === value ) return;

        this.#value = value;

        if ( !this.#value ) {
            if ( this.#waitingThreads.length ) {
                const waitingThreads = this.#waitingThreads;
                this.#waitingThreads = [];

                for ( let n = 0; n < waitingThreads; n++ ) waitingThreads[n]();
            }

            this.#events.emit( "unlock" );
        }
    }
}

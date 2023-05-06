import Events from "#lib/events";

export default class Counter {
    #value = 0;
    #events = new Events();

    // properties
    get value () {
        return this.#value;
    }

    set value ( value ) {
        if ( !Number.isInteger( value ) ) throw TypeError( `Counter value must be integer` );

        if ( this.#value === value ) return;

        this.#value = value;

        if ( !this.#value ) this.#events.emit( "finish" );
    }

    // public
    increment () {
        this.value++;
    }

    decrement () {
        this.value--;
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
}

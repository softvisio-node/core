import Events from "#lib/events";

export default class Counter {
    #_value = 0;
    #events = new Events();

    // properties
    get value () {
        return this.#_value;
    }

    // public
    inc () {
        this.#value++;
    }

    dec () {
        this.#value--;
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
    set #value ( value ) {
        this.#_value = value;

        if ( !this.#_value ) this.#events.emit( "finish" );
    }
}

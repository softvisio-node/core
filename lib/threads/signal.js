module.exports = class Signal {
    #locked;
    #callbacks = [];

    get locked () {
        return !!this.#locked;
    }

    lock () {
        this.#locked = true;

        return this;
    }

    unlock () {
        if ( !this.#locked ) return;

        this.#locked = false;

        const callbacks = this.#callbacks;

        this.#callbacks = [];

        for ( const callback of callbacks ) callback();

        return this;
    }

    async wait () {
        if ( !this.#locked ) return;

        return new Promise( resolve => this.#callbacks.push( resolve ) );
    }
};

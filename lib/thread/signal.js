class Signal {
    #wake = 0;
    #awaited = [];

    constructor () {}

    async wait () {
        var me = this;

        if ( this.#wake ) {
            this.#wake--;
        }
        else {
            return new Promise( ( resolve ) => {
                me.#awaited.push( resolve );
            } );
        }
    }

    send () {
        if ( this.#awaited.length ) {
            const cb = this.#awaited.shift();

            cb();
        }
        else {
            this.#wake++;
        }
    }

    broadcast () {
        var awaited = this.#awaited;

        this.#awaited = [];

        for ( const cb of awaited ) {
            cb();
        }
    }

    awaited () {
        return this.#awaited.length;
    }
}

module.exports = Signal;

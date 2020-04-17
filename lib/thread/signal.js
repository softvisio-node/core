class Signal {
    constructor () {
        this._awaited = [];
        this._wake = 0;
    }

    async wait () {
        var me = this;

        if ( this._wake ) {
            this._wake--;
        }
        else {
            return new Promise( ( resolve ) => {
                me._awaited.push( resolve );
            } );
        }
    }

    send () {
        if ( this._awaited.length ) {
            const cb = this._awaited.shift();

            cb();
        }
        else {
            this._wake++;
        }
    }

    broadcast () {
        var awaited = this._awaited;

        this._awaited = [];

        for ( const cb of awaited ) {
            cb();
        }
    }

    awaited () {
        return this._awaited.length;
    }
}

module.exports = Signal;

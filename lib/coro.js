class Coro {
    constructor () {
        this.threads = {};
        this.id = 0;
        this.current = null;
    }

    run ( gen ) {
        var promise = new Promise( ( resolve ) => {
            this.current = new Thread( gen, resolve );

            this.current._next();
        } );

        return promise;
    }

    cb () {
        return this.current._cb();
    }

    sleep ( timeout ) {
        setTimeout( this.cb(), timeout );
    }

    // defer () {
    //     // setImmediate( resume );
    // }
}

const coro = new Coro();

class Thread {
    constructor ( thread, resolve ) {
        if ( !thread || typeof thread[Symbol.iterator] !== "function" ) {
            throw new Error( "First parameter must be iterator returned by a generator function." );
        }

        this.id = ++coro.id;
        this.gen = thread;
        this.resolve = resolve;

        coro.threads[this.id] = this;
    }

    _next ( args ) {
        var res = this.gen.next( args );

        if ( res.done ) {
            this._onFinish();

            if ( this.resolve ) this.resolve( res.value );
        }

        return this.promise;
    }

    _cb () {
        var me = this;

        return function ( res ) {
            // switch current thread
            coro.current = me;

            // next iteration
            me._next( res );

            return res;
        };
    }

    _onFinish () {
        delete coro.threads[this.id];
    }
}

module.exports = coro;

// const Pool = require( "@softvisio/core/threads" );

// const pool = new Pool( {
//     "threads": 1,
//     "path": require.resolve( "./worker" ),
//     "constructor": [...args],
// } );

// await pool.rpc_call( "method", arg1, arg2 )

require( "@softvisio/core" );
const Events = require( "events" );
const CondVar = require( "./threads/condvar" );
const { toMsgPack, fromMsgPack } = require( "./msgpack" );
const { Worker } = require( "worker_threads" );
const os = require( "os" );

module.exports = class Threads extends Events {
    #eventNamePrefix = "event";
    #onRpc;

    #requestId = 0;
    #threads = {};
    #callbacks = [];

    constructor ( options = {} ) {
        super();

        // EVENTS
        if ( options.onEvent ) this.on( "event", options.onEvent );
        if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;

        // RPC
        this.#onRpc = options.onRpc;
    }

    async run ( threads ) {
        var cv = new CondVar().begin();

        for ( const threadName in threads ) {
            const thread = threads[threadName];

            let num = thread.num;

            // define number of threads
            if ( !num ) {
                num = os.cpus().length;
            }
            else if ( num < 0 ) {
                num = os.cpus().length + num;

                if ( num < 1 ) num = 1;
            }
            else if ( num > os.cpus().length ) {
                num = os.cpus().length;
            }

            // create threads
            for ( let n = 1; n <= num; n++ ) {
                cv.begin();

                const worker = new Worker( require.resolve( "./threads/worker-thread" ), { "workerData": { "path": thread.path, "constructor": thread.constructor } } );

                if ( !this.#threads[threadName] ) this.#threads[threadName] = [];

                this.#threads[threadName].push( worker );

                worker.on( "message", async msg => {
                    msg = fromMsgPack( Buffer.from( msg ) );

                    if ( msg.type === "event" ) {
                        this.emit( "event", msg.name, msg.args );

                        if ( this.#eventNamePrefix ) this.emit( this.#eventNamePrefix + "/" + msg.name, ...msg.args );
                    }
                    else if ( msg.type === "rpc" ) {

                        // incoming rpc call
                        if ( msg.method ) {
                            if ( this.#onRpc ) {

                                // regular call
                                if ( msg.id ) {
                                    let res;

                                    try {
                                        res = result.tryResult( await this.#onRpc( msg.method, msg.args ) );
                                    }
                                    catch ( e ) {
                                        res = result.catchResult( e );
                                    }

                                    worker.postMessage( toMsgPack( {
                                        "type": "rpc",
                                        "id": msg.id,
                                        "result": res,
                                    } ) );
                                }

                                // void call
                                else {
                                    try {
                                        this.#onRpc( msg.method, msg.args );
                                    }
                                    catch ( e ) {
                                        console.log( e );
                                    }
                                }
                            }

                            // rpc calls are not supported
                            else if ( msg.id ) {

                                // send response if call is not void
                                worker.postMessage( toMsgPack( {
                                    "type": "rpc",
                                    "id": msg.id,
                                    "result": {
                                        "status": 400,
                                        "reason": "Rpc calls are not supported",
                                    },
                                } ) );
                            }
                        }

                        // rpc response
                        else {
                            const callback = this.#callbacks[msg.id];

                            if ( callback ) {
                                delete this.#callbacks[msg.id];

                                callback( result.parseResult( msg.result ) );
                            }
                        }
                    }
                    else if ( msg.type === "worker-ready" ) {
                        cv.end();
                    }
                } );
            }
        }

        return cv.end().recv( () => result( 200 ) );
    }

    // EVENTS
    // */name - send "name" event to all threads
    // @argon2/name - send "name" event to argon2 threads only
    // @type1,@type2/name - send to several threads
    publish ( name, ...args ) {
        const idx = name.indexOf( "/" );

        if ( idx < 1 ) return false;

        const routes = name.substr( 0, idx );

        name = name.substr( idx + 1 );

        var msg = toMsgPack( {
            "type": "event",
            name,
            args,
        } );

        var sent = false;

        for ( const route of routes.split( "," ) ) {

            // to all threads in the pool
            if ( route === "*" ) {
                for ( const thread in this.#threads ) {
                    for ( const worker of this.#threads[thread] ) {
                        sent = true;

                        worker.postMessage( msg );
                    }
                }
            }

            // to group only
            else if ( route.charAt( 0 ) === "@" ) {
                const group = this.#threads[route.substr( 1 )];

                if ( group ) {
                    for ( const worker of group ) {
                        sent = true;

                        worker.postMessage( msg );
                    }
                }
            }
        }

        return sent;
    }

    // RPC
    async call ( method, ...args ) {
        return this._call( method, args, false );
    }

    callVoid ( method, ...args ) {
        this._call( method, args, true );
    }

    async _call ( method, args, isVoid ) {
        const index = method.indexOf( "/" );

        if ( index < 1 ) return result( [404, "Thread Not Found"] );

        const route = method.substr( 0, index );
        method = method.substr( index + 1 );

        const thread = this.#threads[route];

        if ( !thread ) return result( [404, "Thread Not Found"] );

        if ( !thread.length ) return result( [404, "Worker Not Found"] );

        const worker = thread.shift();

        thread.push( worker );

        if ( isVoid ) {
            worker.postMessage( toMsgPack( {
                "type": "rpc",
                method,
                args,
            } ) );
        }
        else {
            return new Promise( resolve => {
                const id = ++this.#requestId;

                this.#callbacks[id] = resolve;

                worker.postMessage( toMsgPack( {
                    "type": "rpc",
                    id,
                    method,
                    args,
                } ) );
            } );
        }
    }
};

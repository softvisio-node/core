// const Pool = require( "@softvisio/core/thread/worker-pool" );

// const pool = new Pool( {
//     "threads": 1,
//     "filename": require.resolve( "./worker" ),
//     "constructor": [...args],
// } );

// await pool.rpc_call( "method", arg1, arg2 )

const EventEmitter = require( "events" );
const CondVar = require( "./condvar" );
const { isMainThread } = require( "worker_threads" );
const { result, parseResult } = require( "../result" );
const { toMessagePack, fromMessagePack } = require( "../util" );

// parent thread
if ( isMainThread ) {
    const { Worker } = require( "worker_threads" );
    const os = require( "os" );

    module.exports = class ThreadsPool extends EventEmitter {
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

                    const worker = new Worker( __filename, { "workerData": { "filename": thread.filename, "constructor": thread.constructor } } );

                    if ( !this.#threads[threadName] ) this.#threads[threadName] = [];

                    this.#threads[threadName].push( worker );

                    worker.on( "message", async msg => {
                        msg = fromMessagePack( Buffer.from( msg ) );

                        if ( msg.type === "event" ) {
                            super.emit( "event", msg.name, msg.args );

                            if ( this.#eventNamePrefix ) super.emit( this.#eventNamePrefix + "/" + msg.name, ...msg.args );
                        }
                        else if ( msg.type === "rpc" ) {

                            // incoming rpc call
                            if ( msg.method ) {
                                if ( this.#onRpc ) {

                                    // regular call
                                    if ( msg.id ) {
                                        const res = parseResult( await this.#onRpc( msg.method, msg.args ) );

                                        worker.postMessage( toMessagePack( {
                                            "type": "rpc",
                                            "id": msg.id,
                                            "result": res,
                                        } ) );
                                    }

                                    // void call
                                    else {
                                        this.#onRpc( msg.method, msg.args );
                                    }
                                }

                                // rpc calls are not supported
                                else if ( msg.id ) {

                                    // send response if call is not void
                                    worker.postMessage( toMessagePack( {
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

                                    callback( result( msg.result ) );
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
        emit ( name, ...args ) {
            const index = name.indexOf( "/" );

            if ( index < 1 ) return false;

            const route = name.substr( 0, index );
            name = name.substr( index + 1 );

            var msg = toMessagePack( {
                "type": "event",
                name,
                args,
            } );

            var sent = false;

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
                worker.postMessage( toMessagePack( {
                    "type": "rpc",
                    method,
                    args,
                } ) );
            }
            else {
                return new Promise( resolve => {
                    const id = ++this.#requestId;

                    this.#callbacks[id] = resolve;

                    worker.postMessage( toMessagePack( {
                        "type": "rpc",
                        id,
                        method,
                        args,
                    } ) );
                } );
            }
        }
    };
}

// worker thread
else {
    const { parentPort, workerData } = require( "worker_threads" );

    const Worker = require( workerData.filename );

    const callbacks = {};

    class Host extends EventEmitter {
        #requestId = 0;

        // EVENTS
        emit ( name, ...args ) {
            parentPort.postMessage( toMessagePack( {
                "type": "event",
                name,
                args,
            } ) );

            return true;
        }

        onRemoteEvent ( name, args ) {
            super.emit( name, ...args );
        }

        // RPC
        async call ( method, ...args ) {
            const id = ++this.#requestId;

            return new Promise( resolve => {
                callbacks[id] = resolve;

                parentPort.postMessage( toMessagePack( {
                    "type": "rpc",
                    "id": id,
                    method,
                    args,
                } ) );
            } );
        }

        callVoid ( method, ...args ) {
            parentPort.postMessage( toMessagePack( {
                "type": "rpc",
                method,
                args,
            } ) );
        }
    }

    global.host = new Host();

    const worker = new Worker( ...workerData.constructor );

    parentPort.on( "message", async function ( msg ) {
        msg = fromMessagePack( Buffer.from( msg ) );

        // event
        if ( msg.type === "event" ) {
            global.host.onRemoteEvent( msg.name, msg.args );
        }

        // rpc
        else if ( msg.type === "rpc" ) {

            // incoming rpc call
            if ( msg.method ) {
                const method = "RPC_" + msg.method.replace( /-/g, "_" );

                // regular call
                if ( msg.id ) {
                    let res;

                    if ( !worker[method] ) {
                        res = result( [404, `Method "${msg.method}" not found`] );
                    }
                    else {
                        try {
                            res = parseResult( await worker[method]( ...msg.args ) );
                        }
                        catch ( e ) {
                            res = result( [500, e] );
                        }
                    }

                    parentPort.postMessage( toMessagePack( {
                        "type": "rpc",
                        "id": msg.id,
                        "result": res,
                    } ) );
                }

                // void call
                else if ( worker[method] ) {
                    try {
                        worker[method]( ...msg.args );
                    }
                    catch ( e ) {}
                }
            }

            // rpc response
            else {
                const callback = callbacks[msg.id];

                if ( callback ) {
                    delete callbacks[msg.id];

                    callback( result( msg.result ) );
                }
            }
        }
    } );

    parentPort.postMessage( toMessagePack( {
        "type": "worker-ready",
    } ) );
}

// const Pool = require( "@softvisio/core/lib/thread/worker-pool" );

// const pool = new Pool( {
//     "threads": 1,
//     "filename": require.resolve( "./worker" ),
//     "constructor": [...args],
// } );

// await pool.rpc_call( "method", arg1, arg2 )

const { isMainThread } = require( "worker_threads" );
const { "v1": uuidv1 } = require( "uuid" );
const { result, parseResult } = require( "../result" );
const CondVar = require( "./condvar" );
const { toMessagePack, fromMessagePack } = require( "../util" );

// parent thread
if ( isMainThread ) {
    const { Worker } = require( "worker_threads" );
    const os = require( "os" );

    module.exports = class ThreadsPool {
        #onEvent;
        #onRpc;

        #threads = {};
        #callbacks = [];

        constructor ( options ) {
            if ( options ) {
                this.#onEvent = options.onEvent;
                this.#onRpc = options.onRpc;
            }
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

                    worker.on( "message", async ( msg ) => {
                        msg = fromMessagePack( Buffer.from( msg ) );

                        if ( msg.type === "event" ) {
                            if ( this.#onEvent ) this.#onEvent( msg.name, msg.args );
                        }
                        else if ( msg.type === "rpc" ) {

                            // incoming rpc call
                            if ( msg.method ) {
                                if ( this.#onRpc ) {

                                    // regular call
                                    if ( msg.id ) {
                                        const result = parseResult( await this.#onRpc( msg.method, msg.args ) );

                                        worker.postMessage( toMessagePack( {
                                            "type": "rpc",
                                            "id": msg.id,
                                            result,
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

        emit ( name, ...args ) {
            var msg = toMessagePack( {
                "type": "event",
                name,
                args,
            } );

            for ( const threadName in this.#threads ) {
                for ( const worker of this.#threads[threadName] ) {
                    worker.postMessage( msg );
                }
            }
        }

        async call ( threadName, method, ...args ) {
            return this._call( threadName, method, args, false );
        }

        callVoid ( threadName, method, ...args ) {
            this._call( threadName, method, args, true );
        }

        async _call ( threadName, method, args, isVoid ) {
            const thread = this.#threads[threadName];

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
                return new Promise( ( resolve ) => {
                    const id = uuidv1();

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
    const EventEmitter = require( "events" );

    const Worker = require( workerData.filename );

    const callbacks = {},
        emitter = new EventEmitter();

    class Host {
        async call ( method, ...args ) {
            const id = uuidv1();

            return new Promise( ( resolve ) => {
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

        on () {
            emitter.on( ...arguments );
        }

        once () {
            emitter.once( ...arguments );
        }

        off () {
            emitter.off( ...arguments );
        }

        emit ( name, ...args ) {
            parentPort.postMessage( toMessagePack( {
                "type": "event",
                name,
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
            emitter.emit( msg.name, ...msg.args );
        }

        // rpc
        else if ( msg.type === "rpc" ) {

            // incoming rpc call
            if ( msg.method ) {
                const method = "API_" + msg.method.replace( /-/g, "_" );

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

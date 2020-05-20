// const Pool = require( "@softvisio/core/lib/thread/worker-pool" );

// const pool = new Pool( {
//     "threads": 1,
//     "filename": require.resolve( "./worker" ),
//     "constructor": [...args],
// } );

// await pool.rpc_call( "method", arg1, arg2 )

const { isMainThread } = require( "worker_threads" );
const { "v4": uuidv4 } = require( "uuid" );
const res = require( "../result" );

// parent thread
if ( isMainThread ) {
    const { Worker } = require( "worker_threads" );
    const os = require( "os" );

    module.exports = class {
        #onEvent = null;
        #onRpc = null;

        #threads = {};
        #callbacks = [];

        constructor ( options ) {
            this.#onEvent = options.onEvent;
            this.#onRpc = options.onRpc;
        }

        // TODO convert rpc result
        run ( threads ) {
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
                    const worker = new Worker( __filename, { "workerData": { "filename": thread.filename, "constructor": thread.constructor } } );

                    if ( !this.#threads[threadName] ) this.#threads[threadName] = [];

                    this.#threads[threadName].push( worker );

                    worker.on( "message", async ( msg ) => {
                        if ( msg.type === "event" ) {
                            if ( this.#onEvent ) this.#onEvent( msg.name, msg.args );
                        }
                        else if ( msg.type === "rpc" ) {
                            if ( msg.method ) {
                                if ( this.#onRpc ) {
                                    // TODO convert
                                    const res = await this.#onRpc( msg.method, msg.args );

                                    worker.postMessage( {
                                        "type": "rpc",
                                        "id": msg.id,
                                        "result": res,
                                    } );
                                }
                                else {
                                    worker.postMessage( {
                                        "type": "rpc",
                                        "id": msg.id,
                                        "result": {
                                            "status": 400,
                                            "reason": "Rpc calls are not supported",
                                        },
                                    } );
                                }
                            }
                            else {
                                const callback = this.#callbacks[msg.id];

                                if ( callback ) {
                                    delete this.#callbacks[msg.id];

                                    callback( res( msg.result ) );
                                }
                            }
                        }
                    } );
                }
            }
        }

        emit ( name, ...args ) {
            var msg = {
                "type": "event",
                name,
                args,
            };

            for ( const threadName in this.#threads ) {
                for ( const worker of this.#threads[threadName] ) {
                    worker.postMessage( msg );
                }
            }
        }

        async call ( threadName, method, ...args ) {
            const thread = this.#threads[threadName];

            if ( !thread ) return res( [404, "Thread Not Found"] );

            if ( !thread.length ) return res( [404, "Worker Not Found"] );

            const worker = thread.shift();

            thread.push( worker );

            return new Promise( ( resolve ) => {
                const id = uuidv4();

                this.#callbacks[id] = resolve;

                worker.postMessage( {
                    "type": "rpc",
                    id,
                    method,
                    args,
                } );
            } );
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
            const id = uuidv4();

            return new Promise( ( resolve ) => {
                callbacks[id] = resolve;

                parentPort.postMessage( {
                    "type": "rpc",
                    "id": id,
                    method,
                    args,
                } );
            } );
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
            parentPort.postMessage( {
                "type": "event",
                name,
                args,
            } );
        }
    }

    global.host = new Host();

    const worker = new Worker( ...workerData.constructor );

    // TODO convert rpc resullt
    parentPort.on( "message", async function ( msg ) {
        if ( msg.type === "event" ) {
            emitter.emit( msg.name, ...msg.args );
        }
        else if ( msg.type === "rpc" ) {
            if ( msg.method ) {
                const method = "API_" + msg.method.replace( /-/g, "_" );

                var result;

                if ( !worker[method] ) {
                    result = res( [404, `Method "${msg.method}" not found`] );
                }
                else {
                    try {
                        // TODO convert
                        result = await worker[method]( ...msg.args );
                    }
                    catch ( e ) {
                        result = res( [500, e] );
                    }
                }

                parentPort.postMessage( {
                    "type": "rpc",
                    "id": msg.id,
                    result,
                } );
            }
            else {
                const callback = callbacks[msg.id];

                if ( callback ) {
                    delete callbacks[msg.id];

                    callback( res( msg.result ) );
                }
            }
        }
    } );
}

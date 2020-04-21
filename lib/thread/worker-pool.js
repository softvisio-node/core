// const Pool = require( "@softvisio/core/lib/thread/worker-pool" );

// const pool = new Pool( {
//     "threads": 1,
//     "filename": require.resolve( "./worker" ),
//     "constructor": {
//         "a": 1,
//         "b": 2,
//     },
// } );

// await pool.rpc_call( "method", arg1, arg2 )

const { isMainThread } = require( "worker_threads" );
const res = require( "@softvisio/core/lib/result" );

// parent thread
if ( isMainThread ) {
    const { Worker } = require( "worker_threads" );
    const os = require( "os" );

    module.exports = class {
        #workers = [];
        #callbacks = {};
        #tid = 0;

        constructor ( args ) {
            const me = this;

            let threads = args.threads;

            // define number of threads
            if ( !threads ) {
                threads = os.cpus().length;
            }
            else if ( threads < 0 ) {
                threads = os.cpus().length + threads;

                if ( threads < 1 ) threads = 1;
            }
            else if ( threads > os.cpus().length ) {
                threads = os.cpus().length;
            }

            // create threads
            for ( let n = 1; n <= threads; n++ ) {
                const worker = new Worker( __filename, { "workerData": { "filename": args.filename, "constructor": args.constructor } } );

                this.#workers.push( worker );

                worker.on( "message", function ( data ) {
                    const callback = me.#callbacks[data.tid];

                    if ( callback ) {
                        if ( callback ) {
                            delete me.#callbacks[data.tid];

                            const result = res( data.result );

                            callback( result );
                        }
                    }
                } );
            }
        }

        async rpc_call () {
            var me = this,
                method = arguments[0],
                args = Array.prototype.slice.call( arguments, 1 );

            return new Promise( ( resolve ) => {
                const worker = me.#workers.shift(),
                    tid = ++me.#tid;

                me.#callbacks[tid] = resolve;

                worker.postMessage( {
                    "type": "rpc",
                    "tid": tid,
                    "method": method,
                    "args": args,
                } );

                me.#workers.push( worker );
            } );
        }
    };
}

// worker thread
else {
    const { parentPort, workerData } = require( "worker_threads" );

    const Worker = require( workerData.filename );

    const worker = new Worker( workerData.constructor );

    parentPort.on( "message", async function ( req ) {
        var result;

        const method = "API_" + req.method;

        if ( !worker[method] ) {
            result = res( [404, `Method "${req.method}" not found`] );
        }
        else {
            try {
                result = await worker[method]( ...req.args );
            }
            catch ( e ) {
                result = res( [500, e] );
            }
        }

        parentPort.postMessage( {
            "type": "rpc",
            "tid": req.tid,
            result,
        } );
    } );
}

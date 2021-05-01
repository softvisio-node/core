import "#index";

import Events from "#lib/events";
import CondVar from "#lib/threads/condvar";
import MSGPACK from "#lib/msgpack";
import { Worker } from "worker_threads";
import os from "os";

const WORKER_PATH = require.resolve( "./threads/worker-thread.mjs" );

export default class Threads extends Events {
    #eventNamePrefix;
    #onRpc; // async function( method, args )

    #requestId = 0;
    #threads = {};
    #callbacks = [];

    constructor ( options = {} ) {
        super();

        // EVENTS
        this.#eventNamePrefix = options.eventNamePrefix ?? true;

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

                const path = typeof thread.path === "object" ? thread.path.href : new URL( thread.path.startsWith( "/" ) ? thread.path : "/" + thread.path, "file://" ).href;

                const worker = new Worker( WORKER_PATH, {
                    "workerData": {
                        "path": path,
                        "arguments": thread.arguments,
                    },
                } );

                if ( !this.#threads[threadName] ) this.#threads[threadName] = [];

                this.#threads[threadName].push( worker );

                worker.on( "message", async msg => {
                    msg = MSGPACK.decode( msg );

                    if ( msg.type === "event" ) {
                        this.emit( "event", msg.name, msg.args );

                        if ( this.#eventNamePrefix ) this.emit( "event/" + msg.name, ...msg.args );
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

                                    worker.postMessage( MSGPACK.encode( {
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
                                worker.postMessage( MSGPACK.encode( {
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
    // event-name - to all threads
    // :thread1,threads2/event-name - to specific threads
    publish ( name, ...args ) {
        const event = Events.parseTargets( name, args );

        var sent = false;

        const msg = MSGPACK.encode( {
            "type": "event",
            "name": event.name,
            "args": event.args,
        } );

        // to all threads
        if ( !event.targets ) {
            for ( const thread in this.#threads ) {
                for ( const worker of this.#threads[thread] ) {
                    sent = true;

                    worker.postMessage( msg );
                }
            }
        }

        // to specific threads
        else {
            for ( const target of event.targets ) {
                const group = this.#threads[target];

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
            worker.postMessage( MSGPACK.encode( {
                "type": "rpc",
                method,
                args,
            } ) );
        }
        else {
            return new Promise( resolve => {
                const id = ++this.#requestId;

                this.#callbacks[id] = resolve;

                worker.postMessage( MSGPACK.encode( {
                    "type": "rpc",
                    id,
                    method,
                    args,
                } ) );
            } );
        }
    }
}

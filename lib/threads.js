import "#index";

import Events, { parseTargets } from "#lib/events";
import CondVar from "#lib/threads/condvar";
import MSGPACK from "#lib/msgpack";
import { Worker } from "worker_threads";
import os from "os";
import fs from "#lib/fs";

const WORKER_PATH = fs.resolve( "./threads/worker-thread.js", import.meta.url );

export default class Threads extends Events {
    #onRpc; // async function( method, args )

    #requestId = 0;
    #threads = {};
    #callbacks = [];

    constructor ( options = {} ) {
        super();

        this.#onRpc = options.onRpc;
    }

    // public
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

                worker.on( "message", this.#onMessage.bind( this, worker ) );

                worker.once( "ready", () => cv.end() );
            }
        }

        return cv.end().recv( () => result( 200 ) );
    }

    // events
    // event-name - to all threads
    // :thread1,threads2/event-name - to specific threads
    publish ( name, ...params ) {
        const event = parseTargets( name, params );

        var sent = false;

        const msg = MSGPACK.encode( {
            "method": "/event/" + name,
            "params": event.args,
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

    // rpc
    async call ( method, ...params ) {
        return this.#call( method, params, false );
    }

    callVoid ( method, ...params ) {
        this.#call( method, params, true );
    }

    // private
    async #call ( method, params, isVoid ) {
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
                method,
                params,
            } ) );
        }
        else {
            return new Promise( resolve => {
                const id = ++this.#requestId;

                this.#callbacks[id] = resolve;

                worker.postMessage( MSGPACK.encode( {
                    id,
                    method,
                    params,
                } ) );
            } );
        }
    }

    async #onMessage ( worker, msg ) {
        msg = MSGPACK.decode( msg );

        // request
        if ( msg.method ) {

            // event
            if ( msg.method.startsWith( "/event/" ) ) {
                const name = msg.method.substr( 7 );

                this.emit( "event", name, msg.params );
                this.emit( "event/" + name, ...msg.params );
            }

            // ready
            else if ( msg.method === "/ready" ) {
                worker.emit( "ready" );
            }

            // rpc call
            else {
                if ( this.#onRpc ) {

                    // regular call
                    if ( msg.id ) {
                        let res;

                        try {
                            res = result.try( await this.#onRpc( msg.method, msg.params ) );
                        }
                        catch ( e ) {
                            res = result.catch( e );
                        }

                        worker.postMessage( MSGPACK.encode( {
                            "id": msg.id,
                            "result": res,
                        } ) );
                    }

                    // void call
                    else {
                        try {
                            this.#onRpc( msg.method, msg.params );
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
                        "id": msg.id,
                        "result": result( -32800 ),
                    } ) );
                }
            }
        }

        // responce
        else {
            const callback = this.#callbacks[msg.id];

            if ( callback ) {
                delete this.#callbacks[msg.id];

                callback( result.parse( msg.result ) );
            }
        }
    }
}

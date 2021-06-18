import "#index";

import Events from "#lib/events";
import CondVar from "#lib/threads/condvar";
import MSGPACK from "#lib/msgpack";
import { Worker } from "worker_threads";
import os from "os";
import fs from "#lib/fs";

const WORKER_PATH = fs.resolve( "./threads/worker-thread.js", import.meta.url );

export default class Threads extends Events {
    #onRpc; // async function( method, params )

    #requestId = 0;
    #threads = {};
    #callbacks = [];
    #remoteEvents;

    constructor ( options = {} ) {
        super();

        this.#onRpc = options.onRpc;

        // init remote events
        this.#remoteEvents = new Events();

        this.#remoteEvents.on( "removeListener", name => {
            if ( this.#remoteEvents.listenerCount( name ) ) return;

            this.emit( "unsubscribe", name );
        } );

        this.#remoteEvents.on( "newListener", name => {
            if ( this.#remoteEvents.listenerCount( name ) ) return;

            this.emit( "subscribe", name );
        } );
    }

    // public
    async run ( threads ) {
        var cv = new CondVar().begin();

        for ( const name in threads ) {
            let num = threads[name].num;

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

                const path = typeof threads[name].path === "object" ? threads[name].path.href : new URL( threads[name].path.startsWith( "/" ) ? threads[name].path : "/" + threads[name].path, "file://" ).href;

                const thread = new Worker( WORKER_PATH, {
                    "workerData": {
                        "path": path,
                        "arguments": threads[name].arguments,
                    },
                } );

                thread._name = name;
                thread._listeners = {};

                this.#threads[name] ||= [];

                this.#threads[name].push( thread );

                thread.on( "exit", this.#onExit.bind( this, thread ) );

                thread.on( "message", this.#onMessage.bind( this, thread ) );

                thread.once( "ready", () => cv.end() );
            }
        }

        return cv.end().recv( () => result( 200 ) );
    }

    pipeEvents ( events ) {
        events.pipe( this.#remoteEvents );
    }

    publish ( ...args ) {
        return this.#remoteEvents.emit( args );
    }

    async call ( method, ...args ) {
        return this.#call( method, args, false );
    }

    callVoid ( method, ...args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( method, args, isVoid ) {
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
                "params": args,
            } ) );
        }
        else {
            return new Promise( resolve => {
                const id = ++this.#requestId;

                this.#callbacks[id] = resolve;

                worker.postMessage( MSGPACK.encode( {
                    id,
                    method,
                    "params": args,
                } ) );
            } );
        }
    }

    async #onMessage ( thread, msg ) {
        msg = MSGPACK.decode( msg );

        // request
        if ( msg.method ) {

            // event
            if ( msg.method === "/event" ) {
                const name = msg.params.shift();

                this.emit( "event", name, msg.params );
                this.emit( "event/" + name, ...msg.params );
            }

            // ready
            else if ( msg.method === "/ready" ) {
                thread.emit( "ready" );
            }

            // subscribe
            else if ( msg.method === "/subscribe" ) {
                const name = msg.params.shift(),
                    listener = this.#threadListener.bind( this, thread, name );

                thread._listeners[name] = listener;

                this.#remoteEvents.on( name, listener );
            }

            // unsubscribe
            else if ( msg.method === "/unsubscribe" ) {
                const name = msg.params.shift(),
                    listener = thread._listeners[name];

                if ( !listener ) return;

                delete thread._listeners[name];

                this.#remoteEvents.off( name, listener );
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

                        thread.postMessage( MSGPACK.encode( {
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
                    thread.postMessage( MSGPACK.encode( {
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

    #onExit ( thread, code ) {
        const threads = this.#threads[thread._name];

        // remove thread
        for ( let n = 0; n < threads.lenght; n++ ) {
            if ( threads[n] === thread ) {
                threads.splice( n, 1 );

                break;
            }
        }

        if ( !threads.length ) delete this.#threads[thread._name];

        // remove listeners
        for ( const name in thread._listeners ) {
            this.#remoteEvents.off( name, thread._listeners[name] );

            delete thread._listeners[name];
        }
    }

    #threadListener ( thread, args ) {
        const msg = MSGPACK.encode( {
            "method": "/event",
            "params": args,
        } );

        thread.postMessage( msg );
    }
}

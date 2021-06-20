import "#index";

import Events from "#lib/events";
import CondVar from "#lib/threads/condvar";
import MSGPACK from "#lib/msgpack";
import { Worker } from "worker_threads";
import os from "os";
import fs from "#lib/fs";

const WORKER_PATH = fs.resolve( "./threads/thread.js", import.meta.url );

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

        this.#remoteEvents.on( "newListener", name => {
            if ( name === "newListener" || name === "removeListener" ) return;

            if ( this.#remoteEvents.listenerCount( name ) ) return;

            this.emit( "subscribe", name );
        } );

        this.#remoteEvents.on( "removeListener", name => {
            if ( name === "newListener" || name === "removeListener" ) return;

            if ( this.#remoteEvents.listenerCount( name ) ) return;

            this.emit( "unsubscribe", name );
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

    publish ( name, ...args ) {

        // has no remote listeners
        if ( !this.#remoteEvents.listenerCount( name ) ) return false;

        const msg = MSGPACK.encode( {
            "method": "/event",
            "params": [name, ...args],
        } );

        return this.#remoteEvents.emit( name, msg );
    }

    async call ( name, method, ...args ) {
        return this.#call( name, method, args, false );
    }

    callVoid ( name, method, ...args ) {
        this.#call( name, method, args, true );
    }

    // private
    async #call ( name, method, args, isVoid ) {
        const threads = this.#threads[name];

        if ( !threads ) return result( [404, "Threads not found"] );

        if ( !threads.length ) return result( [404, "Threads has not workers"] );

        const thread = threads.shift();
        threads.push( thread );

        if ( isVoid ) {
            thread.postMessage( MSGPACK.encode( {
                method,
                "params": args,
            } ) );
        }
        else {
            return new Promise( resolve => {
                const id = ++this.#requestId;

                this.#callbacks[id] = resolve;

                thread.postMessage( MSGPACK.encode( {
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
                    listener = this.#threadListener.bind( this, thread );

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

    #threadListener ( thread, msg ) {
        thread.postMessage( msg );
    }
}

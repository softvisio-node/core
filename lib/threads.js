import "#lib/result";
import EventsHub from "#lib/events/hub";
import CondVar from "#lib/threads/condvar";
import msgpack from "#lib/msgpack";
import { isMainThread, Worker } from "worker_threads";
import os from "os";
import * as utils from "#lib/utils";
import url from "url";

const WORKER_PATH = utils.resolve( "./threads/thread.js", import.meta.url );

export default class Threads {
    #onRpc; // async function( method, params )

    #hub = new EventsHub();
    #requestId = 0;
    #threads = {};
    #callbacks = [];

    constructor ( options = {} ) {
        this.#onRpc = options.onRpc;
    }

    // static
    static get isMainThread () {
        return isMainThread;
    }

    // properties
    get hub () {
        return this.#hub;
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

                let path;

                if ( typeof threads[name].path === "object" ) path = threads[name].path.href;
                else if ( threads[name].path.startsWith( "file:" ) ) path = threads[name].path;
                else path = url.pathToFileURL( threads[name].path ).href;

                const thread = new Worker( WORKER_PATH, {
                    "workerData": {
                        "path": path,
                        "arguments": threads[name].arguments,
                    },
                } );

                thread._name = name;
                thread._listeners = {};

                this.#threads[name] ||= new Set();

                this.#threads[name].add( thread );

                thread.on( "exit", this.#onExit.bind( this, thread ) );

                thread.on( "message", this.#onMessage.bind( this, thread ) );

                thread.once( "ready", () => cv.end() );
            }
        }

        return cv.end().recv( () => result( 200 ) );
    }

    async call ( name, method, ...args ) {
        return this.#call( name, method, args, false );
    }

    callVoid ( name, method, ...args ) {
        this.#call( name, method, args, true );
    }

    // events
    on ( name, listener ) {
        this.#hub.on( "in", name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#hub.once( "in", name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#hub.off( "in", name, listener );

        return this;
    }

    publish ( name, ...args ) {
        if ( !this.#hub.hasListeners( "out", name ) ) return;

        const msg = msgpack.encode( {
            "method": "/publish",
            "params": [name, ...args],
        } );

        this.#hub.publish( "out", name, [msg] );
    }

    // private
    async #call ( name, method, args, isVoid ) {
        const threads = this.#threads[name];

        if ( !threads ) return result( [404, "Threads not found"] );

        if ( !threads.size ) return result( [404, "Threads has no workers"] );

        const thread = threads.values().next().value;

        // rotate
        threads.delete( thread );
        threads.add( thread );

        if ( isVoid ) {
            thread.postMessage( msgpack.encode( {
                method,
                "params": args,
            } ) );
        }
        else {
            return new Promise( resolve => {
                const id = ++this.#requestId;

                this.#callbacks[id] = resolve;

                thread.postMessage( msgpack.encode( {
                    id,
                    method,
                    "params": args,
                } ) );
            } );
        }
    }

    async #onMessage ( thread, msg ) {
        msg = msgpack.decode( msg );

        // request
        if ( msg.method ) {

            // publish
            if ( msg.method === "/publish" ) {
                const name = msg.params.shift();

                this.#hub.publish( "in", name, msg.params );
            }

            // ready
            else if ( msg.method === "/ready" ) {
                thread.emit( "ready" );
            }

            // subscribe
            else if ( msg.method === "/subscribe" ) {
                const name = msg.params.shift();

                // already subscribed
                if ( thread._listeners[name] ) return;

                thread._listeners[name] = msg => thread.postMessage( msg );

                this.#hub.on( "out", name, thread._listeners[name] );
            }

            // unsubscribe
            else if ( msg.method === "/unsubscribe" ) {
                const name = msg.params.shift(),
                    listener = thread._listeners[name];

                // not subscribed
                if ( !listener ) return;

                delete thread._listeners[name];

                this.#hub.off( "out", name, listener );
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

                        thread.postMessage( msgpack.encode( {
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
                    thread.postMessage( msgpack.encode( {
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

        // remove thread
        this.#threads[thread._name].delete( thread );

        if ( !this.#threads[thread._name].size ) delete this.#threads[thread._name];

        // remove listeners
        for ( const name in thread._listeners ) {
            this.#hub.off( "out", name, thread._listeners[name] );

            delete thread._listeners[name];
        }
    }
}

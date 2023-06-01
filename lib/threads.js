import "#lib/result";
import EventsHub from "#lib/events";
import Counter from "#lib/threads/counter";
import { isMainThread, Worker } from "worker_threads";
import os from "os";
import * as utils from "#lib/utils";
import url from "url";

const WORKER_PATH = utils.resolve( "#lib/threads/worker-thread", import.meta.url );

export default class Threads {
    #onRpc; // async ( method, args ) => {}
    #requestId = 0;
    #threads = {};
    #callbacks = [];
    #incomingEvents = new EventsHub();
    #outgoingEvents = new EventsHub();
    #runningThreadsCounter = new Counter();
    #isShuttingDown = false;

    constructor ( options = {} ) {
        this.#onRpc = options.onRpc;
    }

    // static
    static get isMainThread () {
        return isMainThread;
    }

    // properties
    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    // public
    async run ( threads ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        const counter = new Counter().inc();

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

            const args = JSON.stringify( threads[name].arguments );

            // create threads
            for ( let n = 1; n <= num; n++ ) {
                counter.inc();

                let module;

                if ( typeof threads[name].module === "object" ) module = threads[name].module.href;
                else if ( threads[name].module.startsWith( "file:" ) ) module = threads[name].module;
                else module = url.pathToFileURL( threads[name].module ).href;

                const thread = new Worker( WORKER_PATH, {
                    "workerData": {
                        module,
                        "arguments": args,
                        "mainThreadArgv1": isMainThread ? process.argv[1] : global[Symbol.for( "mainThreadArgv1" )],
                    },
                } );

                this.#runningThreadsCounter.inc();

                thread._name = name;
                thread._listeners = {};

                this.#threads[name] ||= new Set();

                this.#threads[name].add( thread );

                thread.once( "exit", this.#onThreadExit.bind( this, thread ) );

                thread.on( "message", this.#onMessage.bind( this, thread ) );

                thread.once( "ready", () => counter.dec() );
            }
        }

        await counter.dec().wait();

        return result( 200 );
    }

    async call ( name, method, ...args ) {
        return this.#call( name, method, args, false );
    }

    voidCall ( name, method, ...args ) {
        this.#call( name, method, args, true );
    }

    // events
    on ( name, listener ) {
        this.#incomingEvents.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#incomingEvents.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#incomingEvents.off( name, listener );

        return this;
    }

    publish ( name, ...args ) {
        this.#outgoingEvents.emit( name, args, {} );
    }

    link ( target, { on } = {} ) {
        const forwarder = ( name, args ) => this.#outgoingEvents.emit( name, args, {} );

        this.#outgoingEvents.link( target, { on, forwarder } );
    }

    async shutDown () {
        if ( !this.#isShuttingDown ) {
            this.#isShuttingDown = true;

            // sent shutdown message
            for ( const threads of Object.values( this.#threads ) ) {
                for ( const thread of threads ) {
                    thread.postMessage( JSON.stringify( {
                        "method": "/shutdown",
                    } ) );
                }
            }
        }

        return this.#runningThreadsCounter.wait();
    }

    // private
    async #call ( name, method, args, isVoid ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        const threads = this.#threads[name];

        if ( !threads ) return result( [404, "Threads not found"] );

        if ( !threads.size ) return result( [404, "Threads has no workers"] );

        const thread = threads.values().next().value;

        // rotate
        threads.delete( thread );
        threads.add( thread );

        if ( isVoid ) {
            thread.postMessage( JSON.stringify( {
                method,
                "params": args,
            } ) );
        }
        else {
            return new Promise( resolve => {
                const id = ++this.#requestId;

                this.#callbacks[id] = resolve;

                thread.postMessage( JSON.stringify( {
                    id,
                    method,
                    "params": args,
                } ) );
            } );
        }
    }

    async #onMessage ( thread, msg ) {
        msg = JSON.parse( msg );

        // request
        if ( msg.method ) {

            // subscribe
            if ( msg.method === "/subscribe" ) {
                const name = msg.params.shift();

                // already subscribed
                if ( thread._listeners[name] ) return;

                thread._listeners[name] = ( args, cache = {}, threadId ) => {
                    if ( threadId === thread.threadId ) return;

                    cache.msg ??= JSON.stringify( {
                        "method": "/publish",
                        "params": [name, ...args],
                    } );

                    thread.postMessage( cache.msg );
                };

                this.#outgoingEvents.on( name, thread._listeners[name] );
            }

            // unsubscribe
            else if ( msg.method === "/unsubscribe" ) {
                const name = msg.params.shift(),
                    listener = thread._listeners[name];

                // not subscribed
                if ( !listener ) return;

                delete thread._listeners[name];

                this.#outgoingEvents.off( name, listener );
            }

            // publish
            else if ( msg.method === "/publish" ) {
                const name = msg.params.shift();

                this.#outgoingEvents.emit( name, msg.params, {}, thread.threadId );
                this.#incomingEvents.emit( name, ...msg.params );
            }

            // ready
            else if ( msg.method === "/ready" ) {
                thread.emit( "ready" );
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

                        thread.postMessage( JSON.stringify( {
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
                    thread.postMessage( JSON.stringify( {
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

                callback( result.fromJson( msg.result ) );
            }
        }
    }

    #onThreadExit ( thread, code ) {

        // remove thread
        this.#threads[thread._name].delete( thread );

        if ( !this.#threads[thread._name].size ) delete this.#threads[thread._name];

        // remove listeners
        for ( const name in thread._listeners ) {
            this.#outgoingEvents.off( name, thread._listeners[name] );

            delete thread._listeners[name];
        }

        this.#runningThreadsCounter.dec();
    }
}

import "#lib/shutdown";
import "#lib/result";
import Events from "events";
import { parentPort, workerData } from "worker_threads";
import Semaphore from "#lib/threads/semaphore";

global[Symbol.for( "mainThreadArgv1" )] = workerData.mainThreadArgv1;

const shutdownLock = process.shutdown.lock( "thread-rpc-calls" );

const callbacks = {},
    activeCalls = new Semaphore().on( "unlock", () => {
        if ( process.isShuttingDown ) shutdownLock.done();
    } );

process.shutdown.on( "shutdown", () => {
    if ( !activeCalls.isLocked ) shutdownLock.done();
} );

class Host extends Events {
    #requestId = 0;

    constructor () {
        super();

        this.on( "newListener", this.#subscribe.bind( this ) );

        this.on( "removeListener", this.#unsubscribe.bind( this ) );
    }

    publish ( name, ...args ) {
        parentPort.postMessage( JSON.stringify( {
            "method": "/publish",
            "params": [name, ...args],
        } ) );

        this.emit( ...args );

        return true;
    }

    async call ( method, ...args ) {

        // service is shutting down
        if ( process.isShuttingDown ) return result( -32816 );

        const id = ++this.#requestId;

        return new Promise( resolve => {
            callbacks[id] = resolve;

            parentPort.postMessage( JSON.stringify( {
                id,
                method,
                "params": args,
            } ) );

            activeCalls.up();
        } );
    }

    voidCall ( method, ...args ) {

        // service is shutting down
        if ( process.isShuttingDown ) return;

        parentPort.postMessage( JSON.stringify( {
            method,
            "params": args,
        } ) );
    }

    // private
    #subscribe ( name ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        // already subscribed
        if ( this.listenerCount( name ) ) return;

        parentPort.postMessage( JSON.stringify( {
            "method": "/subscribe",
            "params": [name],
        } ) );
    }

    #unsubscribe ( name ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        // not unsubscribed
        if ( this.listenerCount( name ) ) return;

        parentPort.postMessage( JSON.stringify( {
            "method": "/unsubscribe",
            "params": [name],
        } ) );
    }
}

Object.defineProperty( global, "host", {
    "configurable": false,
    "writable": false,
    "enumerable": true,
    "value": new Host(),
} );

const Worker = ( await import( workerData.module ) ).default;

var worker;

if ( typeof Worker.new === "function" ) {
    worker = await Worker.new( ...( JSON.parse( workerData.arguments ) || [] ) );
}
else {
    worker = new Worker( ...( JSON.parse( workerData.arguments || "null" ) || [] ) );
}

parentPort.on( "message", async msg => {
    msg = JSON.parse( msg );

    // request
    if ( msg.method ) {

        // shutdown
        if ( msg.method === "/shutdown" ) {
            process.shutDown();
        }

        // publish
        else if ( msg.method === "/publish" ) {
            global.host.emit( msg.params.shift(), ...msg.params );
        }

        // rpc call
        else {
            const method = "API_" + msg.method;

            // rpc call
            if ( msg.id ) {
                activeCalls.up();

                let res;

                if ( !worker[method] ) {
                    res = result( -32809 );
                }
                else {
                    try {
                        res = result.try( await worker[method]( ...msg.params ) );
                    }
                    catch ( e ) {
                        res = result.catch( e );
                    }
                }

                parentPort.postMessage( JSON.stringify( {
                    "id": msg.id,
                    "result": res,
                } ) );

                activeCalls.down();
            }

            // void rpc call
            else if ( worker[method] ) {
                activeCalls.up();

                try {
                    worker[method]( ...msg.params );
                }
                catch ( e ) {
                    console.log( e );
                }

                activeCalls.down();
            }
        }
    }

    // rpc response
    else {
        const callback = callbacks[msg.id];

        if ( callback ) {
            delete callbacks[msg.id];

            callback( result.fromJson( msg.result ) );

            activeCalls.down();
        }
    }
} );

parentPort.postMessage( JSON.stringify( {
    "method": "/ready",
} ) );

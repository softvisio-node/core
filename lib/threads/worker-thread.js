import "#lib/shutdown";
import "#lib/result";
import Events from "#lib/events/hub";
import { parentPort, workerData } from "node:worker_threads";
import Counter from "#lib/threads/counter";

global[Symbol.for( "mainThreadArgv1" )] = workerData.mainThreadArgv1;

const shutdownLock = process.shutdown.lock( "thread-rpc-calls" );

const callbacks = {},
    activeCalls = new Counter().on( "finish", () => {
        if ( process.isShuttingDown ) shutdownLock.done();
    } );

process.shutdown.on( "shutdown", () => {
    if ( activeCalls.isFinished ) shutdownLock.done();
} );

class Host {
    #hub;
    #requestId = 0;

    constructor () {
        this.#hub = new Events().watch( this.#watcher.bind( this ) );
    }

    // public
    on ( name, listener ) {
        this.#hub.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#hub.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#hub.off( name, listener );

        return this;
    }

    emit ( name, ...args ) {
        this.#hub.emit( name, ...args );

        return this;
    }

    publish ( name, ...args ) {
        parentPort.postMessage( JSON.stringify( {
            "method": "/publish",
            "params": [name, ...args],
        } ) );

        this.#hub.emit( name, ...args );

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

            activeCalls.inc();
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
    #watcher ( name, subscribe ) {
        if ( subscribe ) {
            parentPort.postMessage( JSON.stringify( {
                "method": "/subscribe",
                "params": [name],
            } ) );
        }
        else {
            parentPort.postMessage( JSON.stringify( {
                "method": "/unsubscribe",
                "params": [name],
            } ) );
        }
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
                activeCalls.inc();

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

                activeCalls.dec();
            }

            // void rpc call
            else if ( worker[method] ) {
                activeCalls.inc();

                try {
                    worker[method]( ...msg.params );
                }
                catch ( e ) {
                    console.log( e );
                }

                activeCalls.dec();
            }
        }
    }

    // rpc response
    else {
        const callback = callbacks[msg.id];

        if ( callback ) {
            delete callbacks[msg.id];

            callback( result.fromJson( msg.result ) );

            activeCalls.dec();
        }
    }
} );

parentPort.postMessage( JSON.stringify( {
    "method": "/ready",
} ) );

import "#lib/result";
import Events from "events";
import { parentPort, workerData } from "worker_threads";

global[Symbol.for( "mainThreadArgv1" )] = workerData.mainThreadArgv1;

const callbacks = {};

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
        const id = ++this.#requestId;

        return new Promise( resolve => {
            callbacks[id] = resolve;

            parentPort.postMessage( JSON.stringify( {
                id,
                method,
                "params": args,
            } ) );
        } );
    }

    voidCall ( method, ...args ) {
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

        // publish
        if ( msg.method === "/publish" ) {
            global.host.emit( msg.params.shift(), ...msg.params );
        }

        // rpc call
        else {
            const method = "API_" + msg.method;

            // regular call
            if ( msg.id ) {
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
            }

            // void call
            else if ( worker[method] ) {
                try {
                    worker[method]( ...msg.params );
                }
                catch ( e ) {
                    console.log( e );
                }
            }
        }
    }

    // rpc response
    else {
        const callback = callbacks[msg.id];

        if ( callback ) {
            delete callbacks[msg.id];

            callback( result.fromJson( msg.result ) );
        }
    }
} );

parentPort.postMessage( JSON.stringify( {
    "method": "/ready",
} ) );

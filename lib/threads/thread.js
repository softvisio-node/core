import "#lib/result";
import EventsClient from "#lib/events/client";
import msgpack from "#lib/msgpack";
import { parentPort, workerData } from "worker_threads";

const callbacks = {};

class Host extends EventsClient {
    #requestId = 0;

    // public
    async call ( method, ...args ) {
        const id = ++this.#requestId;

        return new Promise( resolve => {
            callbacks[id] = resolve;

            parentPort.postMessage( msgpack.encode( {
                id,
                method,
                "params": args,
            } ) );
        } );
    }

    callVoid ( method, ...args ) {
        parentPort.postMessage( msgpack.encode( {
            method,
            "params": args,
        } ) );
    }

    // protected
    _subscribe ( name ) {
        parentPort.postMessage( msgpack.encode( {
            "method": "/subscribe",
            "params": [name],
        } ) );
    }

    _unsubscribe ( name ) {
        parentPort.postMessage( msgpack.encode( {
            "method": "/unsubscribe",
            "params": [name],
        } ) );
    }

    _publish ( name, args ) {
        parentPort.postMessage( msgpack.encode( {
            "method": "/publish",
            "params": [name, ...args],
        } ) );
    }
}

global.host = new Host();

const Worker = ( await import( workerData.path ) ).default;

var worker;

if ( typeof Worker.new === "function" ) worker = await Worker.new( ...( workerData.arguments || [] ) );
else worker = new Worker( ...( workerData.arguments || [] ) );

parentPort.on( "message", async msg => {
    msg = msgpack.decode( msg );

    // request
    if ( msg.method ) {

        // event
        if ( msg.method === "/subscribe" ) {
            global.host._onSubscribe( msg.params );
        }
        else if ( msg.method === "/unsubscribe" ) {
            global.host._onUnsubscribe( msg.params );
        }
        else if ( msg.method === "/publish" ) {
            global.host._onPublish( msg.params );
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

                parentPort.postMessage( msgpack.encode( {
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

            callback( result.parse( msg.result ) );
        }
    }
} );

// thread ready
parentPort.postMessage( msgpack.encode( {
    "method": "/ready",
} ) );

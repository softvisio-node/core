import "#index";

import Events from "events";
import MSGPACK from "#lib/msgpack";
import { parentPort, workerData } from "worker_threads";

const callbacks = {};

class Host extends Events {
    #requestId = 0;

    // events
    publish ( ...params ) {
        parentPort.postMessage( MSGPACK.encode( {
            "method": "/event",
            params,
        } ) );

        return true;
    }

    // rpc
    async call ( method, ...params ) {
        const id = ++this.#requestId;

        return new Promise( resolve => {
            callbacks[id] = resolve;

            parentPort.postMessage( MSGPACK.encode( {
                id,
                method,
                params,
            } ) );
        } );
    }

    callVoid ( method, ...params ) {
        parentPort.postMessage( MSGPACK.encode( {
            method,
            params,
        } ) );
    }
}

global.host = new Host();

const Worker = ( await import( workerData.path ) ).default;

const worker = await Worker.new( ...( workerData.arguments || [] ) );

parentPort.on( "message", async msg => {
    msg = MSGPACK.decode( msg );

    // request
    if ( msg.method ) {

        // event
        if ( msg.method === "/event" ) {
            global.host.emit( ...msg.params );
        }

        // rpc call
        else {
            const method = "API_" + msg.method.replaceAll( "-", "_" );

            // regular call
            if ( msg.id ) {
                let res;

                if ( !worker[method] ) {
                    res = result( [-32601, `Method "${msg.method}" not found`] );
                }
                else {
                    try {
                        res = result.try( await worker[method]( ...msg.params ) );
                    }
                    catch ( e ) {
                        res = result.catch( e );
                    }
                }

                parentPort.postMessage( MSGPACK.encode( {
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

parentPort.postMessage( MSGPACK.encode( {
    "method": "/ready",
} ) );

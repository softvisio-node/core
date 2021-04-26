import "#index";

import Events from "events";
import { toMsgPack, fromMsgPack } from "../msgpack.js";
import { parentPort, workerData } from "worker_threads";

const callbacks = {};

class Host extends Events {
    #requestId = 0;

    // EVENTS
    publish ( name, ...args ) {
        parentPort.postMessage( toMsgPack( {
            "type": "event",
            name,
            args,
        } ) );

        return true;
    }

    onRemoteEvent ( name, args ) {
        this.emit( name, ...args );
    }

    // RPC
    async call ( method, ...args ) {
        const id = ++this.#requestId;

        return new Promise( resolve => {
            callbacks[id] = resolve;

            parentPort.postMessage( toMsgPack( {
                "type": "rpc",
                "id": id,
                method,
                args,
            } ) );
        } );
    }

    callVoid ( method, ...args ) {
        parentPort.postMessage( toMsgPack( {
            "type": "rpc",
            method,
            args,
        } ) );
    }
}

global.host = new Host();

const Worker = ( await import( workerData.path ) ).default;

const worker = new Worker( ...( workerData.arguments || [] ) );

parentPort.on( "message", async function ( msg ) {
    msg = fromMsgPack( msg );

    // event
    if ( msg.type === "event" ) {
        global.host.onRemoteEvent( msg.name, msg.args );
    }

    // rpc
    else if ( msg.type === "rpc" ) {

        // incoming rpc call
        if ( msg.method ) {
            const method = "RPC_" + msg.method.replace( /-/g, "_" );

            // regular call
            if ( msg.id ) {
                let res;

                if ( !worker[method] ) {
                    res = result( [404, `Method "${msg.method}" not found`] );
                }
                else {
                    try {
                        res = result.tryResult( await worker[method]( ...msg.args ) );
                    }
                    catch ( e ) {
                        res = result.catchResult( e );
                    }
                }

                parentPort.postMessage( toMsgPack( {
                    "type": "rpc",
                    "id": msg.id,
                    "result": res,
                } ) );
            }

            // void call
            else if ( worker[method] ) {
                try {
                    worker[method]( ...msg.args );
                }
                catch ( e ) {
                    console.log( e );
                }
            }
        }

        // rpc response
        else {
            const callback = callbacks[msg.id];

            if ( callback ) {
                delete callbacks[msg.id];

                callback( result.parseResult( msg.result ) );
            }
        }
    }
} );

parentPort.postMessage( toMsgPack( {
    "type": "worker-ready",
} ) );

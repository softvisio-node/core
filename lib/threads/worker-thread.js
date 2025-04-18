import "#lib/destroy-controller";
import "#lib/result";
import { parentPort, workerData } from "node:worker_threads";
import Events from "#lib/events";
import { kebabToCamelCase } from "#lib/naming-conventions";
import Counter from "#lib/threads/counter";

global[ Symbol.for( "mainThreadArgv1" ) ] = workerData.mainThreadArgv1;

const destroyLock = process.destroyController.lock( "thread-rpc-calls" );

const callbacks = {},
    activeCalls = new Counter().on( "finish", () => {
        if ( process.isDestroying ) destroyLock.done();
    } );

process.destroyController.on( "destroy", () => {
    if ( activeCalls.isFinished ) destroyLock.done();
} );

const events = new Events().watch( ( name, subscribe ) => {
    if ( subscribe ) {
        parentPort.postMessage( JSON.stringify( {
            "method": "/subscribe",
            "params": [ name ],
        } ) );
    }
    else {
        parentPort.postMessage( JSON.stringify( {
            "method": "/unsubscribe",
            "params": [ name ],
        } ) );
    }
} );

class Host {
    #requestId = 0;

    // public
    on ( name, listener ) {
        events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        events.off( name, listener );

        return this;
    }

    emit ( name, ...args ) {
        events.emit( name, ...args );

        return this;
    }

    publish ( name, ...args ) {
        parentPort.postMessage( JSON.stringify( {
            "method": "/publish",
            "params": [ name, ...args ],
        } ) );

        events.emit( name, ...args );

        return this;
    }

    async call ( method, ...args ) {

        // service is destroying
        if ( process.isDestroying ) return result( -32_816 );

        const id = ++this.#requestId;

        return new Promise( resolve => {
            callbacks[ id ] = resolve;

            parentPort.postMessage( JSON.stringify( {
                id,
                method,
                "params": args,
            } ) );

            activeCalls.value++;
        } );
    }

    voidCall ( method, ...args ) {

        // service is destroying
        if ( process.isDestroying ) return;

        parentPort.postMessage( JSON.stringify( {
            method,
            "params": args,
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
    worker = await Worker.new( ...( JSON.parse( workerData.args ) || [] ) );
}
else {
    worker = new Worker( ...( JSON.parse( workerData.args || "null" ) || [] ) );
}

parentPort.on( "message", async msg => {
    msg = JSON.parse( msg );

    // request
    if ( msg.method ) {

        // destroy
        if ( msg.method === "/destroy" ) {
            process.destroy();
        }

        // publish
        else if ( msg.method === "/publish" ) {
            global.host.emit( msg.params.shift(), ...msg.params );
        }

        // rpc call
        else {
            const method = "API_" + kebabToCamelCase( msg.method );

            // rpc call
            if ( msg.id ) {
                activeCalls.value++;

                let res;

                if ( !worker[ method ] ) {
                    res = result( -32_809 );
                }
                else {
                    try {
                        res = result.try( await worker[ method ]( ...msg.params ) );
                    }
                    catch ( e ) {
                        res = result.catch( e );
                    }
                }

                parentPort.postMessage( JSON.stringify( {
                    "id": msg.id,
                    "result": res,
                } ) );

                activeCalls.value--;
            }

            // void rpc call
            else if ( worker[ method ] ) {
                activeCalls.value++;

                try {
                    worker[ method ]( ...msg.params );
                }
                catch ( e ) {
                    console.log( e );
                }

                activeCalls.value--;
            }
        }
    }

    // rpc response
    else {
        const callback = callbacks[ msg.id ];

        if ( callback ) {
            delete callbacks[ msg.id ];

            callback( result.fromJson( msg.result ) );

            activeCalls.value--;
        }
    }
} );

parentPort.postMessage( JSON.stringify( {
    "method": "/ready",
} ) );

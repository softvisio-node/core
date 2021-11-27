import "#lib/result";
import Events from "events";
import msgpack from "#lib/msgpack";
import { parentPort, workerData } from "worker_threads";
import threadsConst from "#lib/threads/const";

const callbacks = {};

class Host extends Events {
    #requestId = 0;

    constructor () {
        super();

        this.on( "newListener", this.#subscribe.bind( this ) );

        this.on( "removeListener", this.#unsubscribe.bind( this ) );
    }

    publish ( ...args ) {

        // reserved event
        if ( threadsConst.reservedEvents.has( args[0] ) ) throw `Threads event name "${args[0]}" is reserved`;

        parentPort.postMessage( msgpack.encode( {
            "method": "/publish",
            "params": args,
        } ) );

        return true;
    }

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

    // private
    #subscribe ( name ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        // already subscribed
        if ( this.listenerCount( name ) ) return;

        parentPort.postMessage( msgpack.encode( {
            "method": "/subscribe",
            "params": [name],
        } ) );
    }

    #unsubscribe ( name ) {
        if ( name === "newListener" || name === "removeListener" ) return;

        // not unsubscribed
        if ( this.listenerCount( name ) ) return;

        parentPort.postMessage( msgpack.encode( {
            "method": "/unsubscribe",
            "params": [name],
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
        if ( msg.method === "/publish" ) {

            // reserved event
            if ( threadsConst.reservedEvents.has( msg.params[0] ) ) throw `Threads event name "${msg.params[0]}" is reserved`;

            global.host.emit( ...msg.params );
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

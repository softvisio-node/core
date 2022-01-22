import Events from "#lib/events";
import * as uuid from "#lib/uuid";

export default class EventsHub {
    #id = uuid.v4();
    #watch = new Events();
    #forward = new Events();
    #queues = {};
    #links = new Map();

    // public
    on ( queue, name, listener ) {
        this.#subscribe( queue, name, listener, false );
    }

    off ( queue, name, listener ) {
        this.#unsubscribe( queue, name, listener );
    }

    once ( queue, name, listener ) {
        this.#subscribe( queue, name, listener, true );
    }

    watch ( queue, listener ) {
        this.#watch.on( queue, listener );
    }

    unwatch ( queue, listener ) {
        this.#watch.off( queue, listener );
    }

    forward ( queue, listener ) {
        this.#forward.on( queue, listener );
    }

    unforward ( queue, listener ) {
        this.#forward.off( queue, listener );
    }

    // XXX publisherid???
    publish ( queue, name, args, publisherId ) {
        if ( publisherId === this.#id ) return;

        PUBLISH: {
            const listeners = this.#queues[queue]?.get( name );
            if ( !listeners ) break PUBLISH;

            for ( const [listener, once] of listeners.entries() ) {
                listener( ...args );

                if ( once ) this.#unsubscribe( queue, name, listener );
            }
        }

        this.#forward.emit( queue, name, args, publisherId || this.#id );
    }

    // send( localQueue, remoteQueue ) - forward all events from local to remote
    // recv( remoteQueue, localQueue ) - forward all events from remote to local
    // sendOnListen( remoteQueue, localQueue ) - send events to the remote hub only when remote hub has listeners
    // recvOnListen( localQueue, remoteQueue ) - receive events from the remote hub only when has local listeners
    // watch( remoteQueue, ( type, queue, name ) => {} ) - watch for listeners on remote hub, type: subscribe, unsubscribe
    link ( hub, { send, recv, sendOnListen, recvOnListen, watch } ) {
        if ( this.#links.has( hub ) ) throw `Hub already linked`;

        const spec = {
            "send": [],
            "recv": [],
            "sendOnListen": [],
            "sendOnListenListeners": {},
            "recvOnListen": [],
            "recvOnListenListeners": {},
            "watch": [],
        };
        this.#links.set( hub, spec );

        // send
        for ( const [localQueue, remoteQueue] of Object.entries( send || {} ) ) {
            const listener = ( name, args, publisherId ) => hub.publish( remoteQueue, name, args, publisherId );

            spec.send.push( [localQueue, listener] );
            this.forward( localQueue, listener );
        }

        // recv
        for ( const [remoteQueue, localQueue] of Object.entries( recv || {} ) ) {
            const listener = ( name, args, publisherId ) => this.publish( localQueue, name, args, publisherId );

            spec.recv.push( [remoteQueue, listener] );
            hub.forward( remoteQueue, listener );
        }

        // sendOnListen
        for ( const [remoteQueue, localQueue] of Object.entries( sendOnListen || {} ) ) {
            const listener = ( type, queue, name ) => {
                const listenerId = remoteQueue + "/" + name;

                if ( type === "subscribe" ) {
                    const listener = ( ...args ) => hub.publish( remoteQueue, name, args );

                    spec.sendOnListenListeners[listenerId] = [localQueue, name, listener];

                    this.on( localQueue, name, listener );
                }
                else if ( type === "unsubscribe" ) {
                    this.off( ...spec.sendOnListenListeners[listenerId] );

                    delete spec.sendOnListenListeners[listenerId];
                }
            };

            spec.sendOnListen.push( [remoteQueue, listener] );

            hub.watch( remoteQueue, listener );
        }

        // recvOnListen
        for ( const [localQueue, remoteQueue] of Object.entries( recvOnListen || {} ) ) {
            const listener = ( type, queue, name ) => {
                const listenerId = localQueue + "/" + name;

                if ( type === "subscribe" ) {
                    const listener = ( ...args ) => this.publish( localQueue, name, args );

                    spec.recvOnListenListeners[listenerId] = [remoteQueue, name, listener];

                    hub.on( remoteQueue, name, listener );
                }
                else if ( type === "unsubscribe" ) {
                    hub.off( ...spec.recvOnListenListeners[listenerId] );

                    delete spec.recvOnListenListeners[listenerId];
                }
            };

            spec.recvOnListen.push( [localQueue, listener] );

            this.watch( localQueue, listener );
        }

        // watch
        for ( const [remoteQueue, listener] of Object.entries( watch || {} ) ) {
            spec.watch.push( [remoteQueue, listener] );
            hub.watch( remoteQueue, listener );
        }
    }

    unlink ( hub ) {
        const spec = this.#links.get( hub );

        if ( !spec ) return;
        this.#links.delete( hub );

        // send
        for ( const args of spec.send ) this.unforward( ...args );

        // recv
        for ( const args of spec.recv ) hub.unforward( ...args );

        // sendOnListen
        for ( const args of spec.sendOnListen ) hub.unwatch( ...args );
        for ( const args of Object.values( spec.sendOnListenListeners ) ) this.off( ...args );

        // recvOnListen
        for ( const args of spec.recvOnListen ) this.unwatch( ...args );
        for ( const args of Object.values( spec.recvOnListenListeners ) ) hub.off( ...args );

        // watch
        for ( const args of spec.watch ) hub.unwatch( ...args );
    }

    unlinkAll () {
        for ( const hub of this.#links.keys() ) this.unlink( hub );
    }

    hasListeners ( queue, name ) {
        return !!this.#queues[queue]?.get( name )?.size;
    }

    // private
    #subscribe ( queue, name, listener, once ) {
        const events = ( this.#queues[queue] ??= new Map() );

        var listeners = events.get( name );
        if ( !listeners ) {
            listeners = new Map();
            events.set( name, listeners );
        }

        if ( listeners.has( listener ) ) return;

        listeners.set( listener, once );

        if ( listeners.size === 1 ) this.#watch.emit( queue, "subscribe", queue, name );
    }

    #unsubscribe ( queue, name, listener ) {
        const events = this.#queues[queue];
        if ( !events ) return;

        const listeners = events.get( name );
        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            events.delete( name );
            this.#watch.emit( queue, "unsubscribe", queue, name );
        }

        if ( !events.size ) delete this.#queues[queue];
    }
}

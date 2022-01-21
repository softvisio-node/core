import Events from "#lib/events";
import * as uuid from "#lib/uuid";

export default class EventsHub {
    #id = new uuid.v4();
    #watchers = new Events();
    #forward = new Events();
    #listeners = {};
    #links = new Map();

    // public
    on ( prefix, name, listener ) {
        this.#subscribe( prefix, name, listener, false );
    }

    off ( prefix, name, listener ) {
        this.#unsubscribe( prefix, name, listener );
    }

    once ( prefix, name, listener ) {
        this.#subscribe( prefix, name, listener, true );
    }

    watch ( prefix, listener ) {
        this.#watchers.on( prefix, listener );
    }

    unwatch ( prefix, listener ) {
        this.#watchers.off( prefix, listener );
    }

    forward ( prefix, listener ) {
        this.#forward.on( prefix, listener );
    }

    unforward ( prefix, listener ) {
        this.#forward.off( prefix, listener );
    }

    publish ( prefix, name, args, publisherId ) {
        if ( publisherId === this.#id ) return;

        PUBLISH: {
            const queue = this.#listeners[prefix];
            if ( !queue ) break PUBLISH;

            const listeners = queue.get( name );
            if ( !listeners ) break PUBLISH;

            for ( const [listener, once] of listeners.entries() ) {
                listener( ...args );

                if ( once ) this.#unsubscribe( prefix, name, listener );
            }
        }

        this.#forward.emit( prefix, name, args, publisherId || this.#id );
    }

    // send( localPrefix, remotePrefix ) - forward all events from local to remote
    // recv( remotePrefix, localPrefix ) - forward all events from remote to local
    // sendOnListen( remotePrefix, localPrefix ) - send events to the remote hub only when remote hub has listeners
    // recvOnListen( localPrefix, remotePrefix ) - receive events from the remote hub only when has local listeners
    // watch( remotePrefix, ( type, prefix, name ) => {} ) - watch for listeners on remote hub, type: subscribe, unsubscribe
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
        for ( const [localPrefix, remotePrefix] of Object.entries( send || {} ) ) {
            const listener = ( name, args, publisherId ) => hub.publish( remotePrefix, name, args, publisherId );

            spec.send.push( [localPrefix, listener] );
            this.forward( localPrefix, listener );
        }

        // recv
        for ( const [remotePrefix, localPrefix] of Object.entries( recv || {} ) ) {
            const listener = ( name, args, publisherId ) => this.publish( localPrefix, name, args, publisherId );

            spec.recv.push( [remotePrefix, listener] );
            hub.forward( remotePrefix, listener );
        }

        // sendOnListen
        for ( const [remotePrefix, localPrefix] of Object.entries( sendOnListen || {} ) ) {
            const listener = ( type, prefix, name ) => {
                const listenerId = remotePrefix + "/" + name;

                if ( type === "subscribe" ) {
                    const listener = ( ...args ) => hub.publish( remotePrefix, name, args );

                    spec.sendOnListenListeners[listenerId] = [localPrefix, name, listener];

                    this.on( localPrefix, name, listener );
                }
                else if ( type === "unsubscribe" ) {
                    this.off( ...spec.sendOnListenListeners[listenerId] );

                    delete spec.sendOnListenListeners[listenerId];
                }
            };

            spec.sendOnListen.push( [remotePrefix, listener] );

            hub.watch( remotePrefix, listener );
        }

        // recvOnListen
        for ( const [localPrefix, remotePrefix] of Object.entries( recvOnListen || {} ) ) {
            const listener = ( type, prefix, name ) => {
                const listenerId = localPrefix + "/" + name;

                if ( type === "subscribe" ) {
                    const listener = ( ...args ) => this.publish( localPrefix, name, args );

                    spec.recvOnListenListeners[listenerId] = [remotePrefix, name, listener];

                    hub.on( remotePrefix, name, listener );
                }
                else if ( type === "unsubscribe" ) {
                    hub.off( ...spec.recvOnListenListeners[listenerId] );

                    delete spec.recvOnListenListeners[listenerId];
                }
            };

            spec.recvOnListen.push( [localPrefix, listener] );

            this.watch( localPrefix, listener );
        }

        // watch
        for ( const [remotePrefix, listener] of Object.entries( watch || {} ) ) {
            spec.watch.push( [remotePrefix, listener] );
            hub.watch( remotePrefix, listener );
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

    hasListeners ( prefix, name ) {
        return !!this.#listeners[prefix]?.get( name )?.size;
    }

    // private
    #subscribe ( prefix, name, listener, once ) {
        const queue = ( this.#listeners[prefix] ??= new Map() );

        var listeners = queue.get( name );
        if ( !listeners ) {
            listeners = new Map();
            queue.set( name, listeners );
        }

        if ( listeners.has( listener ) ) return;

        listeners.set( listener, once );

        if ( listeners.size === 1 ) this.#watchers.emit( prefix, "subscribe", prefix, name );
    }

    #unsubscribe ( prefix, name, listener ) {
        const queue = this.#listeners[prefix];
        if ( !queue ) return;

        const listeners = queue.get( name );
        if ( !listeners ) return;

        listeners.delete( listener );

        if ( !listeners.size ) {
            queue.delete( name );
            this.#watchers.emit( prefix, "unsubscribe", prefix, name );
        }

        if ( !queue.size ) delete this.#listeners[prefix];
    }
}

export default class EventsHub {
    #events = {};
    #targets = new Map();

    // public
    on ( name, listener ) {
        return this.#subscribe( name, listener, false );
    }

    once ( name, listener ) {
        return this.#subscribe( name, listener, true );
    }

    off ( name, listener ) {
        return this.#unsubscribe( name, listener );
    }

    emit ( name, ...args ) {
        if ( this.#events[name] ) {
            for ( const [listener, once] of this.#events[name].entries() ) {
                listener( ...args );

                if ( once ) this.#unsubscribe( name, listener );
            }

            return this;
        }
    }

    link ( target, { on, listener } = {} ) {

        // already linked
        if ( this.#targets.has( target ) ) this.unlink( target );

        on ||= name => name;
        listener ||= ( name, ...args ) => this.emit( name, ...args );

        const spec = {
            listener,
            "names": {},
            "subscriber": name => {
                const remoteName = on( name );

                // do not subscribe
                if ( !remoteName ) return;

                // subscribe
                spec.names[name] = remoteName;
                target.on( remoteName, listener );
            },
        };

        this.#targets.set( target, spec );

        for ( const name of Object.keys( this.#events ) ) {
            spec.subscriber( name );
        }

        return this;
    }

    unlink ( target ) {
        const spec = this.#targets.get( target );

        if ( !spec ) return this;

        this.#targets.delete( target );

        for ( const remoteName of Object.values( spec.names ) ) {
            target.off( remoteName, spec.listener );
        }

        return this;
    }

    // private
    #subscribe ( name, listener, once ) {
        this.#events[name] ||= new Map();

        const size = this.#events[name].size;

        this.#events[name].set( listener, once );

        if ( !size && this.#events[name].size === 1 ) {

            // subscribed
            for ( const { subscriber } of this.#targets.values() ) {
                subscriber( name );
            }
        }

        return this;
    }

    #unsubscribe ( name, listener ) {
        if ( this.#events[name]?.has( listener ) ) {
            this.#events[name].delete( listener );

            if ( !this.#events[name].size ) {
                delete this.#events[name];

                // unsubscribed
                for ( const [target, spec] of this.#targets.entries() ) {
                    const remoteName = spec.names[name];

                    if ( remoteName ) {
                        target.off( remoteName, spec.listener );
                        delete spec.names[name];
                    }
                }
            }
        }

        return this;
    }
}

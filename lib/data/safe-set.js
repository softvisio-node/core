import watch from "#lib/devel/watch";

export default class SafeSet {
    #weakMap = new WeakMap();
    #weakRefs = new Map();

    // properties
    get size () {
        return this.#weakRefs.size;
    }

    // public
    has ( value ) {
        return this.#weakMap.has( value );
    }

    add ( value ) {
        if ( !this.#weakMap.has( value ) ) {
            const weakRef = new WeakRef( value );

            const watcher = watch( value ).once( "destroy", () => this.#weakRefs.delete( weakRef ) );

            this.#weakRefs.set( weakRef, watcher );

            this.#weakMap.set( value, weakRef );
        }

        return this;
    }

    delete ( value ) {
        const weakRef = this.#weakMap.get( value );

        if ( weakRef ) {
            this.#weakMap.delete( value );

            const watcher = this.#weakRefs.get( weakRef );

            this.#weakRefs.delete( weakRef );

            watcher.unregister();
        }

        return this;
    }

    clear () {
        for ( const [weakRef, watcher] of this.#weakRefs.entries() ) {
            this.#weakRefs.delete( weakRef );

            this.#weakMap.delete( weakRef.deref() );

            watcher.unregister();
        }

        return this;
    }

    *values () {
        for ( const ref of this.#weakRefs.keys() ) {
            const value = ref.deref();

            if ( !value ) continue;

            yield value;
        }
    }

    [Symbol.iterator] () {
        return this.values();
    }
}

export default class SafeMap {
    #finalizationRegistry;
    #weakMap = new WeakMap();
    #weakRefs = new Set();

    constructor () {
        this.#finalizationRegistry = new FinalizationRegistry( weakRef => this.#weakRefs.delete( weakRef ) );
    }

    // properties
    get size () {
        return this.#weakRefs.size;
    }

    // public
    has ( key ) {
        return this.#weakMap.has( key );
    }

    get ( key ) {
        return this.#weakMap.get( key )?.value;
    }

    set ( key, value ) {
        if ( this.#weakMap.has( key ) ) {
            this.#weakMap.get( key ).value = value;
        }
        else {
            const weakRef = new WeakRef( key );

            this.#weakMap.set( key, { weakRef, value } );

            this.#finalizationRegistry.register( key, weakRef, weakRef );

            this.#weakRefs.add( weakRef );
        }

        return this;
    }

    delete ( key ) {
        const weakRef = this.#weakMap.get( key )?.weakRef;

        if ( weakRef ) {
            this.#weakMap.delete( key );

            this.#weakRefs.delete( weakRef );

            this.#finalizationRegistry.unregister( weakRef );
        }

        return this;
    }

    clear () {
        for ( const weakRef of this.#weakRefs ) {
            this.#weakRefs.delete( weakRef );

            this.#weakMap.delete( weakRef.deref() );

            this.#finalizationRegistry.unregister( weakRef );
        }

        return this;
    }

    * keys () {
        for ( const weakRef of this.#weakRefs ) {
            const key = weakRef.deref();

            if ( !key ) continue;

            yield key;
        }
    }

    * values () {
        for ( const weakRef of this.#weakRefs ) {
            const key = weakRef.deref();

            if ( !key ) continue;

            yield this.#weakMap.get( key ).value;
        }
    }

    * entries () {
        for ( const weakRef of this.#weakRefs ) {
            const key = weakRef.deref();

            if ( !key ) continue;

            yield [ key, this.#weakMap.get( key ).value ];
        }
    }

    [ Symbol.iterator ] () {
        return this.entries();
    }
}

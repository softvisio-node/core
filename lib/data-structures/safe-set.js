export default class SafeSet {
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
    has ( value ) {
        return this.#weakMap.has( value );
    }

    add ( value ) {
        if ( !this.#weakMap.has( value ) ) {
            const weakRef = new WeakRef( value );

            this.#weakMap.set( value, weakRef );

            this.#finalizationRegistry.register( value, weakRef, weakRef );

            this.#weakRefs.add( weakRef );
        }

        return this;
    }

    delete ( value ) {
        const weakRef = this.#weakMap.get( value );

        if ( weakRef ) {
            this.#weakMap.delete( value );

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

    * values () {
        for ( const weakRef of this.#weakRefs ) {
            const value = weakRef.deref();

            if ( !value ) continue;

            yield value;
        }
    }

    [ Symbol.iterator ] () {
        return this.values();
    }
}

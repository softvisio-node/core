import uuidv4 from "#lib/uuid";

export default class Set {
    #targets = {};
    #finalizationRegistry;

    constructor () {
        this.#finalizationRegistry = new FinalizationRegistry( this.#onProxyDestroy.bind( this ) );
    }

    // public
    has ( id ) {
        return !!this.#targets[id];
    }

    get ( id, options ) {
        var target;

        id ||= uuidv4();

        if ( !this.#targets[id] ) {
            target = this._createItem( id, { ...( options || {} ) } );

            this.#targets[id] = {
                "proxies": 1,
                target,
            };
        }
        else {
            target = this.#targets[id].target;

            this.#targets[id].proxies++;
        }

        const proxy = new Proxy( target, this._getProxyHandler() );

        this.#finalizationRegistry.register( proxy, id );

        return proxy;
    }

    // protected
    _getProxyHandler () {
        return {
            get ( target, property ) {
                const value = target[property];

                if ( typeof value === "function" ) {
                    return value.bind( target );
                }
                else {
                    return value;
                }
            },

            set ( target, property, value ) {
                target[property] = value;

                return true;
            },
        };
    }

    _createItem ( id, options ) {
        throw `Method not implemented`;
    }

    _isItemFinished ( target ) {
        throw `Method not implemented`;
    }

    _onItemFinish ( id ) {
        this.#tryDeleteTarget( id );
    }

    // private
    #onProxyDestroy ( id ) {
        this.#targets[id].proxies--;

        this.#tryDeleteTarget( id );
    }

    #tryDeleteTarget ( id ) {
        if ( this.#targets[id].proxies ) return;

        if ( !this._isItemFinished( this.#targets[id].target ) ) return;

        delete this.#targets[id];
    }
}

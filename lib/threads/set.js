import uuidv4 from "#lib/uuid";

export default class Set {
    #items = {};
    #finalizationRegistry;

    constructor () {
        this.#finalizationRegistry = new FinalizationRegistry( this.#onProxyDestroy.bind( this ) );
    }

    // public
    has ( id ) {
        return !!this.#items[id];
    }

    get ( id, options ) {
        var item;

        id ||= uuidv4();

        if ( !this.#items[id] ) {
            item = this._createItem( id, { ...( options || {} ) } );

            this.#items[id] = {
                "proxies": 1,
                item,
            };
        }
        else {
            item = this.#items[id].item;

            this.#items[id].proxies++;
        }

        const proxy = new Proxy( item, {
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
        } );

        this.#finalizationRegistry.register( proxy, id );

        return proxy;
    }

    // protected
    _createItem ( id, options ) {
        throw `Method not implemented`;
    }

    _isFinished ( item ) {
        throw `Method not implemented`;
    }

    _checkFinished ( id ) {
        this.#tryDeleteItem( id );
    }

    // private
    #onProxyDestroy ( id ) {
        this.#items[id].proxies--;

        this.#tryDeleteItem( id );
    }

    #tryDeleteItem ( id ) {
        if ( this.#items[id].proxies ) return;

        if ( !this._isFinished( this.#items[id].item ) ) return;

        delete this.#items[id];
    }
}

export default class Templates {
    #app;
    #templates = {};

    constructor ( app ) {
        this.#app = app;
    }

    // public
    get ( id ) {
        return this.#templates[ id ];
    }

    add ( templates ) {
        for ( const id in templates ) {
            this.#templates[ id ] = l10nt( templates[ id ] );
        }
    }
}

export default class AjvErrors {
    #errors;
    #messages;
    #toString;

    constructor ( errors ) {
        this.#errors = errors;
    }

    get raw () {
        return this.#errors;
    }

    get messages () {
        if ( !this.#messages ) {
            const messages = [];

            for ( const error of this.#errors ) {
                if ( error.keyword === "errorMessage" ) {
                    messages.push( error.message );
                }
                else if ( !error.instancePath ) {
                    messages.push( `Data ${error.message}` );
                }
                else {
                    messages.push( `Value at "${error.instancePath}" ${error.message}` );
                }
            }

            this.#messages = messages;
        }

        return this.#messages;
    }

    // public
    toString () {
        this.#toString ??= this.messages.join( "\n" );

        return this.#toString;
    }

    toJSON () {
        return this.#messages;
    }

    map ( callback ) {
        return this.#errors.map( callback );
    }
}

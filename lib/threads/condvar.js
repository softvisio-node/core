const CallableInstance = require( "callable-instance" );

class CondVar extends CallableInstance {
    #resolve = null;
    #resolved = false;
    #i = 0;
    #res = undefined;

    constructor () {
        super( "send" );
    }

    begin () {
        this.#i++;

        return this;
    }

    end () {
        this.#i--;

        if ( !this.#i ) this.send();

        return this;
    }

    send () {
        this.#res = arguments;

        if ( !this.#resolved ) {
            this.#resolved = true;

            const resolve = this.#resolve;

            if ( resolve ) {
                this.#resolve = null;

                resolve( this.#res );
            }
        }
    }

    async recv () {
        if ( this.#resolved ) {
            return this.#res;
        }
        else {
            return new Promise( ( resolve ) => {
                this.#resolve = resolve;
            } );
        }
    }
}

module.exports = function () {
    return new CondVar();
};

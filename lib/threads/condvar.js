module.exports = class CondVar {
    #resolve = null;
    #resolved = false;
    #i = 0;
    #res = undefined;

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
        if ( !this.#resolved ) {
            this.#resolved = true;

            this.#res = arguments;

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
};

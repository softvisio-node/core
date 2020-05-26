module.exports = class CondVar {
    #resolve;
    #resolved = false;
    #i = 0;
    #res;

    begin () {
        this.#i++;

        return this;
    }

    end () {
        this.#i--;

        if ( !this.#i ) this.send();

        return this;
    }

    send ( res ) {
        if ( !this.#resolved ) {
            this.#resolved = true;

            this.#res = res;

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

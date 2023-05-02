export default class CondVar {
    #resolve;
    #waitCb;
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

            const waitCb = this.#waitCb;

            if ( waitCb ) {
                this.#waitCb = null;

                this.#res = waitCb( res );
            }
            else {
                this.#res = res;
            }

            const resolve = this.#resolve;

            if ( resolve ) {
                this.#resolve = null;

                resolve( this.#res );
            }
        }
    }

    async wait ( resolve ) {
        if ( this.#resolved ) {
            if ( resolve ) this.#res = resolve( this.#res );

            return this.#res;
        }
        else {
            this.#waitCb = resolve;

            return new Promise( resolve => {
                this.#resolve = resolve;
            } );
        }
    }
}

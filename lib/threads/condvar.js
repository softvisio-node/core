module.exports = class CondVar {
    #resolve;
    #recvCb;
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

            const recvCb = this.#recvCb;

            if ( recvCb ) {
                this.#recvCb = null;

                this.#res = recvCb( res );
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

    async recv ( resolve ) {
        if ( this.#resolved ) {
            return this.#res;
        }
        else {
            this.#recvCb = resolve;

            return new Promise( resolve => {
                this.#resolve = resolve;
            } );
        }
    }
};

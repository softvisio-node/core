import ThreadsPool from "#lib/threads/pool";
import Signal from "#lib/threads/signal";
import uuid from "#lib/uuid";

export default class ThreadsPoolQueue extends ThreadsPool {
    #queue = [];
    #results = {};
    #signal = new Signal();

    // public
    async pushThread ( method ) {
        const id = uuid();

        this.#queue.push( id );

        const res = await this.runThread( method );

        this.#results[ id ] = res;

        this.#ready();
    }

    async getResult () {

        // queue is empty
        if ( !this.#queue.length ) return;

        const res = this.#getResult();

        if ( res ) return res;

        return this.#signal.wait();
    }

    // private
    #ready () {
        if ( !this.#signal.waitingThreads ) return;

        const res = this.#getResult();
        if ( !res ) return;

        this.#signal.broadcast( res );

        this.#ready();
    }

    #getResult () {
        const id = this.#queue[ 0 ];
        if ( !id ) return;

        const res = this.#results[ id ];
        if ( !res ) return;

        this.#queue.shift();
        delete this.#results[ id ];

        return res;
    }
}

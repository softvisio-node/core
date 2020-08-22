/** summary: Semaphore.
 * description: |-
 *   ```
 *   var sem = new Semaphore(3);
 *   await sem.down();
 *   sem->up();
 *   ```
 */

module.exports = class Semaphore {
    #maxThreads;
    #count;
    #waiters = [];

    constructor ( count ) {
        this.#maxThreads = count || 0;
        this.#count = this.#maxThreads;
    }

    get count () {
        return this.#count;
    }

    set count ( count ) {
        if ( this.#maxThreads === count ) return;

        this.#count += count - this.#maxThreads;

        this.#maxThreads = count;

        while ( this.#waiters.length && this.#count > 0 ) {
            this.#count--;

            const waiter = this.#waiters.shift();

            waiter();
        }
    }

    get waiters () {
        return this.#waiters.length;
    }

    async down () {
        if ( this.#count > 0 ) {
            this.#count--;

            return;
        }

        return new Promise( resolve => {
            this.#waiters.push( resolve );
        } );
    }

    up () {
        this.#count++;

        if ( this.#waiters.length && this.#count > 0 ) {
            this.#count--;

            const waiter = this.#waiters.shift();

            waiter();
        }
    }

    async runThread ( func ) {
        await this.down();

        try {
            const res = await func();

            this.up();

            return res;
        }
        catch ( e ) {
            this.up();

            throw e;
        }
    }
};

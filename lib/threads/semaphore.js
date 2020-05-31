/** SYNOPSIS
var sem = new Semaphoer(3);

await sem.down();

sem->up();
*/

module.exports = class {
    #initialCount;
    #count;
    #waiters = [];

    constructor ( count ) {
        this.#initialCount = count || 0;
        this.#count = this.#initialCount;
    }

    getCount () {
        return this.#count;
    }

    setCount ( count ) {
        if ( this.#initialCount === count ) return;

        this.#count += count - this.#initialCount;

        this.#initialCount = count;

        while ( this.#waiters.length && this.#count > 0 ) {
            this.#count--;

            const waiter = this.#waiters.shift();

            waiter();
        }
    }

    getWaiters () {
        return this.#waiters.length;
    }

    async down () {
        if ( this.#count > 0 ) {
            this.#count--;

            return;
        }

        return new Promise( ( resolve ) => {
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

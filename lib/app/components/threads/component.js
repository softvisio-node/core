import Threads from "#lib/threads";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Threads();
        }

        async _start () {
            return this.app._startThreads();
        }

        async _shutDown () {
            return this.instance.shutDown();
        }
    };

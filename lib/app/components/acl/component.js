import Acl from "./acl.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Acl( this.app, this.config );
        }

        async _configure () {
            return this.instance.configure();
        }

        async _init () {
            return this.instance.init();
        }

        async _start () {
            return this.instance.start();
        }

        async _destroy () {
            return this.instance.destroy();
        }
    };

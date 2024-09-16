import Users from "./users.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Users( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }
    };

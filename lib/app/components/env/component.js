import Env from "./env.js";

export default Super =>
    class extends Super {

        // protectes
        _install () {
            return new Env( this.app, this.config );
        }
    };

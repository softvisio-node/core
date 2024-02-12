import ActionTokens from "./action-tokens.js";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new ActionTokens( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }
    };

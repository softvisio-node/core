import Translations from "./translations.js";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return Boolean( this.app.dbh );
        }

        async _install () {
            return new Translations( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }
    };

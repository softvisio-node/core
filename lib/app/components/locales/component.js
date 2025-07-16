import Locales from "./locales.js";

export default Super =>
    class extends Super {

        // protectes
        _install () {
            return new Locales( this.app, this.config );
        }

        async _configure () {
            if ( this.config.defaultLocale ) {
                if ( !this.config.locales.includes( this.config.defaultLocale ) ) {
                    return result( [ 400, "Default locale is not valid" ] );
                }
            }

            return super._configure();
        }

        _init () {
            return this.instance.init();
        }
    };

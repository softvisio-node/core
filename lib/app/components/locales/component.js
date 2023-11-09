import Component from "#lib/app/component";
import Locales from "./locales.js";

export default class extends Component {

    // protectes
    async _configure () {
        if ( this.config.defaultLocale ) {
            if ( !this.config.locales.includes( this.config.defaultLocale ) ) {
                return result( [400, `Default locale is not valid`] );
            }
        }

        return super._configure();
    }

    _install () {
        return new Locales( this.app, this.config );
    }

    _init () {
        return this.instance.init();
    }
}

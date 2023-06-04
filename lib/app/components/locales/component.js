import Component from "#lib/app/component";
import Locales from "./locales.js";

export default class extends Component {

    // protectes
    _configure () {
        if ( this.config.defaultLocale && !this.config.locales.includes( this.config.defaultLocale ) ) {
            return result( [400, `Default locale is not in the list of locales`] );
        }

        return result( 200 );
    }

    _install () {
        return new Locales( this.app, this.config );
    }
}

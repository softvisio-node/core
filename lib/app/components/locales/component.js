import Component from "#lib/app/component";
import Locales from "./locales.js";

export default class extends Component {

    // protectes
    _install () {
        return new Locales( this.app, this.config );
    }

    _init () {
        return this.instance.init();
    }
}

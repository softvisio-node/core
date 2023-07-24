import Component from "#lib/app/component";
import ActionTokens from "./action-tokens.js";

export default class extends Component {

    // protected
    async _install () {
        return new ActionTokens( this.app, this.config );
    }

    async _init () {
        return this.instance.init();
    }
}

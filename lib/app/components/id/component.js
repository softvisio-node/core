import Component from "#lib/app/component";
import Id from "./id.js";

export default class extends Component {

    // protected
    async _install () {
        return new Id( this.app, this.config );
    }

    async _init () {
        return this.value.init();
    }
}

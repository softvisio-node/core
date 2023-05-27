import Component from "#lib/app/component";
import Users from "./users.js";

export default class extends Component {

    // protected
    async _install () {
        return new Users( this.app, this.config );
    }

    async _init () {
        return this.value.init();
    }
}

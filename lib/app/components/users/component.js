import Component from "#lib/app/component";
import Users from "./users.js";

export default class extends Component {
    async _install () {
        return new Users( this.app, this.config );
    }

    async _configureInstance () {
        return this.instance.configure();
    }

    async _init () {
        return this.instance.init();
    }
}

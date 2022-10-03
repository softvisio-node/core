import Component from "#lib/app/component";
import Notifications from "./notifications.js";

export default class extends Component {

    // protected
    async _install () {
        return Notifications.new( this.app, this.config );
    }

    async run () {
        return this.value.run();
    }
}

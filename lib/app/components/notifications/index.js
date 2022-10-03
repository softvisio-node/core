import Component from "#lib/app/component";
import Notifications from "./notifications.js";

export default class extends Component {

    // protected
    async _install () {
        return Notifications.new( this.app );
    }

    async run () {
        return this.value.run();
    }
}

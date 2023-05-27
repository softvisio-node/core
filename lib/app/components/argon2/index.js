import Component from "#lib/app/component";
import Argon2 from "#lib/argon2";

export default class extends Component {

    // protected
    async _init () {
        return new Argon2( this.config );
    }
}

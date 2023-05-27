import Component from "#lib/app/api/component";
import * as validate from "#lib/utils/validate";

export default class extends Component {

    // public
    validatePassword ( value ) {
        return validate.validatePassword( value, { "strength": this.api.config.passwordsStrength } );
    }
}

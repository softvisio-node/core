import Component from "#lib/app/api/component";
import constants from "#lib/app/constants";
import * as validate from "#lib/utils/validate";

export default class extends Component {

    // public
    userIsRoot ( userId ) {
        return userId + "" === constants.rootUserId;
    }

    validatePassword ( value ) {
        return validate.validatePassword( value, { "strength": this.api.config.passwordsStrength } );
    }

    validateEmail ( value ) {
        return validate.validateEmail( value );
    }
}

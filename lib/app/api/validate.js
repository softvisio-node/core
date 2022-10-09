import constants from "#lib/app/constants";
import * as validate from "#lib/utils/validate";

export default class {
    #api;

    constructor ( api ) {
        this.#api = api;
    }

    // public
    userIsRoot ( userId ) {
        return userId + "" === constants.rootUserId;
    }

    validatePassword ( value ) {
        return validate.validatePassword( value, { "strength": this.#api.config.passwordsStrength } );
    }

    validateTelegramUsername ( value ) {
        return validate.validateTelegramUsername( value );
    }

    validateEmail ( value ) {
        return validate.validateEmail( value );
    }
}

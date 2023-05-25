import Api from "#lib/app/api";

import Validate from "#lib/app/api/components/validate";
import Health from "#lib/app/api/components/health";
import Frontend from "#lib/app/api/frontend";

const COMPONENTS = {
    "validate": Validate,
    "health": Health,
    "frontend": Frontend,
};

export default class AppRpc extends Api {
    constructor ( app, config, getSchema ) {
        super( app, config, getSchema, COMPONENTS );
    }

    // properties
    get isRpc () {
        return true;
    }
}

import Api from "#lib/app/api";

import Health from "#lib/app/api/components/health";
import Frontend from "#lib/app/api/frontend";

const COMPONENTS = {
    "health": Health,
    "frontend": Frontend,
};

export default class AppRpc extends Api {
    constructor ( app, config ) {
        super( app, config, COMPONENTS );
    }

    // properties
    get isRpc () {
        return true;
    }
}

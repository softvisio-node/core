import Base from "#lib/app/api/base";

import Validate from "#lib/app/api/components/validate";
import Health from "#lib/app/api/components/health";
import Frontend from "#lib/app/api/frontend";

const COMPONENTS = {
    "validate": Validate,
    "health": Health,
    "frontend": Frontend,
};

export default class AppRpc extends Base {
    constructor ( app, config ) {
        super( app, config, COMPONENTS );
    }

    // properties
    get isRpc () {
        return true;
    }

    get httpServer () {
        return this.app.privateHttpServer;
    }
}

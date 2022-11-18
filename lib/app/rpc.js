import Base from "#lib/app/api/base";

import Validate from "#lib/app/api/components/validate";
import HealthCheck from "#lib/app/api/components/health-check";
import Frontend from "#lib/app/api/frontend";

const COMPONENTS = {
    "validate": Validate,
    "healthCheck": HealthCheck,
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

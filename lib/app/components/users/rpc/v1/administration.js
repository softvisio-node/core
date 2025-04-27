import constants from "#lib/app/constants";

export default Super =>
    class extends Super {

        // public
        async [ "API_resetRootPassword" ] ( ctx, password ) {
            return this.app.users.setUserPassword( constants.rootUserId, password );
        }
    };

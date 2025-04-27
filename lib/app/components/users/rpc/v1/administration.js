import constants from "#lib/app/constants";

export default Super =>
    class extends Super {

        // public
        async [ "API_reset-root-password" ] ( ctx, password ) {
            return this.app.users.setUserPassword( constants.rootUserId, password );
        }
    };

import constants from "#lib/app/constants";

export default Super =>
    class extends Super {
        async resetRootPassword ( ctx, password ) {
            return this.app.users.setUserPassword( constants.rootUserId, password );
        }
    };

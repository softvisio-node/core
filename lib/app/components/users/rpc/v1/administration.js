import constants from "#lib/app/constants";

export default Super =>
    class extends Super {
        async resetRoolPassword ( ctx, password ) {
            return this.app.users.setUserPassword( constants.rootUserId, password );
        }
    };

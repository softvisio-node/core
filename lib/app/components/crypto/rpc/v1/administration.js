export default Super =>
    class extends Super {

        // public
        async API_revokeKey ( ctx ) {
            return this.app.crypto.revokeKey();
        }

        async API_revokeMasterKey ( ctx, masterKey ) {
            return this.app.crypto.revokeMasterKey( masterKey );
        }
    };

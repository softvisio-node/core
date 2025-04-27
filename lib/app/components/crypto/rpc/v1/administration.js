export default Super =>
    class extends Super {

        // public
        async [ "API_revoke-key" ] ( ctx ) {
            return this.app.crypto.revokeKey();
        }

        async [ "API_revoke-master-key" ] ( ctx, masterKey ) {
            return this.app.crypto.revokeMasterKey( masterKey );
        }
    };

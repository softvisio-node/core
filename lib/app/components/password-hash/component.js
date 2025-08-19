import PasswordHash from "#lib/crypto/password-hash";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new PasswordHash( this.config );
        }
    };

import Argon2 from "#lib/argon2";

export default Super =>
    class extends Super {

        // protected
        async _install () {
            return new Argon2( this.config );
        }
    };

const { mixin } = require( "../mixins" );
const { ROOT_USER_NAME, ROOT_USER_ID } = require( "../const" );

module.exports = mixin( ( Super ) =>
    class extends Super {
        constructor ( options ) {
            super( options );

            var Backend = require( "./backend" );

            this.backend = new Backend( this );
        }

        // TODO perform auth
        async authenticate ( token ) {
            return this.backend.authenticate( token );
        }

        userIsRoot ( userId ) {
            return userId === ROOT_USER_NAME || userId === ROOT_USER_ID;
        }
    } );

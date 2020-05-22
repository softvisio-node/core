const { mixin } = require( "../../../mixins" );

module.exports = mixin( ( Super ) =>
    class extends Super {
        // TODO
        async userPasswordAuthenticate ( privateToken ) {
            return this._returnAuth( privateToken, privateToken.id, 1 );
        }
    } );

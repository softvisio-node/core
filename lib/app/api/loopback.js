const mixins = require( "../../mixins" );

module.exports = Super =>
    class extends mixins( Super ) {
        constructor ( backend ) {
            super();
        }

        async authenticate ( token ) {
            return;
        }
    };

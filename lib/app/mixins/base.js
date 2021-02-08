const mixins = require( "../../mixins" );

module.exports = Super =>
    class extends mixins( Super || Object ) {
        #app;
        #api;
        #dbh;

        constructor ( api ) {
            super( ...arguments );

            this.#api = api;
        }

        get app () {
            return this.#api.app;
        }

        get api () {
            return this.#api;
        }

        get dbh () {
            return this.#api.app.dbh;
        }
    };

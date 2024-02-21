export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#getme
        async getMe () {
            return this._request( "getMe" );
        }

        // https://core.telegram.org/bots/api#getmycommands
        async getMyCommands ( data ) {
            return this._request( "getMyCommands", data );
        }

        // https://core.telegram.org/bots/api#setmycommands
        async setMyCommands ( data ) {
            return this._request( "setMyCommands", data );
        }

        // https://core.telegram.org/bots/api#deletemycommands
        async deleteMyCommands ( data ) {
            return this._request( "deleteMyCommands", data );
        }

        // https://core.telegram.org/bots/api#getmyname
        async getMyName ( data ) {
            return this._request( "getMyName", data );
        }

        // https://core.telegram.org/bots/api#setmyname
        async setMyName ( data ) {
            return this._request( "setMyName", data );
        }

        // https://core.telegram.org/bots/api#getmyshortdescription
        async getMyShortDescription ( data ) {
            return this._request( "getMyShortDescription", data );
        }

        // https://core.telegram.org/bots/api#setmyshortdescription
        async setMyShortDescription ( data ) {
            return this._request( "setMyShortDescription", data );
        }

        // https://core.telegram.org/bots/api#getmydescription
        async getMyDescription ( data ) {
            return this._request( "getMyDescription", data );
        }

        // https://core.telegram.org/bots/api#setmydescription
        async setMyDescription ( data ) {
            return this._request( "setMyDescription", data );
        }

        // https://core.telegram.org/bots/api#getchatmenubutton
        async getChatMenuButton ( data ) {
            return this._request( "getChatMenuButton", data );
        }

        // https://core.telegram.org/bots/api#setchatmenubutton
        async setChatMenuButton ( data ) {
            return this._request( "setChatMenuButton", data );
        }

        // https://core.telegram.org/bots/api#getmydefaultadministratorrights
        async getMyDefaultAdministratorRights ( data ) {
            return this._request( "getMyDefaultAdministratorRights", data );
        }

        // https://core.telegram.org/bots/api#setmydefaultadministratorrights
        async setMyDefaultAdministratorRights ( data ) {
            return this._request( "setMyDefaultAdministratorRights", data );
        }
    };

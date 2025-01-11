export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#getme
        async getMe () {
            return this._doRequest( "getMe" );
        }

        // https://core.telegram.org/bots/api#getmycommands
        async getMyCommands ( data ) {
            return this._doRequest( "getMyCommands", data );
        }

        // https://core.telegram.org/bots/api#setmycommands
        async setMyCommands ( data ) {
            return this._doRequest( "setMyCommands", data );
        }

        // https://core.telegram.org/bots/api#deletemycommands
        async deleteMyCommands ( data ) {
            return this._doRequest( "deleteMyCommands", data );
        }

        // https://core.telegram.org/bots/api#getmyname
        async getMyName ( data ) {
            return this._doRequest( "getMyName", data );
        }

        // https://core.telegram.org/bots/api#setmyname
        async setMyName ( data ) {
            return this._doRequest( "setMyName", data );
        }

        // https://core.telegram.org/bots/api#getmyshortdescription
        async getMyShortDescription ( data ) {
            return this._doRequest( "getMyShortDescription", data );
        }

        // https://core.telegram.org/bots/api#setmyshortdescription
        async setMyShortDescription ( data ) {
            return this._doRequest( "setMyShortDescription", data );
        }

        // https://core.telegram.org/bots/api#getmydescription
        async getMyDescription ( data ) {
            return this._doRequest( "getMyDescription", data );
        }

        // https://core.telegram.org/bots/api#setmydescription
        async setMyDescription ( data ) {
            return this._doRequest( "setMyDescription", data );
        }

        // https://core.telegram.org/bots/api#getchatmenubutton
        async getChatMenuButton ( data ) {
            return this._doRequest( "getChatMenuButton", data );
        }

        // https://core.telegram.org/bots/api#setchatmenubutton
        async setChatMenuButton ( data ) {
            return this._doRequest( "setChatMenuButton", data );
        }

        // https://core.telegram.org/bots/api#getmydefaultadministratorrights
        async getMyDefaultAdministratorRights ( data ) {
            return this._doRequest( "getMyDefaultAdministratorRights", data );
        }

        // https://core.telegram.org/bots/api#setmydefaultadministratorrights
        async setMyDefaultAdministratorRights ( data ) {
            return this._doRequest( "setMyDefaultAdministratorRights", data );
        }
    };

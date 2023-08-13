export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#getme

        // https://core.telegram.org/bots/api#getmycommands
        async getMyCommands () {}
        async getMe () {}

        // https://core.telegram.org/bots/api#setmycommands
        async setMyCommands () {}

        // https://core.telegram.org/bots/api#deletemycommands
        async deleteMyCommands () {}

        // https://core.telegram.org/bots/api#getmyname
        async getMyName () {}

        // https://core.telegram.org/bots/api#setmyname
        async setMyName () {}

        // https://core.telegram.org/bots/api#getmydescription
        async getMyDescription () {}

        // https://core.telegram.org/bots/api#setmydescription
        async setMyDescription () {}

        // https://core.telegram.org/bots/api#getmyshortdescription
        async getMyShortDescription () {}

        // https://core.telegram.org/bots/api#setmyshortdescription
        async setMyShortDescription () {}

        // https://core.telegram.org/bots/api#getchatmenubutton
        async getChatMenuButton () {}

        // https://core.telegram.org/bots/api#setchatmenubutton
        async setChatMenuButton () {}

        // https://core.telegram.org/bots/api#getmydefaultadministratorrights
        async getMyDefaultAdministratorRights () {}

        // https://core.telegram.org/bots/api#setmydefaultadministratorrights
        async setMyDefaultAdministratorRights () {}
    };

export default Super =>
    class extends ( Super || Object ) {

        // https://core.telegram.org/bots/api#sendchataction
        async sendChatAction ( data ) {}

        // https://core.telegram.org/bots/api#banchatmember
        async banChatMember ( data ) {}

        // https://core.telegram.org/bots/api#unbanchatmember
        async unbanChatMember ( data ) {}

        // https://core.telegram.org/bots/api#restrictchatmember
        async restrictChatMember ( data ) {}

        // https://core.telegram.org/bots/api#promotechatmember
        async promoteChatMember ( data ) {}

        // https://core.telegram.org/bots/api#setchatadministratorcustomtitle
        async setChatAdministratorCustomTitle ( data ) {}

        // https://core.telegram.org/bots/api#banchatsenderchat
        async banChatSenderChat ( data ) {}

        // https://core.telegram.org/bots/api#unbanchatsenderchat
        async unbanChatSenderChat ( data ) {}

        // https://core.telegram.org/bots/api#setchatpermissions
        async setChatPermissions ( data ) {}

        // https://core.telegram.org/bots/api#exportchatinvitelink
        async exportChatInviteLink ( data ) {}

        // https://core.telegram.org/bots/api#createchatinvitelink
        async createChatInviteLink ( data ) {}

        // https://core.telegram.org/bots/api#editchatinvitelink
        async editChatInviteLink ( data ) {}

        // https://core.telegram.org/bots/api#revokechatinvitelink
        async revokeChatInviteLink ( data ) {}

        // https://core.telegram.org/bots/api#approvechatjoinrequest
        async approveChatJoinRequest ( data ) {}

        // https://core.telegram.org/bots/api#declinechatjoinrequest
        async declineChatJoinRequest ( data ) {}

        // https://core.telegram.org/bots/api#setchatphoto
        async setChatPhoto ( data ) {}

        // https://core.telegram.org/bots/api#deletechatphoto
        async deleteChatPhoto ( data ) {}

        // https://core.telegram.org/bots/api#setchattitle
        async setChatTitle ( data ) {}

        // https://core.telegram.org/bots/api#setchatdescription
        async setChatDescription ( data ) {}

        // https://core.telegram.org/bots/api#pinchatmessage
        async pinChatMessage ( data ) {}

        // https://core.telegram.org/bots/api#unpinchatmessage
        async unpinChatMessage ( data ) {}

        // https://core.telegram.org/bots/api#unpinallchatmessages
        async unpinAllChatMessages ( data ) {}

        // https://core.telegram.org/bots/api#leavechat
        async leaveChat ( data ) {}

        // https://core.telegram.org/bots/api#getchat
        async getChat ( data ) {}

        // https://core.telegram.org/bots/api#getchatadministrators
        async getChatAdministrators ( data ) {}

        // https://core.telegram.org/bots/api#getchatmembercount
        async getChatMembercount ( data ) {}

        // https://core.telegram.org/bots/api#getchatmember
        async getChatMember ( data ) {}

        // https://core.telegram.org/bots/api#setchatstickerset
        async setChatStickerSet ( data ) {}

        // https://core.telegram.org/bots/api#deletechatstickerset
        async deleteChatStickerSet ( data ) {}
    };

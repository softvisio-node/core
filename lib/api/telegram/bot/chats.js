export default Super =>
    class extends Super {

        // https://core.telegram.org/bots/api#sendchataction
        async sendChatAction () {}

        // https://core.telegram.org/bots/api#banchatmember
        async banChatMember () {}

        // https://core.telegram.org/bots/api#unbanchatmember
        async unbanChatMember () {}

        // https://core.telegram.org/bots/api#restrictchatmember
        async restrictChatMember () {}

        // https://core.telegram.org/bots/api#promotechatmember
        async promoteChatMember () {}

        // https://core.telegram.org/bots/api#setchatadministratorcustomtitle
        async setChatAdministratorCustomTitle () {}

        // https://core.telegram.org/bots/api#banchatsenderchat
        async banChatSenderChat () {}

        // https://core.telegram.org/bots/api#unbanchatsenderchat
        async unbanChatSenderChat () {}

        // https://core.telegram.org/bots/api#setchatpermissions
        async setChatPermissions () {}

        // https://core.telegram.org/bots/api#exportchatinvitelink
        async exportChatInviteLink () {}

        // https://core.telegram.org/bots/api#createchatinvitelink
        async createChatInviteLink () {}

        // https://core.telegram.org/bots/api#editchatinvitelink
        async editChatInviteLink () {}

        // https://core.telegram.org/bots/api#revokechatinvitelink
        async revokeChatInviteLink () {}

        // https://core.telegram.org/bots/api#approvechatjoinrequest
        async approveChatJoinRequest () {}

        // https://core.telegram.org/bots/api#declinechatjoinrequest
        async declineChatJoinRequest () {}

        // https://core.telegram.org/bots/api#setchatphoto
        async setChatPhoto () {}

        // https://core.telegram.org/bots/api#deletechatphoto
        async deleteChatPhoto () {}

        // https://core.telegram.org/bots/api#setchattitle
        async setChatTitle () {}

        // https://core.telegram.org/bots/api#setchatdescription
        async setChatDescription () {}

        // https://core.telegram.org/bots/api#pinchatmessage
        async pinChatMessage () {}

        // https://core.telegram.org/bots/api#unpinchatmessage
        async unpinChatMessage () {}

        // https://core.telegram.org/bots/api#unpinallchatmessages
        async unpinAllChatMessages () {}

        // https://core.telegram.org/bots/api#leavechat
        async leaveChat () {}

        // https://core.telegram.org/bots/api#getchat
        async getChat () {}

        // https://core.telegram.org/bots/api#getchatadministrators
        async getChatAdministrators () {}

        // https://core.telegram.org/bots/api#getchatmembercount
        async getChatMembercount () {}

        // https://core.telegram.org/bots/api#getchatmember
        async getChatMember () {}

        // https://core.telegram.org/bots/api#setchatstickerset
        async setChatStickerSet () {}

        // https://core.telegram.org/bots/api#deletechatstickerset
        async deleteChatStickerSet () {}
    };

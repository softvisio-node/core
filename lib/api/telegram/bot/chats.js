const chatActions = new Set( [

    //
    "typing",
    "upload_photo",
    "record_video",
    "upload_video",
    "record_voice",
    "upload_voice",
    "upload_document",
    "sticker",
    "find_location",
    "record_video_note",
    "upload_video_note",
] );

export default Super =>
    class extends ( Super || class {} ) {

        // https://core.telegram.org/bots/api#sendchataction
        async sendChatAction ( data ) {
            if ( !data?.action ) {
                data = {
                    ...data,
                    "action": "typing",
                };
            }
            else {
                if ( !chatActions.has( data.action ) ) return result( [ 400, `Chat action is not valid` ] );
            }

            return this._request( "sendChatAction", data );
        }

        // https://core.telegram.org/bots/api#banchatmember
        async banChatMember ( data ) {
            return this._request( "banChatMember", data );
        }

        // https://core.telegram.org/bots/api#unbanchatmember
        async unbanChatMember ( data ) {
            return this._request( "unbanChatMember", data );
        }

        // https://core.telegram.org/bots/api#restrictchatmember
        async restrictChatMember ( data ) {
            return this._request( "restrictChatMember", data );
        }

        // https://core.telegram.org/bots/api#promotechatmember
        async promoteChatMember ( data ) {
            return this._request( "promoteChatMember", data );
        }

        // https://core.telegram.org/bots/api#setchatadministratorcustomtitle
        async setChatAdministratorCustomTitle ( data ) {
            return this._request( "setChatAdministratorCustomTitle", data );
        }

        // https://core.telegram.org/bots/api#banchatsenderchat
        async banChatSenderChat ( data ) {
            return this._request( "banChatSenderChat", data );
        }

        // https://core.telegram.org/bots/api#unbanchatsenderchat
        async unbanChatSenderChat ( data ) {
            return this._request( "unbanChatSenderChat", data );
        }

        // https://core.telegram.org/bots/api#setchatpermissions
        async setChatPermissions ( data ) {
            return this._request( "setChatPermissions", data );
        }

        // https://core.telegram.org/bots/api#exportchatinvitelink
        async exportChatInviteLink ( data ) {
            return this._request( "exportChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#createchatinvitelink
        async createChatInviteLink ( data ) {
            return this._request( "createChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#editchatinvitelink
        async editChatInviteLink ( data ) {
            return this._request( "editChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#revokechatinvitelink
        async revokeChatInviteLink ( data ) {
            return this._request( "revokeChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#approvechatjoinrequest
        async approveChatJoinRequest ( data ) {
            return this._request( "approveChatJoinRequest", data );
        }

        // https://core.telegram.org/bots/api#declinechatjoinrequest
        async declineChatJoinRequest ( data ) {
            return this._request( "declineChatJoinRequest", data );
        }

        // https://core.telegram.org/bots/api#setchatphoto
        async setChatPhoto ( data ) {
            return this._request( "setChatPhoto", data );
        }

        // https://core.telegram.org/bots/api#deletechatphoto
        async deleteChatPhoto ( data ) {
            return this._request( "deleteChatPhoto", data );
        }

        // https://core.telegram.org/bots/api#setchattitle
        async setChatTitle ( data ) {
            return this._request( "setChatTitle", data );
        }

        // https://core.telegram.org/bots/api#setchatdescription
        async setChatDescription ( data ) {
            return this._request( "setChatDescription", data );
        }

        // https://core.telegram.org/bots/api#pinchatmessage
        async pinChatMessage ( data ) {
            return this._request( "pinChatMessage", data );
        }

        // https://core.telegram.org/bots/api#unpinchatmessage
        async unpinChatMessage ( data ) {
            return this._request( "unpinChatMessage", data );
        }

        // https://core.telegram.org/bots/api#unpinallchatmessages
        async unpinAllChatMessages ( data ) {
            return this._request( "unpinAllChatMessages", data );
        }

        // https://core.telegram.org/bots/api#leavechat
        async leaveChat ( data ) {
            return this._request( "leaveChat", data );
        }

        // https://core.telegram.org/bots/api#getchat
        async getChat ( data ) {
            return this._request( "getChat", data );
        }

        // https://core.telegram.org/bots/api#getchatadministrators
        async getChatAdministrators ( data ) {
            return this._request( "getChatAdministrators", data );
        }

        // https://core.telegram.org/bots/api#getchatmembercount
        async getChatMembercount ( data ) {
            return this._request( "getChatMembercount", data );
        }

        // https://core.telegram.org/bots/api#getchatmember
        async getChatMember ( data ) {
            return this._request( "getChatMember", data );
        }

        // https://core.telegram.org/bots/api#setchatstickerset
        async setChatStickerSet ( data ) {
            return this._request( "setChatStickerSet", data );
        }

        // https://core.telegram.org/bots/api#deletechatstickerset
        async deleteChatStickerSet ( data ) {
            return this._request( "deleteChatStickerSet", data );
        }
    };

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

            return this._doRequest( "sendChatAction", data );
        }

        // https://core.telegram.org/bots/api#banchatmember
        async banChatMember ( data ) {
            return this._doRequest( "banChatMember", data );
        }

        // https://core.telegram.org/bots/api#unbanchatmember
        async unbanChatMember ( data ) {
            return this._doRequest( "unbanChatMember", data );
        }

        // https://core.telegram.org/bots/api#restrictchatmember
        async restrictChatMember ( data ) {
            return this._doRequest( "restrictChatMember", data );
        }

        // https://core.telegram.org/bots/api#promotechatmember
        async promoteChatMember ( data ) {
            return this._doRequest( "promoteChatMember", data );
        }

        // https://core.telegram.org/bots/api#setchatadministratorcustomtitle
        async setChatAdministratorCustomTitle ( data ) {
            return this._doRequest( "setChatAdministratorCustomTitle", data );
        }

        // https://core.telegram.org/bots/api#banchatsenderchat
        async banChatSenderChat ( data ) {
            return this._doRequest( "banChatSenderChat", data );
        }

        // https://core.telegram.org/bots/api#unbanchatsenderchat
        async unbanChatSenderChat ( data ) {
            return this._doRequest( "unbanChatSenderChat", data );
        }

        // https://core.telegram.org/bots/api#setchatpermissions
        async setChatPermissions ( data ) {
            return this._doRequest( "setChatPermissions", data );
        }

        // https://core.telegram.org/bots/api#exportchatinvitelink
        async exportChatInviteLink ( data ) {
            return this._doRequest( "exportChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#createchatinvitelink
        async createChatInviteLink ( data ) {
            return this._doRequest( "createChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#editchatinvitelink
        async editChatInviteLink ( data ) {
            return this._doRequest( "editChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#revokechatinvitelink
        async revokeChatInviteLink ( data ) {
            return this._doRequest( "revokeChatInviteLink", data );
        }

        // https://core.telegram.org/bots/api#approvechatjoinrequest
        async approveChatJoinRequest ( data ) {
            return this._doRequest( "approveChatJoinRequest", data );
        }

        // https://core.telegram.org/bots/api#declinechatjoinrequest
        async declineChatJoinRequest ( data ) {
            return this._doRequest( "declineChatJoinRequest", data );
        }

        // https://core.telegram.org/bots/api#setchatphoto
        async setChatPhoto ( data ) {
            return this._doRequest( "setChatPhoto", data );
        }

        // https://core.telegram.org/bots/api#deletechatphoto
        async deleteChatPhoto ( data ) {
            return this._doRequest( "deleteChatPhoto", data );
        }

        // https://core.telegram.org/bots/api#setchattitle
        async setChatTitle ( data ) {
            return this._doRequest( "setChatTitle", data );
        }

        // https://core.telegram.org/bots/api#setchatdescription
        async setChatDescription ( data ) {
            return this._doRequest( "setChatDescription", data );
        }

        // https://core.telegram.org/bots/api#pinchatmessage
        async pinChatMessage ( data ) {
            return this._doRequest( "pinChatMessage", data );
        }

        // https://core.telegram.org/bots/api#unpinchatmessage
        async unpinChatMessage ( data ) {
            return this._doRequest( "unpinChatMessage", data );
        }

        // https://core.telegram.org/bots/api#unpinallchatmessages
        async unpinAllChatMessages ( data ) {
            return this._doRequest( "unpinAllChatMessages", data );
        }

        // https://core.telegram.org/bots/api#leavechat
        async leaveChat ( data ) {
            return this._doRequest( "leaveChat", data );
        }

        // https://core.telegram.org/bots/api#getchat
        async getChat ( data ) {
            return this._doRequest( "getChat", data );
        }

        // https://core.telegram.org/bots/api#getchatadministrators
        async getChatAdministrators ( data ) {
            return this._doRequest( "getChatAdministrators", data );
        }

        // https://core.telegram.org/bots/api#getchatmembercount
        async getChatMembercount ( data ) {
            return this._doRequest( "getChatMembercount", data );
        }

        // https://core.telegram.org/bots/api#getchatmember
        async getChatMember ( data ) {
            return this._doRequest( "getChatMember", data );
        }

        // https://core.telegram.org/bots/api#setchatstickerset
        async setChatStickerSet ( data ) {
            return this._doRequest( "setChatStickerSet", data );
        }

        // https://core.telegram.org/bots/api#deletechatstickerset
        async deleteChatStickerSet ( data ) {
            return this._doRequest( "deleteChatStickerSet", data );
        }
    };

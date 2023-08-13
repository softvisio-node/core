import fetch from "#lib/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";

const DEFAULT_UPDATES_LIMIT = 100,
    DEFAULT_UPDATES_TIMEOUT = 0;

export default class TelegramBotApi {
    #apiKey;

    constructor ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // properties
    get apiKey () {
        return this.#apiKey;
    }

    set apiKey ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // public
    // https://core.telegram.org/bots/api#getupdates
    async getUpdates ( { offset, limit, timeout, allowedUpdates, signal } = {} ) {
        return this.#request(
            "getUpdates",
            {
                offset,
                "limit": limit || DEFAULT_UPDATES_LIMIT,
                "timeout": timeout || DEFAULT_UPDATES_TIMEOUT,
                "allowed_updates": allowedUpdates,
            },
            signal
        );
    }

    // https://core.telegram.org/bots/api#setwebhook
    async setWebhook () {}

    // https://core.telegram.org/bots/api#deletewebhook
    async deleteWebhook () {}

    // https://core.telegram.org/bots/api#getwebhookinfo
    async getWebhookInfo () {}

    // XXX
    // https://core.telegram.org/bots/api#logout
    async logOut () {}

    // https://core.telegram.org/bots/api#close
    async close () {}

    // https://core.telegram.org/bots/api#sendmessage
    async sendMessage1 () {}

    // https://core.telegram.org/bots/api#forwardmessage
    async forwardMessage () {}

    // https://core.telegram.org/bots/api#copymessage
    async copyMessage () {}

    // https://core.telegram.org/bots/api#sendphoto
    async sendPhoto () {}

    // https://core.telegram.org/bots/api#sendaudio
    async sendAudio () {}

    // https://core.telegram.org/bots/api#senddocument
    async sendDocument () {}

    // https://core.telegram.org/bots/api#sendvideo
    async sendVideo () {}

    // https://core.telegram.org/bots/api#sendanimation
    async sendAnimation () {}

    // https://core.telegram.org/bots/api#sendvoice
    async sendVoice () {}

    // https://core.telegram.org/bots/api#sendvideonote
    async sendVideoNote () {}

    // https://core.telegram.org/bots/api#sendmediagroup
    async sendMediaGroup () {}

    // https://core.telegram.org/bots/api#sendlocation
    async sendLocation () {}

    // https://core.telegram.org/bots/api#sendvenue
    async sendVenue () {}

    // https://core.telegram.org/bots/api#sendcontact
    async sendContact () {}

    // https://core.telegram.org/bots/api#sendpoll
    async sendPoll () {}

    // https://core.telegram.org/bots/api#senddice
    async sendDice () {}

    // https://core.telegram.org/bots/api#sendchataction
    async sendChatAction () {}

    // https://core.telegram.org/bots/api#getuserprofilephotos
    async getUserProfilephotos () {}

    // https://core.telegram.org/bots/api#getfile
    async getFile1 () {}

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

    // https://core.telegram.org/bots/api#getforumtopiciconstickers
    async getForumTopicIconStickers () {}

    // https://core.telegram.org/bots/api#editforumtopic
    async editForumTopic () {}

    // https://core.telegram.org/bots/api#closeforumtopic
    async closeForumTopic () {}

    // https://core.telegram.org/bots/api#reopenforumtopic
    async reopenForumTopic () {}

    // https://core.telegram.org/bots/api#deleteforumtopic
    async deleteForumTopic () {}

    // https://core.telegram.org/bots/api#unpinallforumtopicmessages
    async unpinAllForumTopicMessages () {}

    // https://core.telegram.org/bots/api#editgeneralforumtopic
    async editGeneralForumTopic () {}

    // https://core.telegram.org/bots/api#closegeneralforumtopic
    async closeGeneralForumTopic () {}

    // https://core.telegram.org/bots/api#reopengeneralforumtopic
    async reopenGeneralForumTopic () {}

    // https://core.telegram.org/bots/api#hidegeneralforumtopic
    async hideGeneralForumTopic () {}

    // https://core.telegram.org/bots/api#unhidegeneralforumtopic
    async unhideGeneralForumTopic () {}

    // https://core.telegram.org/bots/api#answercallbackquery
    async answerCallbackQuery () {}

    // XXX edit
    // https://core.telegram.org/bots/api#editmessagetext
    async editMessageText () {}

    // https://core.telegram.org/bots/api#editmessagecaption
    async editMessageCaption () {}

    // https://core.telegram.org/bots/api#editmessagemedia
    async editMessageMedia () {}

    // https://core.telegram.org/bots/api#editmessagelivelocation
    async editMessageLiveLocation () {}

    // https://core.telegram.org/bots/api#stopmessagelivelocation
    async stopMessageLiveLocation () {}

    // https://core.telegram.org/bots/api#editmessagereplymarkup
    async editMessageReplyMarkup () {}

    // https://core.telegram.org/bots/api#stoppoll
    async stopPoll () {}

    // https://core.telegram.org/bots/api#deletemessage
    async deleteMessage () {}

    // XXX
    async send ( method, data ) {
        if ( method === "sendPhoto" ) {
            if ( data.photo instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendVideo" ) {
            if ( data.video instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendDocument" ) {
            if ( data.document instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendAudio" ) {
            if ( data.audio instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendAnimation" ) {
            if ( data.animation instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendVoice" ) {
            if ( data.voice instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendVideoNote" ) {
            if ( data.video_note instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendMediaGroup" ) {
            let formData;

            for ( let n = 0; n < data.media.length; n++ ) {
                if ( data.media[n].media instanceof File || data.media[n].thumb instanceof File ) {
                    formData ??= {
                        ...data,
                        "media": [...data.media],
                    };

                    formData.media[n] = { ...data.media[n] };

                    if ( data.media[n].media instanceof File ) {
                        formData.media[n].media = `attach://media_${n}`;
                        formData["media_" + n] = data.media[n].media;
                    }

                    if ( data.media[n].thumb instanceof File ) {
                        formData.media[n].thumb = `attach://thumb_${n}`;
                        formData["thumb_" + n] = data.media[n].thumb;
                    }
                }
            }

            if ( formData ) data = this.#createFormData( formData );
        }

        return this.#request( method, data );
    }

    async sendMessage ( chatId, text ) {
        return this.#request( "sendMessage", {
            "chat_id": chatId,
            text,
        } );
    }

    async getFile ( fileId ) {
        const res = await this.send( "getFile", {
            "file_id": fileId,
        } );

        if ( !res.ok ) return res;

        const res1 = await fetch( `https://api.telegram.org/file/bot${this.#apiKey}/${res.data.file_path}` );

        if ( !res1.ok ) return res;

        try {
            const tmp = await res1.tmpFile();

            res.data.file = tmp;

            return result( 200, res.data );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    async #request ( method, body, signal ) {
        const headers = {};

        if ( !( body instanceof FormData ) ) {
            headers["Content-Type"] = "application/json";

            body = JSON.stringify( body );
        }

        const res = await fetch( `https://api.telegram.org/bot${this.#apiKey}/${method}`, {
            "method": "post",
            signal,
            headers,
            body,
        } );

        // aborted by abort signal
        if ( signal?.aborted ) return result( res );

        try {
            const data = await res.json();

            if ( !data.ok ) return result( [res.status, data.description] );

            return result( 200, data.result );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    #createFormData ( data ) {
        const formData = new FormData();

        for ( const [name, value] of Object.entries( data ) ) {
            if ( value instanceof File ) {
                formData.append( name, value );
            }
            else if ( typeof value === "object" ) {
                formData.append( name, JSON.stringify( value ) );
            }
            else {
                formData.append( name, value );
            }
        }

        return formData;
    }
}

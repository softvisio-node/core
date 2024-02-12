export default class TelegramBotFiles {
    #bot;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.#bot.app;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // public
    async getFile ( fileId ) {
        return this.bot.telegramBotApi.getFile( fileId );
    }

    async downloadFile ( req, fileId ) {
        return this.bot.telegramBotApi.downloadFile( req, fileId, "public, max-age=30672000" );
    }

    async downloadAvatar ( req, telegramBotUserId ) {
        var userId;

        if ( telegramBotUserId ) {
            const user = await this.bot.users.getTelegramBotUserById( telegramBotUserId );

            // user not found
            if ( !user ) return req.end( 404 );

            userId = user.telegramUserId;
        }
        else {
            userId = this.bot.telegramUserId;
        }

        var res;

        res = await this.bot.telegramBotApi.getUserProfilePhotos( {
            "user_id": userId,
            "offset": 0,
            "limit": 1,
        } );

        if ( !res.ok ) return this.app.api.downloadDefaultAvatar( req );

        const fileId = res.data.photos?.[ 0 ]?.[ 0 ]?.file_id;

        if ( !fileId ) return this.app.api.downloadDefaultAvatar( req );

        return this.bot.telegramBotApi.downloadFile( req, fileId, this.app.api.avatarCacheControl );
    }
}
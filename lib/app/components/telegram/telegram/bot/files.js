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

    // XXX stream
    async downloadFile ( req, fileId ) {
        const res = await this.bot.telegramBotApi.getFile( fileId );

        if ( !res.ok ) return req.end( 404 );

        return req.end( {
            "status": 200,
            "headers": {
                "cache-control": "public, max-age=30672000",
            },
            "body": res.data.file,
        } );
    }

    // XXX stream
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

        const fileId = res.data.photos?.[0]?.[0]?.file_id;

        if ( !fileId ) return this.app.api.downloadDefaultAvatar( req );

        res = await this.bot.telegramBotApi.getFile( fileId );

        if ( !res.ok ) return this.app.api.downloadDefaultAvatar( req );

        return req.end( {
            "status": 200,
            "headers": {
                "cache-control": this.app.api.avatarCacheControl,
            },
            "body": res.data.file,
        } );
    }

    // private
}

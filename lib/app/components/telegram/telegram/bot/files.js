import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";

const SQL = {
    "createFile": sql`
SELECT create_telegram_bot_file(
    _telegram_bot_id => ?,
    _file_id => ?,
    _file_unique_id => ?,
    _filename => ?,
    _content_type => ?
) AS id
`.prepare(),

    "getFileById": sql`
SELECT
    *,
    CASE
        WHEN storage_file_id IS NOT NULL THEN storage_file_id
        ELSE ( SELECT t.storage_file_id FROM telegram_bot_file AS t WHERE t.file_unique_id = file_unique_id AND t.storage_file_id IS NOT NULL LIMIT 1 )
     END AS downloaded_storage_file_id
FROM
    telegram_bot_file
WHERE
    id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getFileByFileId": sql`
SELECT
    *,
    CASE
        WHEN storage_file_id IS NOT NULL THEN storage_file_id
        ELSE ( SELECT t.storage_file_id FROM telegram_bot_file AS t WHERE t.file_unique_id = file_unique_id AND t.storage_file_id IS NOT NULL LIMIT 1 )
     END AS downloaded_storage_file_id    FROM
    telegram_bot_file
WHERE
    file_id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getFileByFileUniqueId": sql`
SELECT
    *,
    CASE
        WHEN storage_file_id IS NOT NULL THEN storage_file_id
        ELSE ( SELECT t.storage_file_id FROM telegram_bot_file AS t WHERE t.file_unique_id = file_unique_id AND t.storage_file_id IS NOT NULL LIMIT 1 )
     END AS downloaded_storage_file_id    FROM
    telegram_bot_file
WHERE
    file_unique_id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "updateStorageFileId": sql`UPDATE telegram_bot_file SET storage_file_id = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotFiles {
    #bot;
    #mutexSet = new Mutex.Set();

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
    async createFile ( { fileId, fileUniqueId, filename, contentType } = {} ) {
        return this.dbh.selectRow( SQL.createFile, [

            //
            this.bot.id,
            fileId,
            fileUniqueId,
            filename,
            contentType,
        ] );
    }

    async getFile ( id ) {
        try {
            BigInt( id );
        }
        catch ( e ) {
            if ( id.lemgth > 30 ) {
                var fileId = id;
            }
            else {
                var fileUniqueId = id;
            }
        }

        var res;

        // get file by telegram bot file id
        if ( fileId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileId, [fileId, this.bot.id] );
        }
        else if ( fileUniqueId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileUniqueId, [fileUniqueId, this.bot.id] );
        }

        // get file by id
        else {
            res = await this.dbh.selectRow( SQL.getFileById, [id, this.bot.id] );
        }

        if ( !res.ok ) return res;

        var file = res.data;

        // file already exists in the storage
        if ( file?.downloaded_storage_file_id ) {
            res = await this.app.storage.getFile( file.downloaded_storage_file_id );
            if ( !res.ok ) return res;

            if ( file.filename ) res.data.file.name = file.filename;
            if ( file.content_type ) res.data.file.type = file.content_type;

            return result( 200, res.data.file );
        }

        if ( !file && fileId ) file = { "file_id": fileId };

        if ( !file ) return result( 404 );

        // download file
        res = await this.#getFile( file.file_id );
        if ( !res.ok ) return res;

        const tmpFile = res.data.file;

        if ( file.filename ) tmpFile.name = file.filename;
        if ( file.content_type ) tmpFile.type = file.content_type;

        // store file
        if ( file.id ) {
            res = await this.dbh.begin( async dbh => {
                var res;

                res = await this.app.storage.uploadFile( this.#getStorageFilePath( file.id ), tmpFile, { dbh } );
                if ( !res.ok ) throw res;

                const storageFileId = res.data.id;

                res = await dbh.do( SQL.updateStorageFileId, [

                    //
                    storageFileId,
                    file.id,
                ] );
                if ( !res.ok ) throw res;

                return result( 200 );
            } );

            if ( !res.ok ) return res;
        }

        return result( 299, tmpFile );
    }

    async downloadFile ( req, fileUniqueId ) {
        try {
            BigInt( fileUniqueId );

            return req.end( 404 );
        }
        catch ( e ) {}

        return this.#downloadFile( req, fileUniqueId );
    }

    async downloadAvatar ( req, telegramBotUserId ) {
        const user = await this.bot.users.getByBotUserId( telegramBotUserId );

        // user not found
        if ( !user ) return req.end( 404 );

        // update avatar
        await user.updateAvatar();

        // telegram avatar not available
        if ( !user.avatarFileId ) {

            // return default avatar
            return req.end( {
                "status": 302,
                "headers": {
                    "location": this.app.users.config.defaultGravatarUrl,
                },
            } );
        }
        else {
            return this.#downloadFile( req, user.avatarFileId, {
                "maxAge": null,
                "cacheContrpl": this.bot.telegram.config.avatarCacheControl,
            } );
        }
    }

    // private
    async #getFile ( fileId ) {
        return this.bot.telegramBotApi.getFile( fileId );
    }

    #getStorageFilePath ( fileId ) {
        return this.bot.telegram.config.storageLocation + "/" + fileId;
    }

    async #downloadFile ( req, id, { maxAge, cacheControl } = {} ) {
        try {
            BigInt( id );
        }
        catch ( e ) {
            if ( id.lemgth > 30 ) {
                var fileId = id;
            }
            else {
                var fileUniqueId = id;
            }
        }

        var res;

        // get file by telegram bot file id
        if ( fileId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileId, [fileId, this.bot.id] );
        }
        else if ( fileUniqueId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileUniqueId, [fileUniqueId, this.bot.id] );
        }

        // get file by id
        else {
            res = await this.dbh.selectRow( SQL.getFileById, [id, this.bot.id] );
        }

        if ( !res.ok ) return req.enf( res.status );

        const file = res.data;

        // file not found
        if ( !file ) return req.end( 404 );

        if ( file.storage_file_id ) return this.app.storage.downloadFile( req, file.storage_file_id, { cacheControl } );

        // find already downloaded file
        if ( file.downloaded_storage_file_id ) {

            // copy file
            res = await this.dbh.begin( async dbh => {
                var res;

                res = await this.app.storage.copyFile( file.downloaded_storage_file_id, this.#getStorageFilePath( file.id ), { maxAge, dbh } );

                if ( !res.ok ) throw res;

                const storageFileId = res.data.id;

                res = await dbh.do( SQL.updateStorageFileId, [

                    //
                    storageFileId,
                    file.id,
                ] );
                if ( !res.ok ) throw res;

                return result( 200, storageFileId );
            } );

            if ( !res.ok ) return req.end( res.status );

            return this.app.storage.downloadFile( req, res.data, { cacheControl } );
        }

        // download file
        res = await this.#getFile( file.file_id );
        if ( !res.ok ) return req.end( res.status );

        const tmpFile = res.data.file;

        // store file
        res = await this.dbh.begin( async dbh => {
            var res;

            res = await this.app.storage.uploadFile( this.#getStorageFilePath( file.id ), tmpFile, { maxAge, dbh } );

            if ( !res.ok ) throw res;

            const storageFileId = res.data.id;

            res = await dbh.do( SQL.updateStorageFileId, [

                //
                storageFileId,
                file.id,
            ] );
            if ( !res.ok ) throw res;

            return result( 200, storageFileId );
        } );

        if ( !res.ok ) return req.end( res.status );

        return this.app.storage.downloadFile( req, res.data, { cacheControl } );
    }
}

import sql from "#lib/sql";

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
SELECT DISTINCT ON ( id )
    *
FROM
    telegram_bot_file
WHERE
    id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getFileByFileId": sql`
SELECT DISTINCT ON ( id )
    *
FROM
    telegram_bot_file
WHERE
    file_id = ?
    AND telegram_bot_id = ?
`.prepare(),

    "getStorageFileId": sql`SELECT storage_file_id FROM telegram_bot_file WHERE file_unique_id = ? AND storage_file_id IS NOT NULL`.prepare(),

    "updateStorageFileId": sql`UPDATE telegram_bot_file SET storage_file_id = ? WHERE id = ?`.prepare(),
};

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
            var fileId = id;
        }

        var res;

        // get file by telegram bot file id
        if ( fileId ) {
            res = await this.dbh.selectRow( SQL.getFileByFileId, [fileId, this.bot.id] );
        }

        // get file by id
        else {
            res = await this.dbh.selectRow( SQL.getFileById, [id, this.bot.id] );
        }

        if ( !res.ok ) return res;

        var file = res.data;

        if ( !file && fileId ) file = { "file_id": fileId };

        if ( !file ) return result( 404 );

        // find downloaded file unique id
        if ( !file.storage_file_id && file.file_unique_id ) {
            res = await this.dbh.selectRow( SQL.getStorageFileId, [file.file_unique_id] );
            if ( !res.ok ) return res;

            file.storage_file_id = res.data?.storage_file_id;
        }

        // file already exists in the storage
        if ( file.storage_file_id ) {
            res = await this.app.storage.getFile( file.storage_file_id );
            if ( !res.ok ) return res;

            if ( file.filename ) res.data.file.name = file.filename;
            if ( file.content_type ) res.data.file.type = file.content_type;

            return result( 200, res.data.file );
        }

        // download file
        res = await this.#getFile( file.file_id );
        if ( !res.ok ) return res;

        const tmpFile = res.data.file;

        if ( file.filename ) tmpFile.name = file.filename;
        if ( file.content_type ) tmpFile.type = file.content_type;

        // store file
        if ( file.id ) {
            res = await this.app.storage.uploadFile( this.bot.telegram.config.storageLocation + "/" + file.id, res.data.file );

            if ( !res.ok ) return res;

            const storageFileId = res.data.id;

            res = await this.dbh.do( SQL.updateStorageFileId, [

                //
                storageFileId,
                file.id,
            ] );

            if ( !res.ok ) return res;
        }

        return result( 299, tmpFile );
    }

    async downloadFile ( req, id, fileUniqueId ) {
        var res;

        res = await this.dbh.selectRow( SQL.getFileById, [id, this.bot.id] );
        if ( !res.ok ) return req.enf( res.status );

        const file = res.data;

        if ( !file ) return req.end( 404 );

        if ( fileUniqueId !== file.file_unique_id ) return req.end( 404 );

        if ( file.storage_file_id ) return this.app.storage.downloadFile( req, file.storage_file_id );

        // find downloaded file unique id
        res = await this.dbh.selectRow( SQL.getStorageFileId, [file.file_unique_id] );
        if ( !res.ok ) return req.end( res.status );

        // find already downloaded file
        if ( res.data?.storage_file_id ) {
            res = await this.app.storage.copyFile( res.data.storage_file_id, this.bot.telegram.config.storageLocation + "/" + file.id );

            if ( !res.ok ) return req.end( res.status );

            const storageFileId = res.data.id;

            res = await this.dbh.do( SQL.updateStorageFileId, [

                //
                storageFileId,
                file.id,
            ] );

            if ( !res.ok ) return req.end( res.status );

            return this.app.storage.downloadFile( req, storageFileId );
        }

        // download file
        res = await this.#getFile( file.file_id );
        if ( !res.ok ) return req.end( res.status );

        // store file
        res = await this.app.storage.uploadFile( this.bot.telegram.config.storageLocation + "/" + file.id, res.data.file );

        if ( !res.ok ) return req.end( res.status );

        const storageFileId = res.data.id;

        res = await this.dbh.do( SQL.updateStorageFileId, [

            //
            storageFileId,
            file.id,
        ] );

        if ( !res.ok ) return req.end( res.status );

        return this.app.storage.downloadFile( req, storageFileId );
    }

    // private
    async #getFile ( fileId ) {
        return this.bot.telegramBotApi.getFile( fileId );
    }
}

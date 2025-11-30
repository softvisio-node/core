export default Super =>
    class extends Super {

        // public
        async [ "API_upload-file" ] ( ctx, path, file, options ) {
            return this.app.storage.uploadFile( path, file, options );
        }

        async [ "API_file-exists" ] ( ctx, path, options ) {
            const exists = await this.app.storage.fileExists( path, options );

            return result( 200, { exists } );
        }

        async [ "API_get-file-metadata" ] ( ctx, path, options ) {
            const data = await this.app.storage.getFileMetadata( path, options );

            return result( 200, data );
        }

        async [ "API_glob" ] ( ctx, patterns, options ) {
            return this.app.storage.glob( patterns, options );
        }

        async [ "API_delete-files" ] ( ctx, patterns, options ) {
            return this.app.storage.deleteFiles( patterns, options );
        }
    };

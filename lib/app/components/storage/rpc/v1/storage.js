export default Super =>
    class extends Super {

        // public
        async [ "API_upload-file" ] ( ctx, path, file, options ) {
            return this.app.storage.uploadFile( path, file, options );
        }

        async [ "API_file-exists" ] ( ctx, path, options ) {
            return this.app.storage.fileExists( path, options );
        }

        async [ "API_get-meta" ] ( ctx, path, options ) {
            return this.app.storage.getMeta( path, options );
        }

        async [ "API_glob" ] ( ctx, patterns, options ) {
            return this.app.storage.glob( patterns, options );
        }

        async [ "API_delete-files" ] ( ctx, patterns, options ) {
            return this.app.storage.deleteFiles( patterns, options );
        }
    };

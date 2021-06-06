import mime from "#lib/mime";

// NOTE https://docs.github.com/en/rest/reference/repos#releases

export default Super =>
    class extends ( Super || Object ) {

        // public
        // https://docs.github.com/en/rest/reference/repos#get-a-release-by-tag-name
        async getReleaseByTagName ( repo, tagName ) {
            return this._req( "get", `repos/${repo}/releases/tags/${tagName}` );
        }

        // https://docs.github.com/en/rest/reference/repos#list-release-assets
        // XXX fetch all pages
        async listReleaseAssets ( repo, releaseId ) {
            return this._req( "get", `repos/${repo}/releases/${releaseId}/assets`, {
                "search": {
                    "per_page": 100,
                },
            } );
        }

        // https://docs.github.com/en/rest/reference/repos#delete-a-release-asset
        async deleteReleaseAsset ( repo, assetId ) {
            return this._req( "delete", `repos/${repo}/releases/assets/${assetId}` );
        }

        // https://docs.github.com/en/rest/reference/repos#upload-a-release-asset
        async uploadReleaseAsset ( repo, releaseId, filename, body ) {
            return this._req( "post", `https://uploads.github.com/repos/${repo}/releases/${releaseId}/assets`, {
                "search": { "name": filename },
                "headers": {
                    "Content-Type": mime.getByFilename( filename )?.["content-type"],
                },
                body,
            } );
        }
    };

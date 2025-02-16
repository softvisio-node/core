// NOTE https://docs.github.com/en/rest/pages/pages

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://docs.github.com/en/rest/pages/pages#get-a-github-pages-site
        async getPages ( repo ) {
            return this._doRequest( "get", `repos/${ repo }/pages` );
        }

        // https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site
        async createPages ( repo, branch, path ) {
            return this._doRequest( "post", `repos/${ repo }/pages`, {
                "body": JSON.stringify( {
                    "source": {
                        branch,
                        path,
                    },
                } ),
            } );
        }

        // https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site
        async updatePages ( repo, options = {} ) {
            return this._doRequest( "put", `repos/${ repo }/pages`, {
                "body": JSON.stringify( options ),
            } );
        }
    };

// NOTE https://docs.github.com/en/rest/pages/pages

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://docs.github.com/en/rest/pages/pages#get-a-github-pages-site
        async getPages ( repositorySlug ) {
            return this._doRequest( "get", `repos/${ repositorySlug }/pages` );
        }

        // https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site
        async createPages ( repositorySlug, branch, path ) {
            return this._doRequest( "post", `repos/${ repositorySlug }/pages`, {
                "body": JSON.stringify( {
                    "source": {
                        branch,
                        path,
                    },
                } ),
            } );
        }

        // https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site
        async updatePages ( repositorySlug, options = {} ) {
            return this._doRequest( "put", `repos/${ repositorySlug }/pages`, {
                "body": JSON.stringify( options ),
            } );
        }
    };

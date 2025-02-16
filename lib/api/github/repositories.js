// NOTE https://docs.github.com/en/rest/repos/repos

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://docs.github.com/en/rest/repos/repos#get-a-repository
        async getRepository ( repo ) {
            return this._doRequest( "get", `repos/${ repo }` );
        }
    };

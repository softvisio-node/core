// https://git-scm.com/docs/git-clone#_git_urls_a_id_urls_a

const ISSUE_RE = /(?<=^|\W)(?<repoId>[\w.-]+\/[\w.-]+)?#(?<issueId>\d+)(?=\W|$)/g;

export default class GitUpstream {
    #repoOwner;
    #repoName;
    #repoId;
    #host;
    #hosting; // github, bitbucket, gitlab
    #sshPort;
    #httpsPort;

    constructor ( url ) {
        var match = url.match( /^git@([\d.A-Za-z-]+?):([\w-]+?)\/([\w.-]+)/ );

        // git@github.com:softvisio/phonegap.git
        if ( match ) {
            this.#host = match[ 1 ];
            this.#repoOwner = match[ 2 ];
            this.#repoName = match[ 3 ];
        }

        // https://github.com/softvisio/phonegap.git
        // git://github.com/softvisio/phonegap.git
        // ssh://git@github.com/softvisio/phonegap.git
        else {
            url = new URL( url, "file:" );

            if ( url.schema === "file:" ) return;

            this.#host = url.hostname;

            if ( url.port ) {
                if ( url.protocol === "https:" ) this.#httpsPort = url.port;
                else if ( url.protocol === "ssh:" ) this.#sshPort = url.port;
            }

            match = url.pathname.match( /([\w-]+)\/([\w-]+)/ );

            if ( match ) {
                this.#repoOwner = match[ 1 ];
                this.#repoName = match[ 2 ];
            }
        }

        this.#repoName = this.repoName.replace( /\.git$/, "" );

        this.#repoId = this.repoOwner + "/" + this.repoName;

        if ( this.host.indexOf( "bitbucket" ) > -1 ) this.#hosting = "bitbucket";
        else if ( this.host.indexOf( "github" ) > -1 ) this.#hosting = "github";
        else if ( this.host.indexOf( "gitlab" ) > -1 ) this.#hosting = "gitlab";
    }

    // properties
    get repoOwner () {
        return this.#repoOwner;
    }

    get repoName () {
        return this.#repoName;
    }

    get repoId () {
        return this.#repoId;
    }

    get host () {
        return this.#host;
    }

    get hosting () {
        return this.#hosting;
    }

    get sshPort () {
        return this.#sshPort;
    }

    get httpsPort () {
        return this.#httpsPort;
    }

    get isGitHub () {
        return this.#hosting === "github";
    }

    get isBitbucket () {
        return this.#hosting === "bitbucket";
    }

    get isGitLab () {
        return this.#hosting === "gitlab";
    }

    get httpsUrl () {
        return this.#getBaseUrl( { "schema": "https:" } ) + ".git";
    }

    get sshUrl () {
        return this.#getBaseUrl() + ".git";
    }

    get wikiHttpsUrl () {
        return this.#getWikiCloneUrl( true );
    }

    get wikiSshUrl () {
        return this.#getWikiCloneUrl( false );
    }

    get homeUrl () {
        return this.#getBaseUrl( { "schema": "https:" } );
    }

    get issuesUrl () {
        return this.#getIssuesUrl();
    }

    get discussionsUrl () {
        var url = this.#getBaseUrl( { "schema": "https:" } );

        // github
        if ( this.isGitHub ) {
            return url + "/discussions";
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return null;
        }

        // gitlab
        else {
            return null;
        }
    }

    get wikiUrl () {
        var url = this.#getBaseUrl( { "schema": "https:" } );

        // github
        if ( this.isGitHub ) {
            url += "/wiki";
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            url += "/wiki";
        }

        // gitlab
        else {
            url += "/-/wikis";
        }

        return url;
    }

    get docsUrl () {

        // github
        if ( this.isGitHub ) {
            return `https://${ this.repoOwner }.github.io/${ this.repoName }/`;
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return null;
        }

        // gitlab
        else {
            return null;
        }
    }

    get rawUrl () {

        // github
        if ( this.isGitHub ) {
            return `https://raw.githubusercontent.com/${ this.repoId }`;
        }

        // bitbucket
        else if ( this.isBirbucket ) {
            return `https://bitbucket.org/${ this.repoId }/raw`;
        }

        // gitlab
        else {
            return `${ this.#getBaseUrl( { "schema": "https:" } ) }/-/raw`;
        }
    }

    // public
    getChangelogUrl ( branch ) {
        branch ||= "master";

        return this.rawUrl + "/" + branch + "/CHANGELOG.md";
    }

    getCommitUrl ( hash ) {

        // github
        if ( this.isGitHub ) {
            return `${ this.#getBaseUrl( { "schema": "https:" } ) }/commit/${ hash }`;
        }

        // bitbucket
        else if ( this.isBirbucket ) {
            return `${ this.#getBaseUrl( { "schema": "https:" } ) }/commit/${ hash }`;
        }

        // gitlab
        else {
            return `${ this.#getBaseUrl( { "schema": "https:" } ) }/-/commit/${ hash }`;
        }
    }

    getIssueUrl ( id, repoId ) {
        return this.#getIssuesUrl( repoId ) + "/" + id;
    }

    getCompareUrl ( revision1, revision2 ) {

        // github
        if ( this.isGitHub ) {
            return `${ this.#getBaseUrl( { "schema": "https:" } ) }/compare/${ revision1 }...${ revision2 }`;
        }

        // bitbucket
        else if ( this.isBirbucket ) {
            return null;
        }

        // gitlab
        else {
            return null;
        }
    }

    linkifyMessage ( message ) {

        // linkify issues
        return message.replaceAll( ISSUE_RE, ( match, repoId, issueId ) => {
            var link;

            if ( !repoId || repoId === this.repoId ) {
                link = `[#${ issueId }](${ this.getIssueUrl( issueId ) })`;
            }
            else {
                link = `[${ repoId }#${ issueId }](${ this.getIssueUrl( issueId, repoId ) })`;
            }

            return link;
        } );
    }

    // private
    #getBaseUrl ( { schema = "ssh:", repoId } = {} ) {
        var url;

        if ( schema === "ssh:" ) {
            url = "ssh://git@";
        }
        else if ( schema === "https:" ) {
            url = "https://";
        }

        url += this.host;

        if ( schema === "ssh:" ) {
            if ( this.sshPort ) url += ":" + this.sshPort;
        }
        else {
            if ( this.httpsPort ) url += ":" + this.httpsPort;
        }

        url += "/" + ( repoId || this.repoId );

        return url;
    }

    #getWikiCloneUrl ( https ) {
        const url = this.#getBaseUrl( { "schema": https
            ? "https:"
            : "ssh:" } );

        // bitbucket
        if ( this.isBitbucket ) {
            return url + ".git/wiki";
        }

        // github, gitlab
        else {
            return url + ".wiki.git";
        }
    }

    #getIssuesUrl ( repoId ) {
        var url = this.#getBaseUrl( { "schema": "https:", repoId } );

        // github
        if ( this.isGitHub ) {
            return url + "/issues";
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return url + "/issues";
        }

        // gitlab
        else {
            return url + "/-/issues";
        }
    }
}

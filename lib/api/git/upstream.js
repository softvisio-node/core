// https://git-scm.com/docs/git-clone#_git_urls_a_id_urls_a

const ISSUE_RE = /(?<=^|\W)(?<repositorySlug>[\w.-]+\/[\w.-]+)?#(?<issueId>\d+)(?=\W|$)/g;

export default class GitUpstream {
    #repositoryOwner;
    #repositoryName;
    #repositorySlug;
    #host;
    #hosting; // github, bitbucket, gitlab
    #sshPort;
    #httpsPort;

    constructor ( url ) {
        var match = url.match( /^git@([\d.A-Za-z-]+?):([\w-]+?)\/([\w.-]+)/ );

        // git@github.com:softvisio/phonegap.git
        if ( match ) {
            this.#host = match[ 1 ];
            this.#repositoryOwner = match[ 2 ];
            this.#repositoryName = match[ 3 ];
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
                this.#repositoryOwner = match[ 1 ];
                this.#repositoryName = match[ 2 ];
            }
        }

        this.#repositoryName = this.repositoryName.replace( /\.git$/, "" );

        this.#repositorySlug = this.repositoryOwner + "/" + this.repositoryName;

        if ( this.host.indexOf( "bitbucket" ) > -1 ) this.#hosting = "bitbucket";
        else if ( this.host.indexOf( "github" ) > -1 ) this.#hosting = "github";
        else if ( this.host.indexOf( "gitlab" ) > -1 ) this.#hosting = "gitlab";
    }

    // properties
    get repositoryOwner () {
        return this.#repositoryOwner;
    }

    get repositoryName () {
        return this.#repositoryName;
    }

    get repositorySlug () {
        return this.#repositorySlug;
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
            return `https://${ this.repositoryOwner }.github.io/${ this.repositoryName }/`;
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return this.homeUrl;
        }

        // gitlab
        else {
            return this.homeUrl;
        }
    }

    get readmeUrl () {

        // github
        if ( this.isGitHub ) {
            return this.homeUrl + "?tab=readme-ov-file#readme";
        }

        // bitbucket
        else if ( this.isBitbucket ) {
            return this.homeUrl;
        }

        // gitlab
        else {
            return this.homeUrl;
        }
    }

    get rawUrl () {

        // github
        if ( this.isGitHub ) {
            return `https://raw.githubusercontent.com/${ this.repositorySlug }`;
        }

        // bitbucket
        else if ( this.isBirbucket ) {
            return `https://bitbucket.org/${ this.repositorySlug }/raw`;
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

    getIssueUrl ( issueId, repositorySlug ) {
        return this.#getIssuesUrl( repositorySlug ) + "/" + issueId;
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
        return message.replaceAll( ISSUE_RE, ( match, repositorySlug, issueId ) => {
            var link;

            if ( !repositorySlug || repositorySlug === this.repositorySlug ) {
                link = `[#${ issueId }](${ this.getIssueUrl( issueId ) })`;
            }
            else {
                link = `[${ repositorySlug }#${ issueId }](${ this.getIssueUrl( issueId, repositorySlug ) })`;
            }

            return link;
        } );
    }

    // private
    #getBaseUrl ( { schema = "ssh:", repositorySlug } = {} ) {
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

        url += "/" + ( repositorySlug || this.repositorySlug );

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

    #getIssuesUrl ( repositorySlug ) {
        var url = this.#getBaseUrl( { "schema": "https:", repositorySlug } );

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

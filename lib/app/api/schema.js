import _url from "url";
import glob from "#lib/glob";
import Module from "./schema/module.js";
import FileTree from "#lib/file-tree";
import * as utils from "#lib/utils";
import readKeyword from "./schema/keywords/read.js";
import fileKeyword from "./schema/keywords/file.js";

const SPEC_EXTENSION = ".yaml";

const MARKDOWN_TYPE = {
    "object": "Object",
    "array": "Array",
};

export default class ApiSchema {
    #url;
    #isInitialized;
    #schema = {}; // XXX remove
    #modules = {};
    #methods = {};
    #logMethods;

    constructor ( url ) {
        this.#url = url + "";
    }

    get url () {
        return this.#url;
    }

    get methods () {
        return this.#methods;
    }

    // public
    loadSchema () {
        try {
            const modules = glob.sync( "**/*" + SPEC_EXTENSION, { "cwd": _url.fileURLToPath( this.#url ), "nodir": true } );

            for ( const file of modules ) {
                const module = this.loadModule( this.#url + "/" + file.replace( SPEC_EXTENSION, "" ) );

                for ( const method of Object.values( module.methods ) ) {
                    this.#methods[method.id] = method;
                }
            }

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async loadApi ( api ) {
        try {
            for ( const method of Object.values( this.#methods ) ) await method.loadApi( api );

            return result( 200 );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    loadModule ( url ) {
        if ( this.#modules[url] ) return this.#modules[url];

        const module = new Module( this, url + "" );

        this.#modules[module.url] = module;

        return module;
    }

    findMethod ( id ) {
        const params = [];

        while ( 1 ) {
            if ( this.#methods[id] ) return [id, params];

            const idx = id.lastIndexOf( "/" );

            if ( idx === -1 ) return [null, params];

            params.unshift( id.substr( idx + 1 ) );

            id = id.substr( 0, idx );
        }
    }

    getLogMethods () {
        if ( !this.#logMethods ) {
            this.#logMethods = {};

            for ( const method of Object.keys( this.#methods ).sort() ) {
                if ( this.#methods[method].logApiCalls ) this.#logMethods[method] = this.#methods[method];
            }
        }

        return this.#logMethods;
    }

    async generate ( options = {} ) {
        const fileTree = new FileTree(),
            { "default": ejs } = await import( "#lib/ejs" ),
            apiSchemaTmpl = utils.resolve( "#resources/templates/api-schema.md.ejs", import.meta.url ),
            versions = {};

        // build versions index
        for ( const module of Object.values( this.#modules ) ) {

            // skip external modules
            if ( !module.namespace ) continue;

            let hasMethods;

            for ( const method of Object.values( module.methods ) ) {
                if ( method.private ) continue;

                hasMethods = true;
            }

            // skip modules without methods
            if ( !hasMethods ) continue;

            versions[module.version] ||= {};
            versions[module.version][module.namespace] = module;
        }

        const httpUrl = new URL( options.url );
        httpUrl.protocol = httpUrl.protocol === "http:" || httpUrl.protocol === "ws:" ? "http:" : "https:";
        if ( !httpUrl.pathname.endsWith( "/" ) ) httpUrl.pathname += "/";

        const webSocketsUrl = new URL( httpUrl );
        webSocketsUrl.protocol = httpUrl.protocol === "http:" ? "ws:" : "wss:";

        // build docs
        for ( const version in versions ) {
            fileTree.add( {
                "path": `${options.type}-v${version}.md`,
                "content": await ejs.renderFile( apiSchemaTmpl,
                    {
                        version,
                        "modules": Object.values( versions[version] ),
                        options,
                        httpUrl,
                        webSocketsUrl,
                        "getParamDescription": this.#getParamDescription.bind( this ),
                    },
                    { "async": true } ),
            } );
        }

        return fileTree;
    }

    // private
    async #getParamDescription ( method, param ) {
        var desc = "";

        // read keyword
        if ( param.schema.read ) {
            desc += await readKeyword.getDescription( param );
        }

        // file keyword
        else if ( param.schema.file ) {
            desc += await fileKeyword.getDescription( param );
        }

        // raw parameter
        else {
            if ( param.description ) desc = param.description.trim();

            // descriprion has no type, try to get type from the schema
            if ( !desc.match( /^<([\w.]+)(\[\])?\\>/ ) ) {
                let types = param.schema?.instanceof || param.schema?.typeof || param.schema?.type;

                if ( !types ) throw `Method "${method.id}" parameter "${param.name}" has no type defined`;

                if ( !Array.isArray( types ) ) types = [types];

                desc = types.map( type => "<" + ( MARKDOWN_TYPE[type] || type ) + "\\>" ).join( " | " ) + ( desc ? " " + desc : "" );
            }
        }

        // indent
        if ( desc ) desc = " " + desc.replaceAll( /^/gm, " ".repeat( 4 ) ).replaceAll( /^ +$/gm, "" ).trim();

        return desc;
    }
}

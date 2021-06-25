import fs from "fs";
import _url from "url";
import glob from "glob";
import Module from "./schema/module.js";
import YAML from "js-yaml";

const SPEC_EXTENSION = ".schema.yaml";
const MARKDOWN_ID_RE = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g;

const MARKDOWN_TYPE = {
    "object": "Object",
    "array": "Array",
};

export default class APISchema {
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

    async loadAPI ( api ) {
        try {
            for ( const method of Object.values( this.#methods ) ) await method.loadAPI( api );

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
        const fileTree = new fs.FileTree(),
            { "default": ejs } = await import( "ejs" ),
            apiSchemaTmpl = fs.resolve( "#resources/templates/api-schema.md.ejs", import.meta.url ),
            versions = {},
            markdownIdCache = {};

        // build versions index
        for ( const module of Object.values( this.#modules ) ) {

            // skip external modules
            if ( !module.namespace ) continue;

            this.#setMarkdownId( markdownIdCache, module );

            let hasMethods;

            for ( const method of Object.values( module.methods ) ) {
                if ( method.private ) continue;

                hasMethods = true;

                this.#setMarkdownId( markdownIdCache, method );

                if ( !method.spec.params ) continue;

                // serialize params schema
                for ( const param of method.spec.params ) {
                    param.markdownSchema = YAML.dump( param.schema, {
                        "indent": 4,
                        "lineWidth": -1,
                        "noArrayIndent": false,
                        "flowLevel": 5,
                        "quotingType": '"',
                        "styles": {
                            "!!null": "lowercase",
                            "!!bool": "lowercase",
                            "!!float": "lowercase",
                        },
                    } );

                    // indent with 4 spaces
                    param.markdownSchema = " ".repeat( 4 ) + param.markdownSchema.replaceAll( /^/gm, " ".repeat( 4 ) ).trim();
                }
            }

            // skip modules without methods
            if ( !hasMethods ) continue;

            versions[module.version] ||= {};
            versions[module.version][module.namespace] = module;
        }

        // build docs
        for ( const version in versions ) {
            fileTree.add( {
                "path": `${options.type}-v${version}.md`,
                "data": await ejs.renderFile( apiSchemaTmpl, {
                    version,
                    "modules": Object.values( versions[version] ),
                    options,
                    resolveParamType ( type ) {
                        return MARKDOWN_TYPE[type] || type;
                    },
                } ),
            } );
        }

        return fileTree;
    }

    // private
    #setMarkdownId ( cache, object ) {
        object.markdownId = object.title
            .trim()
            .toLowerCase()
            .replace( /<[^>]+>/g, "" )
            .replace( MARKDOWN_ID_RE, "" )
            .replace( /\s/g, "-" )
            .replace( /-+/g, "-" )
            .replace( /^(\d)/, "_$1" );

        if ( object.deprecated ) object.markdownId += "-deprecated";

        cache[object.version] ||= {};
        cache[object.version][object.markdownId] ||= 0;

        if ( cache[object.version][object.markdownId] ) object.markdownId += "-" + cache[object.version][object.markdownId];

        cache[object.version][object.markdownId]++;
    }
}

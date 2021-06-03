import fs from "fs";
import _url from "url";
import glob from "glob";
import Module from "./schema/module.js";
import YAML from "js-yaml";

const SPEC_EXTENSION = ".schema.yaml";

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
            return result.catchResult( e );
        }
    }

    async loadObjects ( api ) {
        try {
            for ( const method of Object.values( this.#methods ) ) await method.loadObject( api );

            return result( 200 );
        }
        catch ( e ) {
            return result.catchResult( e );
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
            readmeTmpl = fs.resolve( "#resources/tmpl/api/README.md.ejs", import.meta.url ),
            sidebarTmpl = fs.resolve( "#resources/tmpl/api/_sidebar.md.ejs", import.meta.url ),
            moduleTmpl = fs.resolve( "#resources/tmpl/api/module.md.ejs", import.meta.url ),
            index = {};

        for ( const module of Object.values( this.#modules ) ) {
            if ( !module.namespace ) continue;

            index[module.version] ||= {};

            index[module.version][module.namespace] = module;

            for ( const method of Object.values( module.methods ) ) {
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

                    // indent with 8 spaces
                    param.markdownSchema = " ".repeat( 4 ) + param.markdownSchema.replace( /^/gm, " ".repeat( 4 ) ).trim();
                }
            }

            fileTree.add( { "path": "v" + module.version + "/" + module.name.replaceAll( "/", "-" ) + ".md", "data": await ejs.renderFile( moduleTmpl, { options, module } ) } );
        }

        // generate main index
        if ( !fileTree.isEmpty ) {
            for ( const version in index ) {
                fileTree.add( { "path": "v" + version + "/README.md", "data": await ejs.renderFile( readmeTmpl, { options, version, "modules": index[version] } ) } );

                fileTree.add( { "path": "v" + version + "/_sidebar.md", "data": await ejs.renderFile( sidebarTmpl, { options, version, "modules": index[version] } ) } );
            }
        }

        return fileTree;
    }
}

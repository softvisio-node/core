import Module from "#lib/app/api/schema/module";
import { schemaValidator } from "#lib/app/api/schema/validator";
import { readConfigSync } from "#lib/config";
import { globSync } from "#lib/glob";
import GlobPatterns from "#lib/glob/patterns";
import { validatePath } from "#lib/naming-conventions";

export default class {
    #api;
    #type;
    #emits = new GlobPatterns();
    #modules = {};
    #methods = {};
    #aclResolvers = {};
    #maxUploadFileSize = 0;
    #json;

    constructor ( type ) {
        this.#type = type;
    }

    // properties
    get api () {
        return this.#api;
    }

    get type () {
        return this.#type;
    }

    get modules () {
        return this.#modules;
    }

    get methods () {
        return this.#methods;
    }

    get aclResolvers () {
        return this.#aclResolvers;
    }

    get maxUploadFileSize () {
        return this.#maxUploadFileSize;
    }

    // public
    loadSchema ( locations ) {
        for ( const location of locations ) {
            const files = globSync( "**/*.yaml", { "cwd": location, "directories": false } );

            for ( const file of files ) {

                // index
                if ( /^v\d+\.yaml$/.test( file ) ) {
                    const index = readConfigSync( location + "/" + file );

                    if ( !schemaValidator.validate( "index", index ) ) {
                        return result( [ 500, `API index "${ file }" is not valid, inspect errors below:\n${ schemaValidator.errors }` ] );
                    }

                    if ( index.emits ) {
                        for ( const name of index.emits ) this.#emits.add( name );
                    }
                }

                // module
                else {
                    const id = "/" + file.replace( ".yaml", "" );

                    // check module id kebab case
                    if (
                        !validatePath( id, {
                            "absolute": true,
                            "format": "kebab-case",
                        } )
                    ) {
                        return result( [ 500, `API module id "${ id }" must be in the kebab-case` ] );
                    }

                    this.#modules[ id ] ??= new Module( this, id );

                    const res = this.#modules[ id ].addLocation( location );

                    if ( !res.ok ) return res;
                }
            }
        }

        for ( const module of Object.values( this.#modules ) ) {

            // emits
            for ( const name of module.emits ) this.#emits.add( name );

            // acl resolvers
            for ( const [ aclResolver, query ] of Object.entries( module.aclResolvers ) ) {
                if ( aclResolver in this.#aclResolvers ) return result( [ 500, `ACL resolver "${ aclResolver }" is already defined` ] );

                this.#aclResolvers[ aclResolver ] = query;
            }

            // methods
            for ( const method of Object.values( module.methods ) ) {
                this.#methods[ method.id ] = method;

                if ( this.#maxUploadFileSize < method.maxUploadFileSize ) {
                    this.#maxUploadFileSize = method.maxUploadFileSize;
                }
            }
        }

        return result( 200 );
    }

    async loadApi ( api ) {
        this.#api = api;

        for ( const module of Object.values( this.#modules ) ) {
            const res = await module.loadApi( api );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async generate ( options ) {
        const Generator = await import( "./schema/generator.js" ),
            generator = new Generator.default( this, options );

        return generator.start();
    }

    isEventValid ( name ) {
        return this.#emits.test( name );
    }

    toJSON () {
        if ( !this.#json ) {
            this.#json = {
                "emits": this.#emits,
                "versions": {},
            };

            for ( const module of Object.values( this.#modules ) ) {
                this.#json.versions[ module.version ] ??= {};

                this.#json.versions[ module.version ][ module.name ] = module;
            }
        }

        return this.#json;
    }
}

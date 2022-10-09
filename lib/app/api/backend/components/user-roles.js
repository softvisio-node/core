import Component from "#lib/app/api/backend/component";
import { isSnakeCase } from "#lib/utils/naming-conventions";

const RESERVED_ROLES_NAMES = new Set( ["*", "guest", "root", "user"] );

export default class extends Component {
    #roles = {};
    #rootRoles = {};
    #userRoles = {};

    // public
    async init () {
        var res;

        if ( this.config.roles ) {
            process.stdout.write( "Loading user roles ... " );
            res = await this.#init( this.config.roles );
            console.log( res + "" );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    validateUserRoles ( roles ) {
        if ( !Array.isArray( roles ) ) roles = [roles];

        const invalid = [];

        for ( const role of roles ) {
            if ( !( role in this.#roles ) ) invalid.push( role );
        }

        if ( invalid.length ) {
            return result( [400, `Roles: ${invalid.map( name => `"${name}"` ).join( ", " )} are invalid`] );
        }
        else {
            return result( 200 );
        }
    }

    async getUserRoles ( userId, parentRoles, options ) {
        var user = await this._getUser( userId, options );

        if ( !user.ok ) return user;

        const roles = [];

        for ( const role of parentRoles ) {
            roles.push( {
                "id": role,
                "enabled": !!user.data.roles[role],
            } );
        }

        this._addRolesMetadata( roles );

        return result( 200, roles );
    }

    // protected
    _validateApiRoles ( roles ) {
        if ( !Array.isArray( roles ) ) roles = [roles];

        const invalid = roles.filter( role => !RESERVED_ROLES_NAMES.has( role ) );

        if ( invalid.length ) {
            return this.validateUserRoles( invalid );
        }
        else {
            return result( 200 );
        }
    }

    buildUserRoles ( userId, userRoles, tokenRoles ) {
        var _userRoles;

        // root user
        if ( this.api.validate.userIsRoot( userId ) ) {

            // for root user all roles are enabled
            _userRoles = { ...this.#rootRoles };
        }

        // non-root user
        else {
            _userRoles = {};

            for ( const role in this.#userRoles ) {
                const enabled = userRoles[role] ?? this.#userRoles[role];

                // take only enabled user roles
                if ( enabled ) _userRoles[role] = true;
            }
        }

        if ( !tokenRoles ) return _userRoles;

        const _tokenRoles = {};

        // build token roles
        for ( const role in _userRoles ) {

            // all token roles are disabled by default
            const enabled = !!tokenRoles[role];

            // take only enabled token roles
            if ( enabled ) _tokenRoles[role] = true;
        }

        return _tokenRoles;
    }

    _addRolesMetadata ( roles ) {
        for ( const row of roles ) {
            row.name = this.#roles[row.id].name;
            row.description = this.#roles[row.id].description;
        }
    }

    // private
    async #init ( roles ) {

        // init roles
        for ( const id in roles ) {
            if ( RESERVED_ROLES_NAMES.has( id ) ) return result( [400, `Role name "${id}" is reserved`] );

            if ( !isSnakeCase( id ) ) return result( [400, `Role name "${id}" must be in the snake_case`] );

            this.#roles[id] = {
                id,
                "default": !!roles[id].default,
                "name": roles[id].name,
                "description": roles[id].description,
            };

            this.#rootRoles[id] = true;

            this.#userRoles[id] = this.#roles[id].default;
        }

        // validate methods roles
        for ( const method of Object.values( this.schema.methods ) ) {
            const res = this._validateApiRoles( method.roles );

            if ( !res.ok ) {
                res.statusText = `Roles for method "${method.id}"are invalid. ` + res.statusText;

                return res;
            }
        }

        return result( 200 );
    }
}

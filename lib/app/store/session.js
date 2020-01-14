const keyToken = "token";
const keyTheme = "theme";

var state = {
    "isInitialized": false,
    "isAuthenticated": false,

    // user
    "userId": null,
    "userName": null,
    "avatar": null,
    "permissions": null,

    // settings
    "settings": {},

    // theme
    "theme": {
        "darkMode": false,
        "accent": null,
        "base": null,
    },
};

var getters = {
    "isAuthenticated": ( state ) => {
        // if is not initialized - authentication status is unknown
        return !state.isInitialized ? null : state.isAuthenticated;
    },

    "userId": ( state ) => {
        return state.userId;
    },

    "userName": ( state ) => {
        return state.userName;
    },

    "avatar": ( state ) => {
        return state.avatar;
    },

    "darkMode": ( state ) => {
        return state.theme.darkMode;
    },
};

var mutations = {
    "darkMode": function ( state, darkMode ) {
        state.theme.darkMode = darkMode;

        var theme = state.theme;

        this.commit( "session/theme", { ...theme, "darkMode": darkMode } );
    },

    "invertDarkMode": function ( state ) {
        this.commit( "session/darkMode", !state.theme.darkMode );
    },

    "theme": function ( state, theme ) {
        theme = { ...state.theme, ...theme };

        if ( Ext ) {
            Ext.manifest.material = Ext.manifest.material || {};
            Ext.manifest.material.toolbar = Ext.manifest.material.toolbar || {};
            Ext.manifest.material.toolbar.dynamic = true;

            Ext.theme.Material.setColors( theme );
        }

        window.localStorage.setItem( keyTheme, JSON.stringify( theme ) );

        state.theme = theme;
    },

    "session": function ( state, data ) {
        if ( data && data.is_authenticated ) {
            state.isAuthenticated = true;
            state.userId = data.user_id;
            state.userName = data.user_name;
            state.avatar = data.avatar;
            state.permissions = data.permissions;

            state.settings = data.settings;

            if ( data.token ) {
                // store token
                window.localStorage.setItem( keyToken, data.token );

                // re-authenticate
                this._vm.$api.auth( data.token );
            }
        }
        else {
            state.isAuthenticated = false;
            state.userId = null;
            state.userName = null;
            state.avatar = null;
            state.permissions = null;
        }
    },
};

var actions = {
    "init": function ( ctx, defaults ) {
        // api
        var token = window.localStorage.getItem( keyToken );

        this._vm.$api.auth( token );

        // theme
        var theme = window.localStorage.getItem( keyTheme );

        if ( theme ) {
            ctx.commit( "theme", { ...defaults.theme, ...JSON.parse( theme ) } );
        }
        else {
            ctx.commit( "theme", defaults.theme );
        }
    },

    "signin": async function ( ctx, credintials ) {
        var res = await this._vm.$api.call( "Auth/signin", credintials );

        if ( !ctx.state.isInitialized && res.isSuccess() ) ctx.state.isInitialized = true;

        ctx.commit( "session", res.data );

        return res;
    },

    "signout": async function ( ctx ) {
        // signout
        var res = await this._vm.$api.call( "Profile/signout" );

        // drop API token
        window.localStorage.removeItem( keyToken );

        // set token and disconnect
        this._vm.$api.auth( null );

        // clear session data
        ctx.commit( "session" );
    },

    "changePassword": async function ( ctx, password ) {
        var res = await this._vm.$api.call( "Profile/change_password", password );

        return res;
    },

    "recoverPassword": async function ( ctx, username ) {
        var res = await this._vm.$api.call( "Auth/recover_password", username );

        return res;
    },
};

export default {
    "namespaced": true,
    state,
    getters,
    mutations,
    actions,
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// |  WARN | 135:13        | no-unused-vars               | 'res' is assigned a value but never used.                                      |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----

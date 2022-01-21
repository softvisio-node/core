import crypto from "crypto";

const DEFAULT = {
    "usernameIsEmail": true,
    "newUserEnabled": true,
    "defaultGravatarEmail": "noname@softvisio.net", // used, if user email is not set
    "defaultGravatarImage": "identicon", // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank
};

export default function mergeConfig ( config = {} ) {
    config.usernameIsEmail ??= DEFAULT.usernameIsEmail;
    config.newUserEnabled ??= DEFAULT.newUserEnabled;
    config.defaultGravatarEmail ??= DEFAULT.defaultGravatarEmail;
    config.defaultGravatarImage ??= DEFAULT.defaultGravatarImage;

    config.defaultGravatarUrl ??= `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( config.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${config.defaultGravatarImage}`;

    return config;
}

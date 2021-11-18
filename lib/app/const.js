import crypto from "crypto";

const CONST = {
    "usernameIsEmail": true,
    "newUserEnabled": true,
    "defaultGravatarEmail": "noname@softvisio.net", // used, if user email is not set
    "defaultGravatarImage": "identicon", // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank
};

export default function mergeConst ( settings = {} ) {
    settings.usernameIsEmail ??= CONST.usernameIsEmail;
    settings.newUserEnabled ??= CONST.newUserEnabled;
    settings.defaultGravatarEmail ??= CONST.defaultGravatarEmail;
    settings.defaultGravatarImage ??= CONST.defaultGravatarImage;

    settings.defaultGravatarUrl ??= `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( settings.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${settings.defaultGravatarImage}`;

    return settings;
}

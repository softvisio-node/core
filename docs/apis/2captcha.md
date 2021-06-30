# Class: 2Catcha

```javascript
import Captcha from "@softvisio/core/api/2captcha";
```

### new Catcha( url, options )

-   `url` <string\> | <URL\> 2captcha service HTTP URL. Must include `username` and `password` for authentication.
-   `options` <Object\>:
    -   `proxy` <string\> | <ProxyClient\> HTTP proxy to use.

### captcha.proxy

-   <ProxyClient\>

HTTP proxy.

### captcha.resolveNormalCaptcha( image, options )

-   `image` <Buffer\> Captcha image.
-   `options` <Object\> To see full list of options refer to the [official documentation](https://2captcha.com/2captcha-api#solving_normal_captcha).
-   Returns: <Promise\>.

### captcha.resolveReCaptchaV2( siteKey, pageURL )

-   `siteKey` <string\> Site key.
-   `pageURL` <string\> Page URL.
-   Returns: <Promise\>.

Resolve google recaptcha v2. [Official documentation](https://2captcha.com/2captcha-api#solving_recaptchav2_new).

### captcha.resolveInvisibleReCaptchaV2( siteKey, pageURL, options )

-   `siteKey` <string\> Site key.
-   `pageURL` <string\> Page URL.
-   `options` <Object\>:
    -   `data` <string\>.
    -   `userAgent` <string\>.
    -   `cookies` <Object\>.
-   Returns: <Promise\>.

Resolve invisible google recaptcha v2. [Official documentation](https://2captcha.com/2captcha-api#invisible).

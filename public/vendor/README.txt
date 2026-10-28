libphonenumber-max.js is the browser bundle from the installed libphonenumber-js
dependency (bundle/libphonenumber-max.js). Its MIT licence is included alongside it.

The two standalone HTML registration pages use this local copy so their phone
validation uses the same full UK numbering metadata as the React application.
When upgrading libphonenumber-js, copy the updated bundle and licence here too.
tests/uk-server-validation.test.cjs checks parity with the application's validator.

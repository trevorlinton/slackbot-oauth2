# OAuth2 and Slack App Template 

A template for a slack app that links slack users to an oauth2 system for fun integrations and profit!

**TL;DR:** Associating a slack user with an external system via oauth2 can be tricky, so we've solved it for you.

## Introduction 

A common use case for slack is to access an external system via slack commands to help automate workflows, etc. 
This can be challenging as a slack app can only validate requests are coming from Slack, however the slack user
still needs to "link" or authorize their account with the external system and in some way there needs to be access
tokens stored and associated with the slack user so they can use commands.

This template takes care of most of the dirty work by checking if the user is authenticated via slack's secret signing,
it then checks to see if it has a valid access token via the oauth2 system specified, and if not presents the user with
a request to login, once the login process is finished the token is stored and any slack requests that come in are 
processed (via a middle ware in express) to add the appropriate access tokens for that user.  In addition, if the refresh
tokens are available and the access token has expired, a new refresh token is fetched. 


## Getting Started

1. Setup a new slack app
2. Each slack command created should point to a unique route on your app (see `main.js`)
3. Add the appropriate business logic to `businesslogic.js` and point the routes to the functions there.
4. Add the appropriate environmnet variables below

This utilizes a postgres database for both storing tokens obtained from the oauth2 system (encrypted with AES192), and
sessions from the oauth2 flow. 

### General Settings

* `SLACK_SIGNING_SECRET` - This you'll obtain from the slack app (on the main settings page)
* `SESSION_COOKIE_SECRET` - A random secret you choose, changing this will invalidate all of your oauth2 flows.
* `ENCRYPTION_SECRET` - A random secret you choose, do not change this, if you do you'll invalidate all your tokens stored.
* `VANITY_URL` - The url (https://www.google.com) where this app is being hosted (just the base), it's used to prompt the user to login and access resources for your app.
* `DATABASE_URL` - The postgres database url (e.g., `postgres://user:pass@host:port/dbname?sslmode=disable`)

### OAuth2 System Settings

You should obtain these from your oauth2 provider.  When you create an oauth2 system it will ask you for a `redirect_uri`, use the value `https://yourapp.com/auth/callback`, remember to replace yourapp.com with the host name of your app. You'll also want to store this value as the enviornment variable `OAUTH2_REDIRECT_URI`.

* `OAUTH2_AUTHORIZE_URL` - The full URL where to begin an authorize/authorization process. 
* `OAUTH2_TOKEN_URL` - The full URL where tokens for `refresh_token` and `authorization_code` exchanges can be done.
* `OAUTH2_CLIENT_ID` - The oauth2 client id received
* `OAUTH2_CLIENT_SECRET` - The oauth2 client secret received
* `OAUTH2_REDIRECT_URI` - This should be `$VANITY_URL/auth/callback` its a seperate value (rather than derived from vanity url) to help ease testing, as sometimes the redirect uri is not the same as the vanity url when working locally.

## Modifying the Login Screen

See https://github.com/trevorlinton/slackbot-oauth2/blob/master/auth.js#L115 for modifying the login message.